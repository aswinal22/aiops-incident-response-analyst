# async_db.py
# --------------------------------------------------------------
# Async PostgreSQL connection handling with pooling, retry,
# exponential back‑off and circuit‑breaker protection.
#
# Environment variables:
#   DB_HOST_PRIMARY          – primary DB host (required)
#   DB_HOST_REPLICA          – replica DB host (optional)
#   DB_USER                  – DB user (required)
#   DB_PASSWORD              – DB password (required)
#   DB_NAME                  – DB name (required)
#   DB_POOL_SIZE             – max connections per pool (default: 20)
#   READ_REPLICA_ENABLED     – "true"/"false" (default: true)
#   CIRCUIT_FAILURE_THRESHOLD – failures before opening circuit (default: 5)
#   CIRCUIT_COOLDOWN_SECONDS  – seconds to stay open (default: 30)
# --------------------------------------------------------------

import asyncio
import logging
import os
import time
from typing import Optional, Callable, Awaitable

import asyncpg

# ----------------------------------------------------------------------
# Logging
# ----------------------------------------------------------------------
_logger = logging.getLogger(__name__)

# ----------------------------------------------------------------------
# Configuration helpers
# ----------------------------------------------------------------------
def _env(var: str, default: Optional[str] = None) -> str:
    """Fetch an environment variable, raising if required and missing."""
    val = os.getenv(var, default)
    if val is None:
        raise RuntimeError(f"Environment variable {var} is required but not set")
    return val


def _make_dsn(host: str) -> str:
    """Construct a PostgreSQL DSN from common components."""
    return (
        f"postgresql://{_env('DB_USER')}:{_env('DB_PASSWORD')}"
        f"@{host}/{_env('DB_NAME')}"
    )


# Core DSNs
_PRIMARY_DSN = _make_dsn(_env("DB_HOST_PRIMARY"))
_REPLICA_DSN = _make_dsn(os.getenv("DB_HOST_REPLICA", ""))

# Pool sizing – bumped to a safer default for production
_POOL_MAX_SIZE = int(os.getenv("DB_POOL_SIZE", "20"))

# Feature toggles
_READ_REPLICA_ENABLED = os.getenv("READ_REPLICA_ENABLED", "true").lower() == "true"

# Circuit‑breaker parameters
_CIRCUIT_FAILURE_THRESHOLD = int(os.getenv("CIRCUIT_FAILURE_THRESHOLD", "5"))
_CIRCUIT_COOLDOWN_SECONDS = int(os.getenv("CIRCUIT_COOLDOWN_SECONDS", "30"))

# ----------------------------------------------------------------------
# Circuit Breaker implementation
# ----------------------------------------------------------------------
class CircuitBreaker:
    """Async‑compatible simple circuit breaker."""

    def __init__(self, failure_threshold: int, cooldown: int):
        self._failure_threshold = failure_threshold
        self._cooldown = cooldown
        self._failure_count = 0
        self._state: str = "CLOSED"          # CLOSED, OPEN, HALF_OPEN
        self._opened_at: Optional[float] = None
        self._lock = asyncio.Lock()

    async def call(self, coro_factory: Callable[[], Awaitable]):
        """Execute a coroutine respecting circuit‑breaker state."""
        async with self._lock:
            if self._state == "OPEN":
                if time.time() - (self._opened_at or 0) >= self._cooldown:
                    self._state = "HALF_OPEN"
                    _logger.info("Circuit breaker transitioning to HALF_OPEN")
                else:
                    raise RuntimeError("Circuit breaker is OPEN")

        try:
            result = await coro_factory()
        except Exception:
            await self._record_failure()
            raise
        else:
            await self._record_success()
            return result

    async def _record_failure(self):
        async with self._lock:
            self._failure_count += 1
            _logger.warning(
                "Circuit breaker failure %d/%d",
                self._failure_count,
                self._failure_threshold,
            )
            if self._failure_count >= self._failure_threshold:
                self._state = "OPEN"
                self._opened_at = time.time()
                _logger.error("Circuit breaker OPENED")

    async def _record_success(self):
        async with self._lock:
            if self._state in ("HALF_OPEN", "OPEN"):
                _logger.info("Circuit breaker CLOSED after successful call")
            self._state = "CLOSED"
            self._failure_count = 0
            self._opened_at = None


# ----------------------------------------------------------------------
# Global pools and circuit breakers
# ----------------------------------------------------------------------
_primary_pool: Optional[asyncpg.Pool] = None
_replica_pool: Optional[asyncpg.Pool] = None

_primary_cb = CircuitBreaker(_CIRCUIT_FAILURE_THRESHOLD, _CIRCUIT_COOLDOWN_SECONDS)
_replica_cb = CircuitBreaker(_CIRCUIT_FAILURE_THRESHOLD, _CIRCUIT_COOLDOWN_SECONDS)

# ----------------------------------------------------------------------
# Helper: exponential back‑off retry
# ----------------------------------------------------------------------
async def _retry_with_backoff(
    func: Callable[[], Awaitable],
    *,
    retries: int = 2,
    base_delay: float = 0.05,
    max_delay: float = 0.5,
    jitter: bool = True,
) -> Awaitable:
    """
    Retry an async callable with exponential back‑off.

    Parameters
    ----------
    func: Callable[[], Awaitable]
        The coroutine factory to invoke.
    retries: int
        Number of retry attempts after the first failure.
    base_delay: float
        Initial back‑off delay in seconds.
    max_delay: float
        Upper bound for the back‑off delay.
    jitter: bool
        Apply jitter to avoid thundering herd.

    Returns
    -------
    Awaitable
        Result of the successful call.

    Raises
    ------
    Exception
        Propagates the last exception if all retries fail.
    """
    attempt = 0
    while True:
        try:
            return await func()
        except Exception as exc:
            attempt += 1
            if attempt > retries:
                _logger.exception("All retry attempts exhausted")
                raise
            delay = min(base_delay * (2 ** (attempt - 1)), max_delay)
            if jitter:
                delay *= (0.5 + 0.5 * (time.time() % 1))
            _logger.warning(
                "Retry %d/%d after %.2fs due to %s",
                attempt,
                retries,
                delay,
                exc,
            )
            await asyncio.sleep(delay)


# ----------------------------------------------------------------------
# Pool lifecycle management
# ----------------------------------------------------------------------
async def init_pools() -> None:
    """Create connection pools for primary and (optionally) replica."""
    global _primary_pool, _replica_pool

    _primary_pool = await asyncpg.create_pool(
        dsn=_PRIMARY_DSN,
        max_size=_POOL_MAX_SIZE,
        min_size=1,
        timeout=5,
    )
    _logger.info("Primary DB pool created (max size=%d)", _POOL_MAX_SIZE)

    if _READ_REPLICA_ENABLED and os.getenv("DB_HOST_REPLICA"):
        _replica_pool = await asyncpg.create_pool(
            dsn=_REPLICA_DSN,
            max_size=_POOL_MAX_SIZE,
            min_size=1,
            timeout=5,
        )
        _logger.info("Replica DB pool created (max size=%d)", _POOL_MAX_SIZE)
    else:
        _replica_pool = None
        _logger.info("Replica DB pool disabled via configuration")


async def close_pools() -> None:
    """Gracefully close all pools."""
    global _primary_pool, _replica_pool

    if _primary_pool:
        await _primary_pool.close()
        _primary_pool = None
        _logger.info("Primary DB pool closed")

    if _replica_pool:
        await _replica_pool.close()
        _replica_pool = None
        _logger.info("Replica DB pool closed")


# ----------------------------------------------------------------------
# Public API – connection acquisition
# ----------------------------------------------------------------------
async def acquire_connection(read: bool = False) -> asyncpg.Connection:
    """
    Acquire a connection from the appropriate pool.

    For read‑only operations the replica is preferred when enabled.
    If the replica is unavailable (circuit open or acquisition error),
    the call transparently falls back to the primary.

    Parameters
    ----------
    read: bool
        If True, attempt to use the replica (when enabled). Otherwise,
        always use the primary.

    Returns
    -------
    asyncpg.Connection
        An active connection ready for queries