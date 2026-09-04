import json
import logging
import os
import re
from typing import Any
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

load_dotenv()
logger = logging.getLogger("aiops-db")

_db_engine: Engine | None = None


def get_db_engine() -> Engine | None:
    """Returns SQLAlchemy Engine singleton or None if DATABASE_URL is not set."""
    global _db_engine
    if _db_engine is not None:
        return _db_engine

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        return None

    try:
        # Support postgres:// URL format for SQLAlchemy
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)

        _db_engine = create_engine(
            db_url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 10},
        )
        # Test connection
        with _db_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[AIOps Database] Supabase PostgreSQL connected successfully.")
        return _db_engine
    except Exception as e:
        print(f"[AIOps Database] WARNING: Failed to connect to Supabase: {e}")
        _db_engine = None
        return None


def parse_rca_metadata(rca_markdown: str) -> dict[str, Any]:
    """Extracts summary, exception type, faulty file, and action items from RCA Markdown."""
    summary = "Runtime anomaly diagnosed by AIOps agent."
    detected_exception = "UnknownException"
    faulty_file = "target-app/main.py"
    immediate_fixes: list[dict[str, Any]] = []
    long_term_fixes: list[dict[str, Any]] = []

    try:
        # Extract exception type
        exc_match = re.search(r"\[([A-Za-z0-9_]+Error)\]|([A-Za-z0-9_]+Error):", rca_markdown)
        if exc_match:
            detected_exception = exc_match.group(1) or exc_match.group(2)

        # Extract summary
        summary_match = re.search(r"\*\*Incident Summary\*\*:\s*([^\n]+)", rca_markdown, re.IGNORECASE)
        if summary_match:
            summary = summary_match.group(1).strip()

        # Extract faulty file
        file_match = re.search(r"([a-zA-Z0-9_\-]+\.py)", rca_markdown)
        if file_match:
            faulty_file = file_match.group(1)

        # Parse immediate fixes
        imm_section = re.search(r"###?\s*5\.1\s*Immediate[^\n]*\n(.*?)(?=###?\s*5\.2|\Z)", rca_markdown, re.DOTALL | re.IGNORECASE)
        if imm_section:
            for line in imm_section.group(1).splitlines():
                clean = line.strip().lstrip("-* ").strip()
                if clean and not clean.startswith("|") and len(clean) > 5:
                    immediate_fixes.append({"task": clean, "done": False})

        # Parse long term prevention
        lt_section = re.search(r"###?\s*5\.2\s*Long[^\n]*\n(.*?)(?=###?\s*5\.3|\Z|##\s*6)", rca_markdown, re.DOTALL | re.IGNORECASE)
        if lt_section:
            for line in lt_section.group(1).splitlines():
                clean = line.strip().lstrip("-* ").strip()
                if clean and not clean.startswith("|") and len(clean) > 5:
                    long_term_fixes.append({"task": clean, "done": False})

    except Exception as e:
        logger.warning(f"Error parsing RCA markdown metadata: {e}")

    return {
        "summary": summary,
        "detected_exception": detected_exception,
        "faulty_file": faulty_file,
        "immediate_fixes": immediate_fixes,
        "long_term_fixes": long_term_fixes,
    }


def save_log_to_db(
    message: str,
    timestamp: str | None,
    service: str = "target-app",
    is_anomaly: bool = False,
    confidence_score: float | None = None,
) -> str | None:
    """Persists a log entry into the Supabase 'logs' table and returns its UUID."""
    engine = get_db_engine()
    if not engine:
        return None

    query = text(
        """
        INSERT INTO logs (timestamp, service, message, is_anomaly, confidence_score)
        VALUES (COALESCE(CAST(:timestamp AS TIMESTAMPTZ), NOW()), :service, :message, :is_anomaly, :confidence)
        RETURNING id;
        """
    )


    try:
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "timestamp": timestamp,
                    "service": service,
                    "message": message,
                    "is_anomaly": is_anomaly,
                    "confidence": confidence_score,
                },
            )
            row = result.fetchone()
            return str(row[0]) if row else None
    except Exception as e:
        print(f"[AIOps Database] Error saving log to Supabase: {e}")
        return None


def save_incident_to_db(
    trigger_log_id: str | None,
    rca_report_markdown: str,
    service: str = "target-app",
    severity: str = "High",
    mttd_seconds: float | None = None,
) -> str | None:
    """Persists a new incident and its full AI RCA report into the 'incidents' table."""
    engine = get_db_engine()
    if not engine:
        return None

    meta = parse_rca_metadata(rca_report_markdown)

    query = text(
        """
        INSERT INTO incidents (
            trigger_log_id,
            service,
            severity,
            status,
            incident_summary,
            detected_exception,
            faulty_file,
            rca_report_markdown,
            immediate_fixes,
            long_term_prevention,
            mttd_seconds
        )
        VALUES (
            :trigger_log_id,
            :service,
            :severity,
            'Open',
            :summary,
            :detected_exception,
            :faulty_file,
            :rca_report_markdown,
            CAST(:immediate_fixes AS JSONB),
            CAST(:long_term_prevention AS JSONB),
            :mttd_seconds
        )
        RETURNING id;
        """
    )
    try:
        with engine.begin() as conn:
            result = conn.execute(
                query,
                {
                    "trigger_log_id": trigger_log_id,
                    "service": service,
                    "severity": severity,
                    "summary": meta["summary"],
                    "detected_exception": meta["detected_exception"],
                    "faulty_file": meta["faulty_file"],
                    "rca_report_markdown": rca_report_markdown,
                    "immediate_fixes": json.dumps(meta["immediate_fixes"]),
                    "long_term_prevention": json.dumps(meta["long_term_fixes"]),
                    "mttd_seconds": mttd_seconds,
                },
            )
            row = result.fetchone()
            incident_id = str(row[0]) if row else None
            print(f"[AIOps Database] Incident successfully recorded in Supabase: ID={incident_id}")
            return incident_id
    except Exception as e:
        print(f"[AIOps Database] Error saving incident to Supabase: {e}")
        return None


def save_agent_traces_to_db(
    incident_id: str, metrics: dict[str, Any]
) -> None:
    """Persists per-node latency and token accounting into the 'agent_traces' table."""
    engine = get_db_engine()
    if not engine or not incident_id or not metrics:
        return

    query = text(
        """
        INSERT INTO agent_traces (
            incident_id,
            node_name,
            latency_ms,
            input_tokens,
            output_tokens,
            total_tokens,
            model_name,
            mcp_tools_invoked
        )
        VALUES (
            :incident_id,
            :node_name,
            :latency_ms,
            :input_tokens,
            :output_tokens,
            :total_tokens,
            :model_name,
            CAST(:mcp_tools_invoked AS JSONB)
        );
        """
    )

    try:
        with engine.begin() as conn:
            for node_key in ["log_analyst", "code_investigator", "rca_synthesizer"]:
                node_data = metrics.get(node_key)
                if not isinstance(node_data, dict):
                    continue

                tok_usage = node_data.get("token_usage", {})
                conn.execute(
                    query,
                    {
                        "incident_id": incident_id,
                        "node_name": node_data.get("node", node_key),
                        "latency_ms": node_data.get("latency_ms", 0.0),
                        "input_tokens": tok_usage.get("input_tokens", 0),
                        "output_tokens": tok_usage.get("output_tokens", 0),
                        "total_tokens": tok_usage.get("total_tokens", 0),
                        "model_name": node_data.get("model", "N/A"),
                        "mcp_tools_invoked": json.dumps(node_data.get("mcp_tools_invoked", [])),
                    },
                )
        print(f"[AIOps Database] Agent traces persisted for incident ID={incident_id}")
    except Exception as e:
        print(f"[AIOps Database] Error saving agent traces: {e}")


def get_incidents(limit: int = 50, service: str | None = None) -> list[dict[str, Any]]:
    """Retrieves recent incidents from Supabase PostgreSQL with optional service filtering."""
    engine = get_db_engine()
    if not engine:
        return []

    try:
        with engine.connect() as conn:
            if service:
                query = text(
                    """
                    SELECT id, service, severity, status, incident_summary, detected_exception, faulty_file, mttd_seconds, created_at
                    FROM incidents
                    WHERE service = :service
                    ORDER BY created_at DESC
                    LIMIT :limit;
                    """
                )
                result = conn.execute(query, {"service": service, "limit": limit})
            else:
                query = text(
                    """
                    SELECT id, service, severity, status, incident_summary, detected_exception, faulty_file, mttd_seconds, created_at
                    FROM incidents
                    ORDER BY created_at DESC
                    LIMIT :limit;
                    """
                )
                result = conn.execute(query, {"limit": limit})

            rows = []
            for row in result.fetchall():
                data = dict(row._mapping)
                data["id"] = str(data["id"])
                rows.append(data)
            return rows
    except Exception as e:
        print(f"[AIOps Database] Error fetching incidents: {e}")
        return []


def get_incident_by_id(incident_id: str) -> dict[str, Any] | None:
    """Retrieves full incident details including 5-section Markdown RCA and agent traces."""
    engine = get_db_engine()
    if not engine:
        return None

    try:
        with engine.connect() as conn:
            # 1. Fetch incident record
            inc_query = text(
                """
                SELECT id, trigger_log_id, service, severity, status, incident_summary,
                       detected_exception, faulty_file, rca_report_markdown,
                       immediate_fixes, long_term_prevention, mttd_seconds, mttr_seconds, created_at, resolved_at
                FROM incidents
                WHERE id = CAST(:id AS UUID)
                LIMIT 1;
                """
            )
            inc_res = conn.execute(inc_query, {"id": incident_id}).fetchone()
            if not inc_res:
                return None

            incident = dict(inc_res._mapping)
            incident["id"] = str(incident["id"])
            if incident.get("trigger_log_id"):
                incident["trigger_log_id"] = str(incident["trigger_log_id"])

            # 2. Fetch agent traces
            trace_query = text(
                """
                SELECT id, node_name, latency_ms, input_tokens, output_tokens, total_tokens, model_name, mcp_tools_invoked, created_at
                FROM agent_traces
                WHERE incident_id = CAST(:id AS UUID)
                ORDER BY created_at ASC;
                """
            )
            trace_res = conn.execute(trace_query, {"id": incident_id}).fetchall()
            incident["traces"] = [dict(t._mapping) for t in trace_res]
            for t in incident["traces"]:
                t["id"] = str(t["id"])

            return incident
    except Exception as e:
        print(f"[AIOps Database] Error fetching incident {incident_id}: {e}")
        return None


def update_incident_status(
    incident_id: str,
    status: str | None = None,
    immediate_fixes: list[dict[str, Any]] | None = None,
    long_term_prevention: list[dict[str, Any]] | None = None,
) -> bool:
    """Updates incident status or remediation checklists in Supabase."""
    engine = get_db_engine()
    if not engine:
        return False

    try:
        with engine.begin() as conn:
            updates = []
            params: dict[str, Any] = {"id": incident_id}

            if status:
                updates.append("status = :status")
                params["status"] = status
                if status.lower() == "resolved":
                    updates.append("resolved_at = NOW()")

            if immediate_fixes is not None:
                updates.append("immediate_fixes = CAST(:immediate_fixes AS JSONB)")
                params["immediate_fixes"] = json.dumps(immediate_fixes)

            if long_term_prevention is not None:
                updates.append("long_term_prevention = CAST(:long_term_prevention AS JSONB)")
                params["long_term_prevention"] = json.dumps(long_term_prevention)

            if not updates:
                return True

            query = text(
                f"""
                UPDATE incidents
                SET {', '.join(updates)}
                WHERE id = CAST(:id AS UUID);
                """
            )
            conn.execute(query, params)
            return True
    except Exception as e:
        print(f"[AIOps Database] Error updating incident {incident_id}: {e}")
        return False


# =========================================================================
# User Accounts & Authentication Layer (Supabase PostgreSQL)
# =========================================================================

import hashlib
import hmac
import time


def _ensure_users_table() -> None:
    """Ensures the users table exists in Supabase PostgreSQL."""
    engine = get_db_engine()
    if not engine:
        return
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email TEXT UNIQUE NOT NULL,
                        username TEXT NOT NULL,
                        full_name TEXT,
                        password_hash TEXT NOT NULL,
                        github_pat_encrypted TEXT,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                    """
                )
            )
    except Exception as e:
        print(f"[AIOps Database] Notice: users table verification: {e}")


def _hash_password(password: str) -> str:
    """Hashes password with SHA-256 and constant salt."""
    salt = "aiops_enterprise_salt_2026"
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def create_user_in_db(
    email: str, username: str, password: str, full_name: str | None = None
) -> dict[str, Any]:
    """Registers a new user in Supabase PostgreSQL. Raises ValueError if email exists."""
    _ensure_users_table()
    engine = get_db_engine()
    if not engine:
        raise RuntimeError("Database connection unavailable.")

    clean_email = email.strip().lower()
    clean_username = username.strip()

    # Check if user already exists
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM users WHERE email = :email LIMIT 1"),
            {"email": clean_email},
        ).fetchone()
        if existing:
            raise ValueError(f"An account with email '{clean_email}' already exists. Please sign in.")

    pw_hash = _hash_password(password)
    with engine.begin() as conn:
        res = conn.execute(
            text(
                """
                INSERT INTO users (email, username, full_name, password_hash, created_at)
                VALUES (:email, :username, :full_name, :password_hash, NOW())
                RETURNING id, email, username, full_name, created_at;
                """
            ),
            {
                "email": clean_email,
                "username": clean_username,
                "full_name": full_name or clean_username,
                "password_hash": pw_hash,
            },
        ).fetchone()

        if res:
            row = dict(res._mapping)
            row["id"] = str(row["id"])
            if "created_at" in row and row["created_at"]:
                row["created_at"] = str(row["created_at"])
            return row

    raise RuntimeError("Failed to create user account.")


def authenticate_user_in_db(email_or_username: str, password: str) -> dict[str, Any]:
    """Verifies user credentials in Supabase PostgreSQL."""
    _ensure_users_table()
    engine = get_db_engine()
    if not engine:
        raise RuntimeError("Database connection unavailable.")

    identifier = email_or_username.strip().lower()
    pw_hash = _hash_password(password)

    with engine.connect() as conn:
        user_row = conn.execute(
            text(
                """
                SELECT id, email, username, full_name, password_hash, created_at
                FROM users
                WHERE LOWER(email) = :id OR LOWER(username) = :id
                LIMIT 1;
                """
            ),
            {"id": identifier},
        ).fetchone()

        if not user_row:
            raise ValueError(f"No account found with email or username '{email_or_username}'.")

        data = dict(user_row._mapping)
        if data["password_hash"] != pw_hash:
            raise ValueError("Incorrect password. Please try again.")

        data["id"] = str(data["id"])
        data.pop("password_hash", None)
        if "created_at" in data and data["created_at"]:
            data["created_at"] = str(data["created_at"])
        return data


def generate_user_session(user_dict: dict[str, Any]) -> dict[str, Any]:
    """Generates a 24-hour signed authentication session token for the user."""
    user_id = str(user_dict.get("id", "00000000-0000-0000-0000-000000000000"))
    expires_at_sec = int(time.time()) + (24 * 3600)
    secret = os.getenv("SECRET_KEY", "aiops_session_signature_secret_2026")
    msg = f"{user_id}:{expires_at_sec}"
    sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()
    token = f"{user_id}.{expires_at_sec}.{sig}"
    return {
        "user": user_dict,
        "token": token,
        "expires_at": expires_at_sec * 1000,
    }


def verify_user_token(token: str) -> dict[str, Any]:
    """Validates a signed 24-hour auth token and returns user details and expiration."""
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            raise ValueError("Malformed authentication token.")

        user_id, exp_str, sig = parts
        exp_sec = int(exp_str)
        now_sec = int(time.time())

        if now_sec > exp_sec:
            raise ValueError("Authentication token has expired (24-hour limit exceeded).")

        secret = os.getenv("SECRET_KEY", "aiops_session_signature_secret_2026")
        msg = f"{user_id}:{exp_sec}"
        expected_sig = hmac.new(secret.encode("utf-8"), msg.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Invalid authentication token signature.")

        # Look up user in database if engine is available
        engine = get_db_engine()
        if engine:
            try:
                with engine.connect() as conn:
                    user_row = conn.execute(
                        text("SELECT id, email, username, full_name, created_at FROM users WHERE CAST(id AS TEXT) = :uid LIMIT 1"),
                        {"uid": user_id},
                    ).fetchone()
                    if user_row:
                        data = dict(user_row._mapping)
                        data["id"] = str(data["id"])
                        if "created_at" in data and data["created_at"]:
                            data["created_at"] = str(data["created_at"])
                        return {
                            "status": "valid",
                            "user": data,
                            "token": token,
                            "expires_at": exp_sec * 1000,
                            "expires_in_hours": round((exp_sec - now_sec) / 3600, 2),
                        }
            except Exception as db_err:
                print(f"[AIOps Database] Token DB lookup notice: {db_err}")

        # Fallback for demo account or offline state
        return {
            "status": "valid",
            "user": {
                "id": user_id,
                "username": "sre_lead",
                "full_name": "SRE Lead Analyst",
                "email": "lead@aiops.corp",
            },
            "token": token,
            "expires_at": exp_sec * 1000,
            "expires_in_hours": round((exp_sec - now_sec) / 3600, 2),
        }
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}")



