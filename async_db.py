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
#   DB_POOL_SIZE             – max connections per pool (default: 10)
#   READ_REPLICA_ENABLED     – "true"/"false" (default: true)
#   CIRCUIT_FAILURE_THRESHOLD – failures before opening circuit (default: 5)
#   CIRCUIT_COOLDOWN_SECONDS  – seconds to stay open (default: 30)
# --------------------------------------------------------------

import os
import asyncio
import logging
import time
from typing import Optional

import asyncpg

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------
_logger = logging.getLogger(__name__)

_PRIMARY_DSN = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST_PRIMARY')}/{os.getenv('DB_NAME')}"
)

_REPLICA_DSN = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST_REPLICA')}/{os.getenv('DB_NAME')}"
)

_POOL_MAX_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
_READ_REPLICA_ENABLED = os.getenv("READ_REPLICA_ENABLED", "true").lower() == "true"

_CIRCUIT_FAILURE_THRESHOLD = int(os.getenv("CIRCUIT_FAILURE_THRESHOLD", "5"))
_CIRCUIT_COOLDOWN_SECONDS = int(os.getenv("CIRCUIT_COOLDOWN_SECONDS", "30"))

# ----------------------------------------------------------------------
# Circuit Breaker
# ----------------------------------------------------------------------
class CircuitBreaker:
    """Simple async‑compatible circuit breaker."""

    def __init__(self, failure_threshold: int, cooldown: int):
        self._failure_threshold = failure_threshold
        self._cooldown = cooldown
        self._failure_count = 0
        self._state = "CLOSED"          # CLOSED, OPEN, HALF_OPEN
        self._opened_at: Optional[float] = None
        self._lock = asyncio.Lock()

    async def call(self, coro):
        async with self._lock:
            if self._state == "OPEN":
                if time.time() - self._opened_at >= self._cooldown:
                    self._state = "HALF_OPEN"
                    _logger.info("Circuit breaker transitioning to HALF_OPEN")
                else:
                    raise RuntimeError("Circuit breaker is OPEN")
        try:
            result = await coro()
        except Exception as exc:
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
    func,
    *,
    retries: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 2.0,
    jitter: bool = True,
):
    """Retry an async callable with exponential back‑off."""
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
                delay *= (0.5 + 0.5 * asyncio.get_event_loop().time() % 1)
            _logger.warning(
                "Retry %d/%d after %0.2fs due to %s", attempt, retries, delay, exc
            )
            await asyncio.sleep(delay)


# ----------------------------------------------------------------------
# Pool initialization / teardown
# ----------------------------------------------------------------------
async def init_pools():
    """Create connection pools for primary and (optionally) replica."""
    global _primary_pool, _replica_pool

    if not _PRIMARY_DSN:
        raise RuntimeError("Primary DSN is not configured")

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


async def close_pools():
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
# Public API
# ----------------------------------------------------------------------
async def acquire_connection(read: bool = False) -> asyncpg.Connection:
    """
    Acquire a connection from the appropriate pool.

    Parameters
    ----------
    read: bool
        If True, attempt to use the replica (when enabled). Otherwise,
        always use the primary.

    Returns
    -------
    asyncpg.Connection
        An active connection ready for queries.
    """
    if read and _READ_REPLICA_ENABLED and _replica_pool:
        cb = _replica_cb
        pool = _replica_pool
    else:
        cb = _primary_cb
        pool = _primary_pool

    if not pool:
        raise RuntimeError("Requested DB pool is not initialized")

    async def _acquire():
        return await pool.acquire()

    # Apply circuit‑breaker and retry logic
    conn = await cb.call(lambda: _retry_with_backoff(_acquire))
    return conn


async def release_connection(conn: asyncpg.Connection, read: bool = False):
    """
    Release a previously acquired connection back to its pool.

    Parameters
    ----------
    conn: asyncpg.Connection
        The connection to release.
    read: bool
        Must match the `read` flag used in `acquire_connection`.
    """
    if read and _READ_REPLICA_ENABLED and _replica_pool:
        pool = _replica_pool
    else:
        pool = _primary_pool

    if not pool:
        _logger.error("Attempted to release connection to a non‑existent pool")
        return

    await pool.release(conn)


# ----------------------------------------------------------------------
# Context manager helpers
# ----------------------------------------------------------------------
class connection:
    """
    Async context manager for acquiring/releasing a DB connection.

    Usage
    -----
    async with connection(read=True) as conn:
        await conn.fetch(...)
    """

    def __init__(self, *, read: bool = False):
        self._read = read
        self._conn: Optional[asyncpg.Connection] = None