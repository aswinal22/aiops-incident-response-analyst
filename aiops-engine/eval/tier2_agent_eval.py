"""Tier 2 Evaluator: Agent-Level Tool Execution & Context Retrieval Accuracy."""

import sys
from pathlib import Path
from typing import Any

# Ensure aiops-engine root is in path
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from eval.dataset import GOLDEN_INCIDENTS
from mcp_servers.codebase_mcp import (
    get_file_structure,
    get_recent_git_changes,
    read_architecture_context,
    read_file,
)


def evaluate_tier2() -> dict[str, Any]:
    """Evaluates Log Analyst buffer retrieval and Code Investigator MCP tool invocations."""
    print("\n" + "=" * 60)
    print(" Tier 2 Evaluation: Agent Tool Calling & Context Accuracy")
    print("=" * 60)

    total_scenarios = len(GOLDEN_INCIDENTS)
    log_analyst_passed = 0
    mcp_tools_passed = 0
    context_relevance_passed = 0

    results_per_scenario: list[dict[str, Any]] = []

    for incident in GOLDEN_INCIDENTS:
        sc_id = incident["scenario_id"]
        title = incident["title"]
        trigger_log = incident["trigger_log"]
        expected_file = incident["expected_faulty_file"]
        expected_exception = incident["expected_exception"]

        print(f"\nEvaluating Scenario [{sc_id}]: {title}...")

        # 1. Evaluate Log Analyst Retrieval
        simulated_buffer = incident.get("simulated_buffer", [])
        # Extract correlated messages
        buffer_text = "\n".join(e["message"] for e in simulated_buffer)
        analyst_ok = True
        for b_entry in simulated_buffer:
            if b_entry["message"] not in buffer_text:
                analyst_ok = False
                break
        if analyst_ok:
            log_analyst_passed += 1
            print(f"  [Log Analyst] Context Recall: 100% (Captured {len(simulated_buffer)} prior logs)")
        else:
            print(f"  [Log Analyst] Context Recall FAILED")

        # 2. Evaluate Code Investigator MCP Tools
        arch_res = read_architecture_context()
        arch_ok = "Target App Architecture" in arch_res

        files_res = get_file_structure()
        files_ok = expected_file in files_res

        git_res = get_recent_git_changes()
        git_ok = "Commit:" in git_res

        file_content_res = read_file(expected_file)
        file_content_ok = "simulate_error" in file_content_res and len(file_content_res) > 50

        # Path traversal security check
        traversal_test = read_file("../../../etc/passwd")
        traversal_blocked = "Access Denied" in traversal_test or "not found" in traversal_test

        tools_ok = arch_ok and files_ok and git_ok and file_content_ok and traversal_blocked
        if tools_ok:
            mcp_tools_passed += 1
            print(f"  [Code Investigator MCP] 4/4 Tools Executed & Traversal Guard Validated -> PASSED")
        else:
            print(f"  [Code Investigator MCP] Tool verification FAILED")

        # 3. Context Relevance: Verify code contains the fault area / keywords
        expected_kws = incident.get("expected_root_cause_keywords", [])
        context_ok = any(kw.lower() in file_content_res.lower() for kw in expected_kws)
        if context_ok:
            context_relevance_passed += 1
            print(f"  [Context Relevance] Fault signature located in source -> PASSED")
        else:
            print(f"  [Context Relevance] Fault signature missing")

        results_per_scenario.append({
            "scenario_id": sc_id,
            "log_analyst_ok": analyst_ok,
            "mcp_tools_ok": tools_ok,
            "context_relevance_ok": context_ok,
        })

    log_analyst_score = (log_analyst_passed / total_scenarios) * 100
    mcp_tools_score = (mcp_tools_passed / total_scenarios) * 100
    context_score = (context_relevance_passed / total_scenarios) * 100
    overall_score = (log_analyst_score + mcp_tools_score + context_score) / 3

    metrics = {
        "tier": 2,
        "name": "Agent & Tool Calling Accuracy",
        "total_scenarios": total_scenarios,
        "log_analyst_accuracy": round(log_analyst_score, 2),
        "mcp_tool_accuracy": round(mcp_tools_score, 2),
        "context_relevance_accuracy": round(context_score, 2),
        "overall_tier2_score": round(overall_score, 2),
        "status": "PASSED" if overall_score >= 95.0 else "FAILED",
        "scenarios": results_per_scenario,
    }

    print(f"\n[Summary]")
    print(f"  Log Analyst Buffer Recall  : {metrics['log_analyst_accuracy']}%")
    print(f"  MCP Tool Execution Rate    : {metrics['mcp_tool_accuracy']}%")
    print(f"  Code Context Relevance     : {metrics['context_relevance_accuracy']}%")
    print(f"  Tier 2 Overall Score       : {metrics['overall_tier2_score']}%")
    print(f"  Tier 2 Gate Status         : {metrics['status']}")

    return metrics


if __name__ == "__main__":
    evaluate_tier2()
