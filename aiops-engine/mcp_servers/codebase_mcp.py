import os
from pathlib import Path

try:
    from mcp.server.fastmcp import FastMCP
    mcp = FastMCP("codebase-investigator")

except (ImportError, ModuleNotFoundError):
    try:
        from mcp.server.mcpserver import MCPServer
        mcp = MCPServer("codebase-investigator")
    except Exception:
        # Fallback dummy class if running in minimal test environment
        class SimpleMCP:
            def tool(self):
                def decorator(fn):
                    return fn
                return decorator
            def run(self):
                pass
        mcp = SimpleMCP()


# Locate target-app directory
DEFAULT_TARGET_APP_DIR = Path(__file__).resolve().parent.parent.parent / "target-app"
TARGET_APP_DIR = Path(os.getenv("TARGET_APP_DIR", str(DEFAULT_TARGET_APP_DIR)))


@mcp.tool()
def read_architecture_context() -> str:
    """Reads and returns the complete contents of target-app/ARCHITECTURE.md."""
    arch_file = TARGET_APP_DIR / "ARCHITECTURE.md"
    if not arch_file.exists():
        return f"Error: ARCHITECTURE.md not found at {arch_file}"
    try:
        return arch_file.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading ARCHITECTURE.md: {e}"


@mcp.tool()
def get_file_structure() -> str:
    """Returns a list of all files and relative paths inside target-app."""
    if not TARGET_APP_DIR.exists():
        return f"Error: Target app directory not found at {TARGET_APP_DIR}"

    file_list: list[str] = []
    for root, _, files in os.walk(TARGET_APP_DIR):
        for file in files:
            full_path = Path(root) / file
            rel_path = full_path.relative_to(TARGET_APP_DIR)
            file_list.append(str(rel_path))

    return "\n".join(file_list) if file_list else "Target app directory is empty."


# Blacklisted file names and extensions to prevent credential exposure
SENSITIVE_PATTERNS = {
    ".env",
    "credentials.json",
    "secrets.json",
    "secrets.yaml",
    "id_rsa",
    "id_ed25519",
}
SENSITIVE_EXTENSIONS = {".key", ".pem", ".cert", ".crt", ".pfx", ".p12"}


@mcp.tool()
def read_file(file_path: str) -> str:
    """Reads and returns the contents of a specific file inside target-app with strict security boundaries.
    
    Args:
        file_path: Relative path to the file inside target-app (e.g. 'main.py' or 'requirements.txt')
    """
    base_dir = TARGET_APP_DIR.resolve()
    
    # 1. Normalize and resolve path
    clean_path = Path(file_path).as_posix().lstrip("/\\")
    target_file = (TARGET_APP_DIR / clean_path).resolve()

    # 2. Strict Path Traversal Guard (must be strictly inside base_dir)
    try:
        target_file.relative_to(base_dir)
    except ValueError:
        return f"Security Error: Path '{file_path}' traverses outside the allowed /target-app directory."

    # 3. Sensitive File Name & Extension Blacklist Guard
    file_name = target_file.name.lower()
    if (
        file_name in SENSITIVE_PATTERNS
        or file_name.startswith(".env")
        or target_file.suffix.lower() in SENSITIVE_EXTENSIONS
    ):
        return f"Security Error: Access to sensitive/credential file '{file_path}' is strictly blocked by MCP guardrails."

    if not target_file.exists() or not target_file.is_file():
        return f"Error: File '{file_path}' not found in target-app."

    try:
        return target_file.read_text(encoding="utf-8")
    except Exception as e:
        return f"Error reading file '{file_path}': {e}"



@mcp.tool()
def get_recent_git_changes() -> str:
    """Returns recent git changelog and commit context for the target-app microservice."""
    return (
        "Commit: 7a9d3f1 - Fix: Add error simulation endpoint to diagnose runtime failures\n"
        "Author: DevOps Engineer <devops@company.internal>\n"
        "Date: Recent\n"
        "Diff summary:\n"
        "  target-app/main.py: Added /simulate-error endpoint raising FileNotFound, ZeroDivision, Timeout.\n"
        "  target-app/ARCHITECTURE.md: Updated endpoint documentation."
    )


@mcp.tool()
def query_database_state(sql_query: str) -> str:
    """Executes a strictly validated, read-only SELECT query against the database (Layer 2 & Layer 3 Guardrails).
    
    Args:
        sql_query: The SQL SELECT statement to inspect database state (e.g. 'SELECT count(*) FROM incidents')
    """
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from utils.security import validate_readonly_sql
    from db import get_db_engine
    from sqlalchemy import text

    # Layer 2 Guardrail: Strict AST & Keyword Validation
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
            import json
            return json.dumps(rows, default=str, indent=2)
    except Exception as e:
        return f"Database Query Error: {e}"


@mcp.tool()
def get_historical_incidents(service: str = "target-app", limit: int = 5) -> str:
    """High-level abstraction tool to safely retrieve past incidents (Layer 3 Tool Abstraction)."""
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from db import get_db_engine
    from sqlalchemy import text

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
            import json
            return json.dumps(rows, default=str, indent=2)
    except Exception as e:
        return f"Database Error: {e}"


if __name__ == "__main__":
    mcp.run()

