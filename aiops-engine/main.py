from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any, AsyncGenerator

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
import joblib
from pydantic import BaseModel, Field

from agents.graph import create_investigation_graph

load_dotenv()

# In-memory ring buffer (max 1000 logs)
log_buffer: deque[dict[str, Any]] = deque(maxlen=1000)

# Global model and LangGraph workflow instances
ml_model: Any = None
investigation_graph: Any = None


def get_recent_buffer_logs() -> list[dict[str, Any]]:
    """Helper for Log Analyst Agent to access current in-memory log buffer."""
    return list(log_buffer)


from db import (
    get_db_engine,
    save_agent_traces_to_db,
    save_incident_to_db,
    save_log_to_db,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager to load ML model, connect DB, and compile LangGraph on startup."""
    global ml_model, investigation_graph

    # Initialize Database Connection
    get_db_engine()

    # Load ML Model
    model_path = Path(__file__).resolve().parent / "ml" / "model.joblib"
    if model_path.exists():
        print(f"[AIOps Engine] Loading ML model from {model_path}...")
        ml_model = joblib.load(model_path)
        print("[AIOps Engine] ML Anomaly Detector loaded successfully.")
    else:
        print(f"[AIOps Engine] WARNING: ML model not found at {model_path}. Please run ml/train_model.py")

    # Initialize LangGraph Agent Workflow
    print("[AIOps Engine] Initializing LangGraph multi-agent investigation workflow...")
    investigation_graph = create_investigation_graph(get_recent_logs_fn=get_recent_buffer_logs)
    print("[AIOps Engine] Multi-agent workflow ready.")

    yield

    print("[AIOps Engine] Shutting down...")


app = FastAPI(
    title="AIOps Incident Response Engine",
    description="Real-time log ingestion, ML anomaly detection, and LangGraph multi-agent RCA synthesis.",
    version="1.0.0",
    lifespan=lifespan,
)


class LogPayload(BaseModel):
    message: str = Field(..., description="Log line or error traceback string")
    timestamp: str | None = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp of the log event",
    )
    service: str = Field(default="target-app", description="Source microservice name")


class LogIngestResponse(BaseModel):
    status: str
    prediction: str
    confidence: float | None = None
    log_id: str | None = None
    incident_id: str | None = None
    rca_report: str | None = None
    metrics: dict[str, Any] | None = None



@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "aiops-engine",
        "model_loaded": str(ml_model is not None),
        "database_connected": str(get_db_engine() is not None),
        "buffer_size": str(len(log_buffer)),
    }


@app.get("/buffer")
def get_buffer(limit: int = 50) -> dict[str, Any]:
    """Returns the most recent logs stored in the in-memory ring buffer."""
    logs_slice = list(log_buffer)[-limit:]
    return {
        "total_buffered": len(log_buffer),
        "returned": len(logs_slice),
        "logs": logs_slice,
    }


@app.post("/ingest-logs", response_model=LogIngestResponse)
async def ingest_logs(
    payload: LogPayload, background_tasks: BackgroundTasks
) -> LogIngestResponse:
    """Receives forwarded logs, runs ML classification, and triggers agents upon anomaly detection."""
    # 1. Append incoming log to in-memory ring buffer
    log_entry = {
        "message": payload.message,
        "timestamp": payload.timestamp,
        "service": payload.service,
    }
    log_buffer.append(log_entry)

    # 2. Run ML inference
    prediction_label = "Normal"
    confidence_val: float | None = None
    is_anomaly = False

    if ml_model is not None:
        try:
            preds = ml_model.predict([payload.message])
            is_anomaly = bool(preds[0] == 1)
            prediction_label = "Anomaly" if is_anomaly else "Normal"

            if hasattr(ml_model, "predict_proba"):
                probs = ml_model.predict_proba([payload.message])[0]
                confidence_val = float(probs[1] if is_anomaly else probs[0])
        except Exception as e:
            print(f"[AIOps Engine] ML inference error: {e}")
            if "Error" in payload.message or "Traceback" in payload.message:
                is_anomaly = True
                prediction_label = "Anomaly"
    else:
        # Fallback if model is not loaded yet
        if "Error" in payload.message or "Traceback" in payload.message:
            is_anomaly = True
            prediction_label = "Anomaly"

    # 3. Persist log to Supabase
    log_id = save_log_to_db(
        message=payload.message,
        timestamp=payload.timestamp,
        service=payload.service,
        is_anomaly=is_anomaly,
        confidence_score=confidence_val,
    )

    # 4. Trigger LangGraph investigation workflow if anomaly detected
    rca_report_text: str | None = None
    workflow_metrics: dict[str, Any] | None = None
    incident_id: str | None = None

    if is_anomaly and investigation_graph is not None:
        print("[AIOps Engine] [ALERT] Anomaly detected! Triggering LangGraph Multi-Agent Workflow...")
        try:
            initial_state = {
                "log_message": payload.message,
                "related_logs": "",
                "code_context": "",
                "rca_report": "",
                "metrics": {},
            }
            final_state = investigation_graph.invoke(initial_state)
            rca_report_text = final_state.get("rca_report")
            workflow_metrics = final_state.get("metrics")

            # Persist Incident & Agent Traces to Supabase
            if rca_report_text:
                mttd = workflow_metrics.get("total_workflow_latency_ms", 0.0) / 1000.0 if workflow_metrics else None
                incident_id = save_incident_to_db(
                    trigger_log_id=log_id,
                    rca_report_markdown=rca_report_text,
                    service=payload.service,
                    severity="High",
                    mttd_seconds=mttd,
                )
                if incident_id and workflow_metrics:
                    save_agent_traces_to_db(incident_id, workflow_metrics)

        except Exception as e:
            print(f"[AIOps Engine] Agent execution error: {e}")
            rca_report_text = f"Agent workflow encountered an error: {e}"

    return LogIngestResponse(
        status="received",
        prediction=prediction_label,
        confidence=confidence_val,
        log_id=log_id,
        incident_id=incident_id,
        rca_report=rca_report_text,
        metrics=workflow_metrics,
    )


