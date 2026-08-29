from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    """State definition for the LangGraph Multi-Agent Investigation Workflow."""

    log_message: str
    related_logs: str
    code_context: str
    rca_report: str
    metrics: dict[str, Any]
    service_id: str
    service_name: str
    project_id: str
    repo_context: dict[str, Any]
