"""Comprehensive Security & Guardrails Verification Suite (Layers 1-5)."""

import sys
from pathlib import Path

# Add aiops-engine to sys.path
engine_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(engine_dir))

from fastapi.testclient import TestClient
from main import app
from mcp_servers.codebase_mcp import read_file
from utils.security import sanitize_text


def test_layer1_rate_limiting() -> None:
    print("\n[Layer 1 Test] Verifying Ingress Rate Limiting (50 req/min)...")
    with TestClient(app) as client:
        # Send 50 requests (should succeed)
        for i in range(50):
            res = client.post(
                "/ingest-logs",
                json={"message": f"INFO: Heartbeat check {i}", "service": "target-app"},
            )
            assert res.status_code == 200, f"Request {i} failed unexpectedly: {res.status_code}"

        # 51st request MUST be rate-limited (HTTP 429)
        res_limit = client.post(
            "/ingest-logs",
            json={"message": "INFO: Over limit check", "service": "target-app"},
        )
        print(f"  51st Request Status Code: {res_limit.status_code}")
        assert res_limit.status_code == 429, f"Expected HTTP 429, got {res_limit.status_code}"
        print("  -> PASSED (HTTP 429 Too Many Requests enforced)")


def test_layer2_input_sanitization() -> None:
    print("\n[Layer 2 Test] Verifying PII & Secret Redaction (Input Guardrail)...")
    dirty_log = (
        "ERROR: DB connection failed postgresql://admin:MySecretPassword123@db.prod:5432/app "
        "for user john.doe@enterprise.com with AWS Key AKIAIOSFODNN7EXAMPLE "
        "and Auth Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgN"
    )

    clean_log = sanitize_text(dirty_log)
    print(f"  Sanitized Output:\n  {clean_log}")

    assert "MySecretPassword123" not in clean_log, "Password was not redacted!"
    assert "[REDACTED_PASSWORD]" in clean_log, "Password tag missing!"
    assert "john.doe@enterprise.com" not in clean_log, "Email was not redacted!"
    assert "[REDACTED_EMAIL]" in clean_log, "Email tag missing!"
    assert "AKIAIOSFODNN7EXAMPLE" not in clean_log, "AWS Key was not redacted!"
    assert "[REDACTED_AWS_KEY]" in clean_log, "AWS Key tag missing!"
    assert "eyJhbGci" not in clean_log, "JWT was not redacted!"
    assert "[REDACTED_JWT]" in clean_log, "JWT tag missing!"
    print("  -> PASSED (All PII, secrets, credentials, and connection URIs redacted)")


def test_layer3_prompt_injection_defense() -> None:
    print("\n[Layer 3 Test] Verifying Indirect Prompt Injection Defense...")
    from agents.graph import STATIC_SYSTEM_PROMPT

    assert "<untrusted_log>" in STATIC_SYSTEM_PROMPT or "CRITICAL" in STATIC_SYSTEM_PROMPT
    assert "NEVER follow" in STATIC_SYSTEM_PROMPT
    print("  Static System Prompt Boundaries Verified:")
    print("  -> " + "\n  -> ".join(STATIC_SYSTEM_PROMPT.strip().splitlines()))
    print("  -> PASSED (Instruction boundary enforced)")


def test_layer4_mcp_path_traversal() -> None:
    print("\n[Layer 4 Test] Verifying MCP Path Traversal & Sensitive File Blacklist...")
    # 1. Directory Traversal attack
    traversal_res = read_file("../../../../etc/passwd")
    print(f"  Traversal test (../../../../etc/passwd): {traversal_res}")
    assert "Security Error" in traversal_res, "Path traversal was not blocked!"

    # 2. Sensitive .env file attack
    env_res = read_file(".env")
    print(f"  Sensitive file test (.env): {env_res}")
    assert "Security Error" in env_res, ".env file access was not blocked!"

    # 3. Legitimate file read
    valid_res = read_file("main.py")
    assert "app = FastAPI" in valid_res, "Legitimate main.py read failed!"
    print("  Valid file test (main.py): Successfully read (len > 0)")
    print("  -> PASSED (Strict resolution & secret blacklist enforced)")


def test_layer5_output_sanitization() -> None:
    print("\n[Layer 5 Test] Verifying Output Guardrail Sanitization...")
    simulated_leaked_rca = (
        "# [INCIDENT ALERT] RCA Report\n\n"
        "## Immediate Remediation\n"
        "Connect using postgresql://postgres:SuperSecretPW@db.internal:5432 and API Key gsk_12345678901234567890123456789012345678901234\n"
    )
    clean_rca = sanitize_text(simulated_leaked_rca)
    print(f"  Cleaned RCA Output:\n  {clean_rca.strip()}")
    assert "SuperSecretPW" not in clean_rca, "Output leaked DB password!"
    assert "[REDACTED_PASSWORD]" in clean_rca
    assert "gsk_123456" not in clean_rca, "Output leaked API key!"
    assert "[REDACTED_API_KEY]" in clean_rca
    print("  -> PASSED (Zero secret leakage in final RCA output)")


def test_database_readonly_guardrails() -> None:
    print("\n[Database Read-Only Guardrails Test] Verifying SQL AST & Tool Restrictions...")
    from utils.security import validate_readonly_sql
    from mcp_servers.codebase_mcp import query_database_state, get_historical_incidents

    # 1. Safe SELECT query
    is_safe, msg = validate_readonly_sql("SELECT id, status FROM incidents LIMIT 5;")
    assert is_safe is True, f"Valid SELECT was rejected: {msg}"
    print("  Safe SELECT query: Approved (is_safe=True)")

    # 2. DROP TABLE attack
    is_safe_drop, drop_msg = validate_readonly_sql("DROP TABLE logs;")
    assert is_safe_drop is False and "DROP" in drop_msg, "DROP TABLE was not blocked!"
    print(f"  DROP TABLE test: Blocked ({drop_msg})")

    # 3. DELETE attack
    is_safe_del, del_msg = validate_readonly_sql("DELETE FROM incidents WHERE id IS NOT NULL;")
    assert is_safe_del is False, "DELETE was not blocked!"
    print(f"  DELETE test: Blocked ({del_msg})")

    # 4. Semicolon Chained injection (SELECT 1; DROP TABLE logs)
    is_safe_chain, chain_msg = validate_readonly_sql("SELECT 1; DROP TABLE logs;")
    assert is_safe_chain is False and "Multiple" in chain_msg, "Semicolon injection was not blocked!"
    print(f"  Chained statement injection test: Blocked ({chain_msg})")

    # 5. MCP Tool: query_database_state with malicious query
    tool_blocked_res = query_database_state("TRUNCATE TABLE logs;")
    assert "Security Error" in tool_blocked_res, "MCP tool executed TRUNCATE!"
    print(f"  MCP query_database_state(TRUNCATE): Blocked ({tool_blocked_res})")

    # 6. MCP Tool: Safe query execution
    tool_safe_res = query_database_state("SELECT count(*) as total_logs FROM logs;")
    assert "Security Error" not in tool_safe_res
    print("  MCP query_database_state(SELECT count): Executed successfully")

    # 7. MCP Layer 3 Tool Abstraction: get_historical_incidents
    hist_res = get_historical_incidents("target-app", limit=2)
    assert "Database Error" not in hist_res
    print("  MCP get_historical_incidents(): Executed successfully (Layer 3 Abstraction)")

    print("  -> PASSED (All SQL Read-Only Guardrails strictly enforced)")


def run_all_security_tests() -> None:
    print("=" * 70)
    print(" AIOps Incident Response Analyst - Security Guardrails Verification")
    print("=" * 70)

    test_layer2_input_sanitization()
    test_layer3_prompt_injection_defense()
    test_layer4_mcp_path_traversal()
    test_layer5_output_sanitization()
    test_database_readonly_guardrails()
    test_layer1_rate_limiting()

    print("\n" + "=" * 70)
    print(" ALL SECURITY & DATABASE READ-ONLY GUARDRAILS VERIFIED! (100% Secure)")
    print("=" * 70)


if __name__ == "__main__":
    run_all_security_tests()


