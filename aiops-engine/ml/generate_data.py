import csv
import os
import random
from pathlib import Path

NORMAL_TEMPLATES = [
    "INFO: 127.0.0.1:54320 - \"GET / HTTP/1.1\" 200 OK",
    "INFO: 10.0.0.12:49152 - \"GET /health HTTP/1.1\" 200 OK",
    "INFO: 192.168.1.100:60124 - \"POST /api/v1/login HTTP/1.1\" 200 OK",
    "INFO: 172.18.0.4:38902 - \"GET /api/v1/users/profile HTTP/1.1\" 200 OK",
    "INFO: 127.0.0.1:44302 - \"POST /api/v1/checkout HTTP/1.1\" 201 Created",
    "INFO: [target-app] Processed request GET / successfully with status 200 OK.",
    "INFO: [target-app] Database heartbeat query executed in 1.4ms.",
    "INFO: [target-app] Background log drain synced 45 events to collector.",
    "INFO: [target-app] User session refreshed token_id=tok_9a8f7b2c.",
    "INFO: [target-app] Cache hit for key 'product_catalog_v2' latency=0.2ms.",
    "INFO: [target-app] Health check probe passed. All downstream dependencies reachable.",
    "DEBUG: [target-app] Serialized response payload size=412 bytes.",
    "INFO: 10.0.2.15:52130 - \"GET /metrics HTTP/1.1\" 200 OK",
    "INFO: [target-app] TLS handshake completed successfully with cipher TLS_AES_256_GCM_SHA384.",
    "INFO: [target-app] Batch job finished successfully: processed 150 records.",
]

ERROR_TEMPLATES = [
    (
        "ERROR: [target-app] Simulated Application Failure [FileNotFoundError]: Configuration file '/app/config/settings.yaml' not found in path.\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/main.py\", line 42, in simulate_error\n"
        "    raise FileNotFoundError(\"Configuration file '/app/config/settings.yaml' not found in path.\")\n"
        "FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path."
    ),
    (
        "ERROR: [target-app] Simulated Application Failure [ZeroDivisionError]: division by zero\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/main.py\", line 46, in simulate_error\n"
        "    _ = 100 / 0\n"
        "ZeroDivisionError: division by zero"
    ),
    (
        "ERROR: [target-app] Simulated Application Failure [TimeoutError]: Database connection timed out after 30000ms: host=db-replica-1.internal:5432\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/main.py\", line 50, in simulate_error\n"
        "    raise TimeoutError(\"Database connection timed out after 30000ms: host=db-replica-1.internal:5432\")\n"
        "TimeoutError: Database connection timed out after 30000ms: host=db-replica-1.internal:5432"
    ),
    (
        "ERROR: [target-app] Unhandled Exception: KeyError: 'user_preferences'\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/services/user.py\", line 88, in get_user\n"
        "    prefs = user_data['user_preferences']\n"
        "KeyError: 'user_preferences'"
    ),
    (
        "ERROR: [target-app] Database query failed: OperationalError: connection refused to 10.0.1.5:5432\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/db/session.py\", line 29, in get_db\n"
        "    conn = psycopg2.connect(dsn)\n"
        "psycopg2.OperationalError: could not connect to server: Connection refused"
    ),
    (
        "ERROR: [target-app] Memory limit exceeded: MemoryError: unable to allocate 512MiB for buffer\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/utils/export.py\", line 15, in export_large_dataset\n"
        "    buffer = bytearray(512 * 1024 * 1024)\n"
        "MemoryError"
    ),
    (
        "ERROR: [target-app] HTTP 500 Internal Server Error: NullPointerException in auth verification\n"
        "Traceback (most recent call last):\n"
        "  File \"/app/middleware/auth.py\", line 64, in authenticate\n"
        "    user_role = token_claims['role']\n"
        "TypeError: 'NoneType' object is not subscriptable"
    ),
]


def generate_synthetic_logs(output_file: Path, total_samples: int = 1000) -> None:
    """Generates balanced synthetic logs dataset (500 Normal, 500 Anomaly)."""
    output_file.parent.mkdir(parents=True, exist_ok=True)
    num_each = total_samples // 2
    rows: list[tuple[str, int]] = []

    # Generate normal logs (label = 0)
    for _ in range(num_each):
        template = random.choice(NORMAL_TEMPLATES)
        # Add slight variation like IP / ID / timing
        req_id = random.randint(1000, 9999)
        log_text = f"{template} [req_id={req_id}]"
        rows.append((log_text, 0))

    # Generate anomaly logs (label = 1)
    for _ in range(num_each):
        template = random.choice(ERROR_TEMPLATES)
        req_id = random.randint(1000, 9999)
        log_text = f"{template}\nContext: req_id={req_id}"
        rows.append((log_text, 1))

    # Shuffle dataset
    random.shuffle(rows)

    with open(output_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["log_text", "label"])
        writer.writerows(rows)

    print(f"Successfully generated {len(rows)} logs to {output_file}")


if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    dataset_path = current_dir / "logs_dataset.csv"
    generate_synthetic_logs(dataset_path, total_samples=1000)

