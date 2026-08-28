# Target App Architecture

## Overview
The **Target App** is a lightweight FastAPI-based microservice simulating a cloud-hosted web application. It handles user requests and generates structured runtime logs to `stdout`.

## Codebase Layout
- **`main.py`**: The primary application entry point containing all route handlers, logging configurations, and simulated failure mechanisms.
- **`requirements.txt`**: Python dependencies required by the application (`fastapi`, `uvicorn`, `pydantic`).


## Exposed Endpoints
- **`GET /`**: Health and root endpoint. Returns `{"status": "ok", "service": "target-app"}` and logs an `INFO` message describing a successful user request.
- **`GET /simulate-error`**: Diagnostic endpoint designed to simulate real-world application crashes. It randomly executes one of three failure scenarios:
  1. **Configuration Failure**: `FileNotFoundError` (missing application configuration file `config.json`).
  2. **Computation Failure**: `ZeroDivisionError` (arithmetic calculation error during transactional billing calculation).
  3. **Infrastructure Failure**: `TimeoutError` (database connection timeout connecting to `postgres://db.internal:5432`).

## Logging & Observability
All logs are written directly to `stdout` using Python's standard `logging` library. In a production environment (such as Render or Vercel), a log drain forwards these standard output streams directly to the AIOps Engine log ingestion endpoint.

