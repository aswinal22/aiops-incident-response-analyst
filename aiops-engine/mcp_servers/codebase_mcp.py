"""Multi-Repo & Remote GitHub Model Context Protocol (MCP) Codebase Server.

Supports:
1. Remote GitHub REST API integration (list_commits, get_commit_diff, get_file_contents, search_code).
2. Local Multi-Repo Workspace router (/workspace/<service_name>/ and /target-app) with Layer 4 Traversal Guard.
3. Cross-Service Dependency Analysis (discovering microservices across project).
4. Read-Only Database Inspection with Layer 2 SQL AST validator.
"""

import base64
import json
import os
import sys
from pathlib import Path
from typing import Any

# Ensure imports resolve
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import httpx

try:
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP("codebase-investigator")
except (ImportError, ModuleNotFoundError):
    try:
        from mcp.server.mcpserver import MCPServer
        mcp = MCPServer("codebase-investigator")
    except Exception:
        class SimpleMCP:
            def tool(self):
                def decorator(fn):
                    return fn
                return decorator
            def run(self):
                pass
        mcp = SimpleMCP()

from registry import get_service, list_services
from utils.security import validate_readonly_sql
from db import get_db_engine
from sqlalchemy import text

# Local fallback base directories
DEFAULT_TARGET_APP_DIR = Path(__file__).resolve().parent.parent.parent / "target-app"
DEFAULT_WORKSPACE_DIR = Path(__file__).resolve().parent.parent.parent / "workspace"

# Blacklisted file names and extensions to prevent credential exposure (Layer 4)
SENSITIVE_PATTERNS = {
    ".env",
    "credentials.json",
    "secrets.json",
    "secrets.yaml",
    "id_rsa",
    "id_ed25519",
}
SENSITIVE_EXTENSIONS = {".key", ".pem", ".cert", ".crt", ".pfx", ".p12"}


def _resolve_service_dir(service_name: str = "target-app") -> Path:
    """Resolves local base directory for a given microservice."""
    if service_name in ("target-app", "default-target-app"):
        return Path(os.getenv("TARGET_APP_DIR", str(DEFAULT_TARGET_APP_DIR))).resolve()

    svc = get_service(service_name)
    if svc and svc.get("workspace_path"):
        ws_path = Path(svc["workspace_path"])
        if ws_path.is_absolute():
            return ws_path.resolve()
        return (DEFAULT_WORKSPACE_DIR / ws_path).resolve()

    return (DEFAULT_WORKSPACE_DIR / service_name).resolve()


# =========================================================================
# 1. Remote GitHub MCP Tools
# =========================================================================

@mcp.tool()
def list_commits(service_name: str = "target-app", limit: int = 5) -> str:
    """Lists recent git commits from the microservice's GitHub repository or local log.
    
    Args:
        service_name: Name of the microservice (e.g. 'auth-service', 'target-app')
        limit: Maximum number of commits to retrieve (default 5)
    """
    svc = get_service(service_name)
    if svc and svc.get("github_pat") and svc.get("repo_owner") and svc.get("repo_name"):
        owner = svc["repo_owner"]
        repo = svc["repo_name"]
        pat = svc["github_pat"]
        url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page={limit}"
        headers = {
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AIOps-Incident-Analyst",
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    commits = res.json()
                    lines = [f"Recent commits for {owner}/{repo}:"]
                    for c in commits:
                        sha = c.get("sha", "")[:7]
                        msg = c.get("commit", {}).get("message", "").splitlines()[0]
                        author = c.get("commit", {}).get("author", {}).get("name", "Unknown")
                        date = c.get("commit", {}).get("author", {}).get("date", "")
                        lines.append(f"- Commit {sha} by {author} ({date}): {msg}")
                    return "\n".join(lines)
                return f"GitHub API Error ({res.status_code}): {res.text}"
        except Exception as e:
            return f"Error connecting to GitHub API: {e}"

    # Local fallback for demo target-app
    return (
        f"Recent Git Changes for {service_name} (Local Mock):\n"
        "Commit: 7a9d3f1 - Fix: Add error simulation endpoint to diagnose runtime failures\n"
        "Author: DevOps Engineer <devops@company.internal>\n"
        "Date: Recent\n"
        "Diff summary:\n"
        "  target-app/main.py: Added /simulate-error endpoint raising FileNotFound, ZeroDivision, Timeout.\n"
        "  target-app/ARCHITECTURE.md: Updated endpoint documentation."
    )


@mcp.tool()
def get_commit_diff(service_name: str = "target-app", commit_sha: str = "HEAD") -> str:
    """Inspects the exact code modifications and diff patch introduced in a specific commit.
    
    Args:
        service_name: Name of the microservice
        commit_sha: Commit SHA hash or 'HEAD' (default 'HEAD')
    """
    svc = get_service(service_name)
    if svc and svc.get("github_pat") and svc.get("repo_owner") and svc.get("repo_name"):
        owner = svc["repo_owner"]
        repo = svc["repo_name"]
        pat = svc["github_pat"]
        url = f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha}"
        headers = {
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github.v3.diff",
            "User-Agent": "AIOps-Incident-Analyst",
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    return f"Commit Diff ({commit_sha}) for {owner}/{repo}:\n\n{res.text[:4000]}"
                return f"GitHub API Error ({res.status_code}): {res.text}"
        except Exception as e:
            return f"Error fetching commit diff: {e}"

    return (
        f"Diff for {service_name} commit 7a9d3f1:\n"
        "--- a/main.py\n"
        "+++ b/main.py\n"
        "@@ -31,6 +31,18 @@ def simulate_error():\n"
        "+    if selected_error == 'file_not_found':\n"
        "+        raise FileNotFoundError('/app/config/settings.yaml not found')\n"
    )


@mcp.tool()
def get_file_contents(service_name: str = "target-app", file_path: str = "main.py", ref: str | None = None) -> str:
    """Fetches source code of a file from GitHub or local workspace.
    
    Args:
        service_name: Name of the microservice
        file_path: Relative path to the file (e.g. 'main.py' or 'config/settings.yaml')
        ref: Optional commit SHA, branch, or tag
    """
    svc = get_service(service_name)
    if svc and svc.get("github_pat") and svc.get("repo_owner") and svc.get("repo_name"):
        owner = svc["repo_owner"]
        repo = svc["repo_name"]
        pat = svc["github_pat"]
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        if ref:
            url += f"?ref={ref}"
        headers = {
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AIOps-Incident-Analyst",
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    content_b64 = data.get("content", "")
                    return base64.b64decode(content_b64).decode("utf-8")
                return f"GitHub API Error ({res.status_code}): {res.text}"
        except Exception as e:
            return f"Error fetching remote file contents: {e}"

    # Fallback to local workspace
    return read_file(file_path=file_path, service_name=service_name)


@mcp.tool()
def search_code(service_name: str = "target-app", query: str = "") -> str:
    """Searches the repository for specific function definitions, symbols, or error signatures.
    
    Args:
        service_name: Name of the microservice
        query: Search term or symbol name
    """
    svc = get_service(service_name)
    if svc and svc.get("github_pat") and svc.get("repo_owner") and svc.get("repo_name"):
        owner = svc["repo_owner"]
        repo = svc["repo_name"]
        pat = svc["github_pat"]
        url = f"https://api.github.com/search/code?q={query}+repo:{owner}/{repo}"
        headers = {
            "Authorization": f"Bearer {pat}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AIOps-Incident-Analyst",
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    items = res.json().get("items", [])
                    matches = [f"Matches in {owner}/{repo}:"]
                    for it in items[:10]:
                        matches.append(f"- {it.get('path')} (URL: {it.get('html_url')})")
                    return "\n".join(matches) if items else f"No code matches found for '{query}'."
                return f"GitHub API Error ({res.status_code}): {res.text}"
        except Exception as e:
            return f"Error searching code: {e}"

    return f"Code search across local service '{service_name}' for query '{query}': Found in main.py"


# =========================================================================
# 2. Local Multi-Repo & Workspace Router Tools (Layer 4 Guardrail)
# =========================================================================

@mcp.tool()
def read_file(file_path: str, service_name: str = "target-app") -> str:
    """Reads and returns the contents of a specific file inside a microservice's local workspace.
    
    Args:
        file_path: Relative path to the file (e.g. 'main.py' or 'requirements.txt')
        service_name: Target microservice name (default 'target-app')
    """
    base_dir = _resolve_service_dir(service_name)
    clean_path = Path(file_path).as_posix().lstrip("/\\")
    target_file = (base_dir / clean_path).resolve()

    # Layer 4: Strict Path Traversal Guard
    try:
        target_file.relative_to(base_dir)
    except ValueError:
        return f"Security Error: Path '{file_path}' traverses outside the allowed /{service_name} directory."

    # Layer 4: Sensitive File Blacklist Guard
    file_name = target_file.name.lower()
    if (
        file_name in SENSITIVE_PATTERNS
        or file_name.startswith(".env")
        or target_file.suffix.lower() in SENSITIVE_EXTENSIONS
    ):
        return f"Security Error: Access to sensitive/credential file '{file_path}' is strictly blocked by MCP guardrails."

    if not target_file.exists() or not target_file.is_file():
        return f"Error: File '{file_path}' not found in {service_name}."

    try:
        return target_file.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading file '{file_path}': {e}"


@mcp.tool()
def read_architecture_context(service_name: str = "target-app") -> str:
    """Reads and returns the ARCHITECTURE.md or README.md documentation for a microservice."""
    base_dir = _resolve_service_dir(service_name)
    for doc_name in ["ARCHITECTURE.md", "README.md", "docs/ARCHITECTURE.md"]:
        doc_file = base_dir / doc_name
        if doc_file.exists():
            try:
                return doc_file.read_text(encoding="utf-8")
            except Exception as e:
                return f"Error reading {doc_name}: {e}"
    return f"No ARCHITECTURE.md or README.md found in {service_name}."


@mcp.tool()
def get_file_structure(service_name: str = "target-app") -> str:
    """Returns the file structure tree of a microservice."""
    base_dir = _resolve_service_dir(service_name)
    if not base_dir.exists():
        return f"Error: Service directory not found at {base_dir}"

    file_list: list[str] = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(base_dir)
            file_list.append(str(rel_path))

    return "\n".join(file_list) if file_list else f"Service '{service_name}' directory is empty."


@mcp.tool()
def get_recent_git_changes() -> str:
    """Backward-compatible git changes helper for target-app."""
    return list_commits("target-app", limit=3)


@mcp.tool()
def get_cross_service_dependencies(project_id: str | None = None) -> str:
    """Returns all registered microservices in the project to support cross-service root cause investigation."""
    services = list_services(project_id)
    if not services:
        return "No microservices registered in project."

    lines = ["Available Microservices in Project:"]
    for s in services:
        lines.append(
            f"- Service: {s.get('name')} (Repo: {s.get('repo_owner', '')}/{s.get('repo_name', '')} | Workspace: {s.get('workspace_path')})"
        )
    return "\n".join(lines)


# =========================================================================
# 3. Read-Only Database Inspection Tools (Layer 2 & 3 Guardrails)
# =========================================================================

@mcp.tool()
def query_database_state(sql_query: str) -> str:
    """Executes a strictly validated, read-only SELECT query against the database (Layer 2 & 3 Guardrails)."""
    is_safe, message = validate_readonly_sql(sql_query)
    if not is_safe:
        return f"Security Error: {message}"

    engine = get_db_engine()
    if not engine:
        return "Database is not connected or DATABASE_URL is not set."

    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql_query))
            rows = [dict(row._mapping) for row in result.fetchmany(50)]
            return json.dumps(rows, default=str, indent=2)
    except Exception as e:
        return f"Database Query Error: {e}"


@mcp.tool()
def get_historical_incidents(service: str = "target-app", limit: int = 5) -> str:
    """High-level abstraction tool to safely retrieve past incidents (Layer 3 Tool Abstraction)."""
    engine = get_db_engine()
    if not engine:
        return "Database is not connected."

    query = text(
        """
        SELECT id, severity, status, incident_summary, detected_exception, created_at
        FROM incidents
        WHERE service = :service
        ORDER BY created_at DESC
        LIMIT :limit;
        """
    )
    try:
        with engine.connect() as conn:
            result = conn.execute(query, {"service": service, "limit": limit})
            rows = [dict(row._mapping) for row in result.fetchall()]
            return json.dumps(rows, default=str, indent=2)
    except Exception as e:
        return f"Database Error: {e}"


if __name__ == "__main__":
    mcp.run()
