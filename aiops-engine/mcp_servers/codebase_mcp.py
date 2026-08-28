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


@mcp.tool()
def read_file(file_path: str) -> str:
    """Reads and returns the contents of a specific file inside target-app.
    
    Args:
        file_path: Relative path to the file inside target-app (e.g. 'main.py' or 'requirements.txt')
    """
    # Prevent directory traversal
    clean_path = Path(file_path).as_posix().lstrip("/\\")
    target_file = (TARGET_APP_DIR / clean_path).resolve()

    if not str(target_file).startswith(str(TARGET_APP_DIR.resolve())):
        return f"Access Denied: Path '{file_path}' is outside the target-app directory."

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


if __name__ == "__main__":
    mcp.run()
