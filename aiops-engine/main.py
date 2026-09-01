"""AIOps Engine FastAPI Ingestion & Investigation Backend.

Includes:
- Layer 1: Ingress Rate Limiting (SlowAPI: 50 req/min per IP)
- Layer 2: PII & Secret Redaction (Regex Sanitizer)
- Layer 3: Indirect Prompt Injection Defense (<untrusted_log> + Groq Caching)
- Service Registry & Multi-Tenant Routing (Supabase PostgreSQL / SQLite fallback)
- Dynamic Ingestion Endpoints (POST /ingest-logs and POST /ingest-logs/{service_id})
- Supabase PostgreSQL persistence for logs, incidents, and agent traces
"""

import os
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import joblib
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.requests import Request

from agents.graph import create_investigation_graph
from db import get_db_engine, save_agent_traces_to_db, save_incident_to_db, save_log_to_db
from registry import (
    get_service,
    list_projects,
    list_services,
    register_project,
    register_service,
)
from utils.security import sanitize_text

# Load environment variables
load_dotenv()

# Global in-memory ring buffer (deque) holding recent 1000 logs
log_buffer: deque[dict[str, Any]] = deque(maxlen=1000)

# Global model and graph handles
ml_model: Any | None = None
investigation_graph: Any | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager to load ML model and initialize LangGraph on startup."""
    global ml_model, investigation_graph

    model_path = Path(__file__).resolve().parent / "ml" / "model.joblib"
    if model_path.exists():
        print(f"[AIOps Engine] Loading ML model from {model_path}...")
        try:
            ml_model = joblib.load(str(model_path))
            print("[AIOps Engine] ML Anomaly Detector loaded successfully.")
        except Exception as e:
            print(f"[AIOps Engine] Failed to load ML model: {e}")
    else:
        print(f"[AIOps Engine] WARNING: ML model not found at {model_path}. Run ml/train_model.py first.")

    print("[AIOps Engine] Initializing LangGraph multi-agent investigation workflow...")
    try:
        investigation_graph = create_investigation_graph(get_recent_logs_fn=lambda: list(log_buffer))
        print("[AIOps Engine] Multi-agent workflow ready.")
    except Exception as e:
        print(f"[AIOps Engine] LangGraph initialization error: {e}")


    yield

    print("[AIOps Engine] Shutting down...")


# Layer 1 Ingress Rate Limiter (50 requests/min per IP)
limiter = Limiter(key_func=get_remote_address, default_limits=["50/minute"])

app = FastAPI(
    title="AIOps Incident Response Engine",
    description="Real-time log ingestion, ML anomaly detection, and LangGraph multi-agent RCA synthesis.",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# =========================================================================
# Request & Response Schemas
# =========================================================================

class LogPayload(BaseModel):
    message: str = Field(..., description="Log line or error traceback string")
    timestamp: str | None = Field(default=None, description="ISO timestamp of the log event")
    service: str = Field(default="target-app", description="Name of emitting microservice")


class LogIngestResponse(BaseModel):
    status: str
    prediction: str
    confidence: float | None = None
    log_id: str | None = None
    incident_id: str | None = None
    rca_report: str | None = None
    metrics: dict[str, Any] | None = None


class ProjectCreatePayload(BaseModel):
    name: str = Field(..., description="Project name")
    description: str = Field(default="", description="Project description")


class ServiceCreatePayload(BaseModel):
    project_id: str = Field(..., description="Parent project UUID")
    name: str = Field(..., description="Unique microservice name (e.g. auth-service)")
    repo_url: str = Field(default="", description="GitHub repo URL")
    repo_owner: str = Field(default="", description="GitHub repo owner")
    repo_name: str = Field(default="", description="GitHub repo name")
    github_pat: str | None = Field(default=None, description="GitHub Personal Access Token")
    workspace_path: str = Field(default="", description="Local workspace folder name")


# =========================================================================
# Service Registry APIs
# =========================================================================

@app.post("/api/projects")
def api_create_project(payload: ProjectCreatePayload) -> dict[str, str]:
    """Registers a new project group in Supabase."""
    proj_id = register_project(payload.name, payload.description)
    return {"status": "created", "project_id": proj_id, "name": payload.name}


@app.get("/api/projects")
def api_list_projects() -> list[dict[str, Any]]:
    """Lists all registered projects."""
    return list_projects()


@app.post("/api/services")
def api_create_service(payload: ServiceCreatePayload) -> dict[str, str]:
    """Registers a new microservice with Fernet-encrypted GitHub PAT in Supabase."""
    service_id = register_service(
        project_id=payload.project_id,
        name=payload.name,
        repo_url=payload.repo_url,
        repo_owner=payload.repo_owner,
        repo_name=payload.repo_name,
        github_pat=payload.github_pat,
        workspace_path=payload.workspace_path,
    )
    return {
        "status": "created",
        "service_id": service_id,
        "name": payload.name,
        "ingest_url": f"/ingest-logs/{service_id}",
    }


@app.get("/api/services")
def api_list_services(project_id: str | None = None) -> list[dict[str, Any]]:
    """Lists registered microservices (PAT tokens safely masked)."""
    return list_services(project_id)


# =========================================================================
# Health & Diagnostic Endpoints
# =========================================================================

@app.get("/")
@app.head("/")
def root_status() -> dict[str, str]:
    """Root endpoint for cloud platform health probes and index status."""
    return {
        "service": "AIOps Multi-Agent Incident Response Engine",
        "status": "active",
        "docs": "/docs",
        "health": "/health",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "aiops-engine",
        "model_loaded": str(ml_model is not None),
        "database_connected": str(get_db_engine() is not None),
        "rate_limiting_active": "True",
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


# =========================================================================
# Core Ingestion Processing Pipeline
# =========================================================================

async def _process_ingested_log(
    message: str,
    timestamp: str | None,
    service_id_or_name: str = "target-app",
) -> LogIngestResponse:
    """Core log processing pipeline with PII scrubbing, ML gatekeeper, LangGraph RCA, and DB persistence."""
    # 1. Resolve Service Metadata from Registry
    svc_info = get_service(service_id_or_name)
    service_name = svc_info.get("name", service_id_or_name) if svc_info else service_id_or_name
    service_id = svc_info.get("id") if svc_info else None
    project_id = svc_info.get("project_id") if svc_info else None

    # Layer 2: Input PII & Secret Redaction BEFORE ML or LangGraph
    sanitized_message = sanitize_text(message)

    # 2. Append sanitized log to in-memory ring buffer
    log_entry = {
        "message": sanitized_message,
        "timestamp": timestamp,
        "service": service_name,
        "service_id": service_id,
    }
    log_buffer.append(log_entry)

    # 3. Run ML inference on sanitized log text
    prediction_label = "Normal"
    confidence_val: float | None = None
    is_anomaly = False

    if ml_model is not None:
        try:
            preds = ml_model.predict([sanitized_message])
            is_anomaly = bool(preds[0] == 1)
            prediction_label = "Anomaly" if is_anomaly else "Normal"

            if hasattr(ml_model, "predict_proba"):
                probs = ml_model.predict_proba([sanitized_message])[0]
                confidence_val = float(probs[1] if is_anomaly else probs[0])
        except Exception as e:
            print(f"[AIOps Engine] ML inference error: {e}")
            if "Error" in sanitized_message or "Traceback" in sanitized_message:
                is_anomaly = True
                prediction_label = "Anomaly"
    else:
        if "Error" in sanitized_message or "Traceback" in sanitized_message:
            is_anomaly = True
            prediction_label = "Anomaly"

    # 4. Persist sanitized log to Supabase
    log_id = save_log_to_db(
        message=sanitized_message,
        timestamp=timestamp,
        service=service_name,
        is_anomaly=is_anomaly,
        confidence_score=confidence_val,
    )

    # 5. Trigger LangGraph investigation workflow if anomaly detected
    rca_report_text: str | None = None
    workflow_metrics: dict[str, Any] | None = None
    incident_id: str | None = None

    if is_anomaly and investigation_graph is not None:
        print(f"[AIOps Engine] [ALERT] Anomaly in service '{service_name}'! Triggering LangGraph Workflow...")
        try:
            initial_state = {
                "log_message": sanitized_message,
                "service_id": service_id or "",
                "service_name": service_name,
                "project_id": project_id or "",
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
                mttd = (
                    workflow_metrics.get("total_workflow_latency_ms", 0.0) / 1000.0
                    if workflow_metrics
                    else None
                )
                incident_id = save_incident_to_db(
                    trigger_log_id=log_id,
                    rca_report_markdown=rca_report_text,
                    service=service_name,
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


# =========================================================================
# Ingest Endpoints (Rate-limited to 50 req/min per IP)
# =========================================================================

@app.post("/ingest-logs", response_model=LogIngestResponse)
@limiter.limit("50/minute")
async def ingest_logs(
    request: Request, payload: LogPayload, background_tasks: BackgroundTasks
) -> LogIngestResponse:
    """Standard log ingestion endpoint (defaults to service specified in payload or target-app)."""
    return await _process_ingested_log(
        message=payload.message,
        timestamp=payload.timestamp,
        service_id_or_name=payload.service,
    )


@app.post("/ingest-logs/{service_id}", response_model=LogIngestResponse)
@limiter.limit("50/minute")
async def ingest_logs_by_service_id(
    service_id: str,
    request: Request,
    payload: LogPayload,
    background_tasks: BackgroundTasks,
) -> LogIngestResponse:
    """Dynamic log drain endpoint resolving service metadata, repo URL, and encrypted credentials."""
    return await _process_ingested_log(
        message=payload.message,
        timestamp=payload.timestamp,
        service_id_or_name=service_id,
    )
