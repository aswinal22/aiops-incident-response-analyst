from typing import Any, TypedDict


class AgentState(TypedDict):
    """State definition for the LangGraph Multi-Agent Investigation Workflow."""

    log_message: str
    related_logs: str
    code_context: str
    rca_report: str
    metrics: dict[str, Any]


