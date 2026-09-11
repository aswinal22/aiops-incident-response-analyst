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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.requests import Request

from agents.graph import create_investigation_graph
from db import (
    authenticate_user_in_db,
    create_user_in_db,
    generate_user_session,
    get_db_engine,
    get_incident_by_id,
    get_incidents,
    save_agent_traces_to_db,
    save_incident_to_db,
    save_log_to_db,
    update_incident_status,
    verify_user_token,
)
from registry import (
    delete_project,
    delete_service,
    get_service,
    init_registry_db,
    list_projects,
    list_services,
    register_project,
    register_service,
)
from utils.github_pr import create_remediation_pull_request
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

    print("[AIOps Engine] Initializing database mapping tables...")
    try:
        init_registry_db()
    except Exception as e:
        print(f"[AIOps Engine] Registry init notice: {e}")

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
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """User-friendly 429 response when rate limit is exceeded."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait a moment before trying again."},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats Pydantic 422 validation errors into clear human-readable messages."""
    error_messages = []
    for error in exc.errors():
        loc_parts = [str(x) for x in error.get("loc", []) if x not in ("body",)]
        field_name = " ".join(loc_parts).replace("_", " ").title() if loc_parts else "Field"
        msg = error.get("msg", "Invalid value")
        error_messages.append(f"{field_name}: {msg}")
    detail = "; ".join(error_messages) if error_messages else "The submitted data is invalid. Please check your inputs."
    return JSONResponse(
        status_code=422,
        content={"detail": detail},
    )

# CORS Middleware (permits Vercel, localhost, and custom cloud frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    user_id: str | None = Field(default=None, description="Optional creator User UUID for tenant isolation")


class UserSignupPayload(BaseModel):
    email: str = Field(..., description="User email address")
    username: str = Field(..., description="Username identifier")
    password: str = Field(..., description="Account password")
    full_name: str | None = Field(default=None, description="Full display name")


class UserLoginPayload(BaseModel):
    email_or_username: str = Field(..., description="Email address or username")
    password: str = Field(..., description="Account password")


class TokenVerifyPayload(BaseModel):
    token: str = Field(..., description="24-hour signed session token")


class ErrorSimulatePayload(BaseModel):
    error_type: str = Field(default="file_not_found", description="Type of error to simulate (file_not_found, zero_division, database_timeout)")
    service: str = Field(default="target-app", description="Name or UUID of emitting microservice")


class IncidentUpdatePayload(BaseModel):
    status: str | None = Field(default=None, description="Updated status: Open, In Progress, Resolved")
    immediate_fixes: list[dict[str, Any]] | None = Field(default=None, description="Checklist of immediate fixes")
    long_term_prevention: list[dict[str, Any]] | None = Field(default=None, description="Checklist of long term prevention tasks")


class UrlIngestPayload(BaseModel):
    url: str = Field(..., description="HTTP(S) URL pointing to a raw log file or log stream")
    service: str = Field(default="target-app", description="Name or UUID of emitting microservice")


# =========================================================================
# User Accounts & Authentication APIs
# =========================================================================

@app.post("/api/auth/signup")
def api_auth_signup(payload: UserSignupPayload) -> dict[str, Any]:
    """Registers a new SRE user in Supabase PostgreSQL and returns 24-hour session."""
    try:
        user = create_user_in_db(
            email=payload.email,
            username=payload.username,
            password=payload.password,
            full_name=payload.full_name,
        )
        session = generate_user_session(user)
        return {
            "status": "success",
            "user": session["user"],
            "token": session["token"],
            "expires_at": session["expires_at"],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[AIOps Auth] Registration error: {e}")
        raise HTTPException(status_code=500, detail="Unable to complete registration. Please try again.")


@app.post("/api/auth/login")
def api_auth_login(payload: UserLoginPayload) -> dict[str, Any]:
    """Authenticates an SRE user against Supabase PostgreSQL and returns 24-hour session."""
    try:
        user = authenticate_user_in_db(
            email_or_username=payload.email_or_username,
            password=payload.password,
        )
        session = generate_user_session(user)
        return {
            "status": "success",
            "user": session["user"],
            "token": session["token"],
            "expires_at": session["expires_at"],
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        print(f"[AIOps Auth] Login error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service is temporarily unavailable. Please try again.")


@app.post("/api/auth/verify")
def api_auth_verify(payload: TokenVerifyPayload) -> dict[str, Any]:
    """Validates an SRE user's 24-hour authentication session token."""
    try:
        res = verify_user_token(payload.token)
        return res
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        print(f"[AIOps Auth] Verify error: {e}")
        raise HTTPException(status_code=500, detail="Session verification failed. Please sign in again.")



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
    proj_id = register_project(payload.name, payload.description, payload.user_id)
    return {"status": "created", "project_id": proj_id, "name": payload.name}


@app.get("/api/projects")
def api_list_projects(user_id: str | None = None) -> list[dict[str, Any]]:
    """Lists registered projects, optionally filtered by user_id."""
    return list_projects(user_id)


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


@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: str) -> dict[str, str]:
    """Deletes a project and its scoped services."""
    success = delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found or could not be deleted.")
    return {"status": "deleted", "project_id": project_id}


@app.delete("/api/services/{service_id}")
def api_delete_service(service_id: str) -> dict[str, str]:
    """Deletes a microservice by ID or name."""
    success = delete_service(service_id)
    if not success:
        raise HTTPException(status_code=404, detail="Service not found or could not be deleted.")
    return {"status": "deleted", "service_id": service_id}


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
@app.get("/api/health")
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
    trigger_rca: bool = True,
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

    if is_anomaly and trigger_rca and investigation_graph is not None:
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


# =========================================================================
# Outage Simulator & Incident Management APIs
# =========================================================================

@app.post("/api/simulate-error")
async def api_simulate_error(payload: ErrorSimulatePayload) -> LogIngestResponse:
    """Simulates realistic microservice failure tracebacks and processes them through the AIOps pipeline."""
    now_iso = datetime.now(timezone.utc).isoformat()
    service_name = payload.service or "target-app"
    err_type = (payload.error_type or "").lower()

    if "file" in err_type:
        traceback_msg = (
            f"[{now_iso}] [ERROR] [{service_name}] Simulated Application Failure [FileNotFoundError]: "
            f"Configuration file '/app/config/settings.yaml' not found in path.\n"
            f"Traceback (most recent call last):\n"
            f'  File "/app/{service_name}/main.py", line 39, in simulate_error\n'
            f'    raise FileNotFoundError("Configuration file \'/app/config/settings.yaml\' not found in path.")\n'
            f"FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path."
        )
    elif "zero" in err_type or "div" in err_type:
        traceback_msg = (
            f"[{now_iso}] [ERROR] [{service_name}] Simulated Application Failure [ZeroDivisionError]: division by zero\n"
            f"Traceback (most recent call last):\n"
            f'  File "/app/{service_name}/services/calculator.py", line 43, in calculate_user_discount\n'
            f"    return total_amount / discount_factor\n"
            f"ZeroDivisionError: division by zero"
        )
    elif "db" in err_type or "time" in err_type or "data" in err_type:
        traceback_msg = (
            f"[{now_iso}] [ERROR] [{service_name}] Simulated Application Failure [TimeoutError]: "
            f"Database connection timed out after 30000ms: host=db-replica-1.internal:5432\n"
            f"Traceback (most recent call last):\n"
            f'  File "/app/{service_name}/db/pool.py", line 47, in acquire_connection\n'
            f'    raise TimeoutError("Database connection timed out after 30000ms: host=db-replica-1.internal:5432")\n'
            f"TimeoutError: Database connection timed out after 30000ms: host=db-replica-1.internal:5432"
        )
    else:
        traceback_msg = (
            f"[{now_iso}] [ERROR] [{service_name}] Simulated Application Failure [RuntimeError]: "
            f"Unhandled exception encountered in service worker.\n"
            f"Traceback (most recent call last):\n"
            f'  File "/app/{service_name}/main.py", line 99, in process_event\n'
            f'    raise RuntimeError("Unhandled service exception occurred.")\n'
            f"RuntimeError: Unhandled service exception occurred."
        )

    return await _process_ingested_log(
        message=traceback_msg,
        timestamp=now_iso,
        service_id_or_name=payload.service,
    )


@app.get("/api/incidents")
def api_get_incidents(service: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    """Retrieves recent incidents from Supabase PostgreSQL with optional service filtering."""
    return get_incidents(limit=limit, service=service)


@app.get("/api/incidents/{incident_id}")
def api_get_incident_by_id(incident_id: str) -> dict[str, Any]:
    """Retrieves full incident details including 5-section Markdown RCA and agent traces."""
    inc = get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")
    return inc


@app.patch("/api/incidents/{incident_id}")
def api_update_incident(incident_id: str, payload: IncidentUpdatePayload) -> dict[str, Any]:
    """Updates incident status or remediation checklists in Supabase."""
    success = update_incident_status(
        incident_id=incident_id,
        status=payload.status,
        immediate_fixes=payload.immediate_fixes,
        long_term_prevention=payload.long_term_prevention,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Failed to update incident.")
    return {"status": "updated", "incident_id": incident_id}


@app.post("/api/incidents/{incident_id}/create-remediation-pr")
async def api_create_remediation_pr(incident_id: str) -> dict[str, Any]:
    """Generates a targeted code patch, creates a fix branch, and opens a GitHub Pull Request for the incident."""
    inc = get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found.")

    service_name = inc.get("service") or "aiops-incident-response-analyst"
    svc_info = get_service(service_name) or {"name": service_name}

    res = await create_remediation_pull_request(svc_info, inc)
    return res


@app.post("/api/ingest-from-url")
async def api_ingest_from_url(payload: UrlIngestPayload) -> dict[str, Any]:
    """Fetches remote log stream from a URL, executes ML anomaly detection, and streams to buffer and Supabase."""
    clean_url = payload.url.strip()
    if not clean_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format. Must begin with http:// or https://")

    try:
        import httpx
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(clean_url)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch logs from URL: HTTP {response.status_code}",
                )
            text_content = response.text
    except HTTPException:
        raise
    except Exception as e:
        print(f"[AIOps Ingest URL Error] {e}")
        raise HTTPException(status_code=400, detail="Unable to connect to log stream URL. Please verify the URL is valid and accessible.")

    raw_lines = [l for l in text_content.splitlines() if l.strip()]
    if not raw_lines:
        return {"status": "success", "url": clean_url, "total_processed": 0, "anomalies_detected": 0, "results": []}

    # Group logical log lines and multiline Python tracebacks (capped to 30 logs per batch)
    log_blocks: list[str] = []
    current_block: list[str] = []

    for line in raw_lines[:30]:  # Protect against massive file ingest & fast response
        if line.startswith(("Traceback", "  File ", "    ", "ZeroDivisionError", "FileNotFoundError", "TimeoutError", "ValueError", "Exception")):
            current_block.append(line)
        else:
            if current_block:
                log_blocks.append("\n".join(current_block))
                current_block = []
            current_block.append(line)
    if current_block:
        log_blocks.append("\n".join(current_block))

    processed_results: list[dict[str, Any]] = []
    anomaly_count = 0
    rca_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for block in log_blocks:
        # Only trigger full LangGraph synthesis for the first anomaly in the batch to avoid Groq rate limits
        should_trigger_rca = (rca_count < 1)
        res = await _process_ingested_log(
            message=block,
            timestamp=now_iso,
            service_id_or_name=payload.service,
            trigger_rca=should_trigger_rca,
        )
        if res.prediction == "Anomaly":
            anomaly_count += 1
            if res.incident_id:
                rca_count += 1

        processed_results.append({
            "message": block[:120] + ("..." if len(block) > 120 else ""),
            "prediction": res.prediction,
            "confidence": res.confidence,
            "incident_id": res.incident_id,
        })

    return {
        "status": "success",
        "url": clean_url,
        "service": payload.service,
        "total_processed": len(processed_results),
        "anomalies_detected": anomaly_count,
        "results": processed_results,
    }
