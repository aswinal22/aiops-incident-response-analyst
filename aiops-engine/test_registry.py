"""Verification suite for Service Registry, Fernet Token Encryption, and Multi-Repo Routing with Supabase."""

import sys
from pathlib import Path

# Add aiops-engine to sys.path
engine_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(engine_dir))

from fastapi.testclient import TestClient
from main import app
from registry import get_service, list_projects, list_services, register_project, register_service
from utils.crypto import decrypt_token, encrypt_token
from mcp_servers.codebase_mcp import get_cross_service_dependencies, list_commits, read_file


def test_fernet_token_encryption() -> None:
    print("\n[Test 1] Verifying Fernet AES-128 Token Encryption at Rest...")
    sample_pat = "ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD"
    encrypted = encrypt_token(sample_pat)
    print(f"  Raw PAT: {sample_pat[:8]}... (len={len(sample_pat)})")
    print(f"  Encrypted at Rest: {encrypted[:25]}... (len={len(encrypted)})")

    assert encrypted != sample_pat, "Encryption failed to transform token!"
    assert sample_pat not in encrypted, "Raw token exposed in ciphertext!"

    decrypted = decrypt_token(encrypted)
    assert decrypted == sample_pat, f"Decryption mismatch: {decrypted} != {sample_pat}"
    print("  Decrypted in-memory: Verified 100% roundtrip integrity")
    print("  -> PASSED")


def test_service_registry_lifecycle() -> None:
    print("\n[Test 2] Verifying Supabase Service Registry & Multi-Service Mapping...")
    # 1. Create a project
    project_id = register_project(
        name="E-Commerce Suite",
        description="Distributed microservices for retail platform",
    )
    assert project_id is not None
    print(f"  Registered Project in Supabase: ID={project_id}")

    # 2. Register a microservice with encrypted GitHub PAT
    raw_pat = "ghp_secretTokenAuthService2026Live"
    service_id = register_service(
        project_id=project_id,
        name="auth-service",
        repo_url="https://github.com/retail-org/auth-service.git",
        repo_owner="retail-org",
        repo_name="auth-service",
        github_pat=raw_pat,
        workspace_path="auth-service",
    )
    assert service_id is not None
    print(f"  Registered Microservice in Supabase: ID={service_id} (Name: auth-service)")

    # 3. Retrieve service and verify PAT decryption in memory
    svc = get_service(service_id)
    assert svc is not None
    assert svc["name"] == "auth-service"
    assert svc["repo_owner"] == "retail-org"
    assert svc["repo_name"] == "auth-service"
    assert svc["github_pat"] == raw_pat, "Decrypted PAT does not match original!"
    print("  Resolved Service Metadata & Decrypted PAT: Success")

    # 4. List services and verify PAT is masked
    services_list = list_services(project_id)
    assert len(services_list) >= 1
    for s in services_list:
        assert "github_pat" not in s or s.get("github_pat") is None, "Sensitive PAT leaked in list API!"
    print("  Public Service Listing: Confirmed zero credential exposure")
    print("  -> PASSED")


def test_dynamic_log_ingestion_routing() -> None:
    print("\n[Test 3] Verifying Dynamic Ingestion Routing (POST /ingest-logs/{service_id})...")
    with TestClient(app) as client:
        # Register test microservice
        proj_res = client.post(
            "/api/projects", json={"name": "Payment Platform", "description": "Core checkout"}
        )
        proj_id = proj_res.json()["project_id"]

        svc_res = client.post(
            "/api/services",
            json={
                "project_id": proj_id,
                "name": "payment-gateway",
                "repo_url": "https://github.com/retail-org/payment-gateway.git",
                "repo_owner": "retail-org",
                "repo_name": "payment-gateway",
                "github_pat": "ghp_demoTokenPayment2026",
            },
        )
        svc_id = svc_res.json()["service_id"]

        # Send log to dynamic endpoint /ingest-logs/{service_id}
        ingest_res = client.post(
            f"/ingest-logs/{svc_id}",
            json={"message": "INFO: Payment transaction 4829 processed successfully (200 OK)"},
        )
        assert ingest_res.status_code == 200, f"Ingest failed: {ingest_res.text}"
        data = ingest_res.json()
        assert data["prediction"] == "Normal"
        print(f"  Ingested to /ingest-logs/{svc_id}: Status={data['status']}, Prediction={data['prediction']}")
        print("  -> PASSED (Dynamic routing resolved service context)")


def test_multi_repo_mcp_tools() -> None:
    print("\n[Test 4] Verifying Multi-Repo MCP Tools & Cross-Service Dependencies...")
    # 1. Cross-service discovery
    deps = get_cross_service_dependencies()
    print(f"  Discovered Dependencies:\n  " + "\n  ".join(deps.splitlines()))
    assert "target-app" in deps or "Service:" in deps

    # 2. Local workspace file read with Layer 4 Sandbox
    content = read_file("main.py", service_name="target-app")
    assert "app = FastAPI" in content
    print("  Multi-repo read_file('main.py', service_name='target-app'): Success")

    # 3. Path traversal protection on custom service
    traversal = read_file("../../../../etc/passwd", service_name="target-app")
    assert "Security Error" in traversal
    print(f"  Multi-repo path traversal guard: {traversal}")
    print("  -> PASSED")


def run_all_registry_tests() -> None:
    print("=" * 70)
    print(" AIOps Multi-Repo, Supabase Service Registry & Fernet Encryption Suite")
    print("=" * 70)

    test_fernet_token_encryption()
    test_service_registry_lifecycle()
    test_dynamic_log_ingestion_routing()
    test_multi_repo_mcp_tools()

    print("\n" + "=" * 70)
    print(" ALL MULTI-REPO & SUPABASE REGISTRY TESTS PASSED! (100% Verified)")
    print("=" * 70)


if __name__ == "__main__":
    run_all_registry_tests()

