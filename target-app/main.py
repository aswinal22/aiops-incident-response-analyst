import logging
import random
import sys
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

# Configure stdout logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("target-app")

app = FastAPI(
    title="Target Application",
    description="Dummy microservice generating standard and error logs for AIOps detection",
    version="1.0.0",
)


@app.get("/")
def read_root() -> dict[str, str]:
    """Root endpoint simulating standard application traffic."""
    logger.info("Processed request GET / successfully with status 200 OK.")
    return {"status": "ok", "service": "target-app", "message": "Target App running"}


@app.get("/simulate-error")
def simulate_error() -> JSONResponse:
    """Simulates realistic application errors and emits tracebacks to stdout."""
    error_types = ["file_not_found", "zero_division", "db_timeout"]
    selected_error = random.choice(error_types)

    try:
        if selected_error == "file_not_found":
            logger.info("Initiating file loading routine from /app/config/settings.yaml")
            raise FileNotFoundError("Configuration file '/app/config/settings.yaml' not found in path.")

        elif selected_error == "zero_division":
            logger.info("Executing calculate_user_discount routine with zero denominator.")
            _ = 100 / 0

        elif selected_error == "db_timeout":
            logger.info("Attempting connection to primary database host postgres://db-replica-1.internal:5432")
            raise TimeoutError("Database connection timed out after 30000ms: host=db-replica-1.internal:5432")

    except Exception as exc:
        error_traceback = traceback.format_exc()
        logger.error(
            "Simulated Application Failure [%s]: %s\n%s",
            type(exc).__name__,
            str(exc),
            error_traceback,
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": type(exc).__name__,
                "detail": str(exc),
                "traceback": error_traceback,
            },
        )

    return JSONResponse(status_code=200, content={"status": "normal"})

