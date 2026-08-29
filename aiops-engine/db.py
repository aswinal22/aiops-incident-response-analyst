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

