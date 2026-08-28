"""Golden Dataset containing annotated incident benchmark scenarios for agent evaluation."""

from typing import Any

GOLDEN_INCIDENTS: list[dict[str, Any]] = [
    {
        "scenario_id": "INC-001",
        "title": "Missing Configuration File (FileNotFoundError)",
        "trigger_log": (
            "ERROR: [target-app] Simulated Application Failure [FileNotFoundError]: Configuration file '/app/config/settings.yaml' not found in path.\n"
            "Traceback (most recent call last):\n"
            "  File \"/app/main.py\", line 42, in simulate_error\n"
            "    raise FileNotFoundError(\"Configuration file '/app/config/settings.yaml' not found in path.\")\n"
            "FileNotFoundError: Configuration file '/app/config/settings.yaml' not found in path."
        ),
        "expected_faulty_file": "main.py",
        "expected_exception": "FileNotFoundError",
        "expected_root_cause_keywords": [
            "settings.yaml",
            "FileNotFoundError",
            "missing",
            "config",
        ],
        "expected_tools": [
            "read_architecture_context",
            "get_file_structure",
            "get_recent_git_changes",
            "read_file('main.py')",
        ],
        "simulated_buffer": [
            {
                "message": "INFO: 127.0.0.1:54320 - \"GET / HTTP/1.1\" 200 OK",
                "timestamp": "2026-08-28T18:00:00Z",
                "service": "target-app",
            },
            {
                "message": "INFO: [target-app] Initiating file loading routine from /app/config/settings.yaml",
                "timestamp": "2026-08-28T18:00:01Z",
                "service": "target-app",
            },
        ],
    },
    {
        "scenario_id": "INC-002",
        "title": "Arithmetic Error in Discount Routine (ZeroDivisionError)",
        "trigger_log": (
            "ERROR: [target-app] Simulated Application Failure [ZeroDivisionError]: division by zero\n"
            "Traceback (most recent call last):\n"
            "  File \"/app/main.py\", line 46, in simulate_error\n"
            "    _ = 100 / 0\n"
            "ZeroDivisionError: division by zero"
        ),
        "expected_faulty_file": "main.py",
        "expected_exception": "ZeroDivisionError",
        "expected_root_cause_keywords": [
            "ZeroDivisionError",
            "division by zero",
            "calculate_user_discount",
            "100 / 0",
        ],
        "expected_tools": [
            "read_architecture_context",
            "get_file_structure",
            "get_recent_git_changes",
            "read_file('main.py')",
        ],
        "simulated_buffer": [
            {
                "message": "INFO: 127.0.0.1:54320 - \"GET / HTTP/1.1\" 200 OK",
                "timestamp": "2026-08-28T18:00:00Z",
                "service": "target-app",
            },
            {
                "message": "INFO: [target-app] Executing calculate_user_discount routine with zero denominator.",
                "timestamp": "2026-08-28T18:00:02Z",
                "service": "target-app",
            },
        ],
    },
    {
        "scenario_id": "INC-003",
        "title": "Database Replica Timeout (TimeoutError)",
        "trigger_log": (
            "ERROR: [target-app] Simulated Application Failure [TimeoutError]: Database connection timed out after 30000ms: host=db-replica-1.internal:5432\n"
            "Traceback (most recent call last):\n"
            "  File \"/app/main.py\", line 50, in simulate_error\n"
            "    raise TimeoutError(\"Database connection timed out after 30000ms: host=db-replica-1.internal:5432\")\n"
            "TimeoutError: Database connection timed out after 30000ms: host=db-replica-1.internal:5432"
        ),
        "expected_faulty_file": "main.py",
        "expected_exception": "TimeoutError",
        "expected_root_cause_keywords": [
            "TimeoutError",
            "db-replica-1.internal",
            "5432",
            "database connection",
        ],
        "expected_tools": [
            "read_architecture_context",
            "get_file_structure",
            "get_recent_git_changes",
            "read_file('main.py')",
        ],
        "simulated_buffer": [
            {
                "message": "INFO: 127.0.0.1:54320 - \"GET / HTTP/1.1\" 200 OK",
                "timestamp": "2026-08-28T18:00:00Z",
                "service": "target-app",
            },
            {
                "message": "INFO: [target-app] Attempting connection to primary database host postgres://db-replica-1.internal:5432",
                "timestamp": "2026-08-28T18:00:03Z",
                "service": "target-app",
            },
        ],
    },
]

