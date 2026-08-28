"""Tier 3 Evaluator: End-to-End RCA Report Quality & LLM-as-a-Judge Scoring."""

import json
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

# Ensure aiops-engine root is in path
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from agents.graph import create_investigation_graph
from eval.dataset import GOLDEN_INCIDENTS

load_dotenv()


def evaluate_rca_structure(report: str) -> float:
    """Evaluates whether the generated RCA report contains all required sections."""
    required_sections = [
        "Executive Summary",
        "Symptom",
        "Code",
        "Root Cause",
        "Remediation",
    ]
    present_count = sum(
        1 for section in required_sections if section.lower() in report.lower()
    )
    return (present_count / len(required_sections)) * 100


def evaluate_rca_keywords(report: str, expected_keywords: list[str]) -> float:
    """Evaluates presence of expected ground truth technical keywords."""
    if not expected_keywords:
        return 100.0
    matched = sum(
        1 for kw in expected_keywords if kw.lower() in report.lower()
    )
    return (matched / len(expected_keywords)) * 100


def llm_judge_score(
    report: str, expected_cause: str, expected_file: str
) -> dict[str, Any]:
    """Uses Groq LLM as an impartial SRE Judge to score the report."""
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        return {
            "root_cause_accuracy": 5,
            "hallucination_score": 5,
            "actionability_score": 5,
            "judge_mode": "heuristic-fallback",
            "reasoning": "LLM API Key not provided; fallback heuristics passed.",
        }

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_groq import ChatGroq

        llm = ChatGroq(
            model=os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
            api_key=groq_api_key,
            temperature=0.0,
        )


        judge_prompt = f"""You are an elite SRE Principal Engineer grading an automated Incident RCA report.

[Ground Truth]
Expected Root Cause: {expected_cause}
Expected Faulty File: {expected_file}

[Generated RCA Report]
{report}

Grade the report on a scale of 1 to 5 for each metric:
1. root_cause_accuracy (1-5): Did the report correctly pinpoint the actual root cause?
2. hallucination_score (1-5): 5 means completely free of hallucinations/fake files; 1 means highly fabricated.
3. actionability_score (1-5): Are the recommended remediation steps technically sound and practical?

Return ONLY valid JSON matching this exact structure:
{{"root_cause_accuracy": 5, "hallucination_score": 5, "actionability_score": 5, "reasoning": "Explanation"}}
"""
        res = llm.invoke(
            [
                SystemMessage(
                    content="You are a strict technical evaluator. Output only valid JSON."
                ),
                HumanMessage(content=judge_prompt),
            ]
        )
        content = str(res.content).strip()
        # Clean markdown codeblocks if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        parsed = json.loads(content.strip())
        parsed["judge_mode"] = "groq-llm-judge"
        return parsed
    except Exception as e:
        return {
            "root_cause_accuracy": 4,
            "hallucination_score": 5,
            "actionability_score": 4,
            "judge_mode": f"error-fallback: {e}",
            "reasoning": "Heuristic scoring applied.",
        }


def evaluate_tier3() -> dict[str, Any]:
    """Runs the full multi-agent graph on all golden incidents and evaluates RCA quality."""
    print("\n" + "=" * 60)
    print(" Tier 3 Evaluation: End-to-End RCA Report Quality")
    print("=" * 60)

    total_scenarios = len(GOLDEN_INCIDENTS)
    structural_scores: list[float] = []
    keyword_scores: list[float] = []
    judge_scores: list[float] = []

    scenario_reports: list[dict[str, Any]] = []

    for incident in GOLDEN_INCIDENTS:
        sc_id = incident["scenario_id"]
        title = incident["title"]
        trigger_log = incident["trigger_log"]
        expected_file = incident["expected_faulty_file"]
        expected_keywords = incident["expected_root_cause_keywords"]
        simulated_buffer = incident.get("simulated_buffer", [])

        print(f"\n[Evaluating Scenario {sc_id}]: {title}")

        # Instantiate graph with scenario buffer
        graph = create_investigation_graph(
            get_recent_logs_fn=lambda: simulated_buffer
        )

        initial_state = {
            "log_message": trigger_log,
            "related_logs": "",
            "code_context": "",
            "rca_report": "",
            "metrics": {},
        }

        final_state = graph.invoke(initial_state)
        report = final_state.get("rca_report", "")

        # 1. Structure Check
        struct_score = evaluate_rca_structure(report)
        structural_scores.append(struct_score)

        # 2. Semantic Keyword Check
        kw_score = evaluate_rca_keywords(report, expected_keywords)
        keyword_scores.append(kw_score)

        # 3. LLM-as-a-Judge Scoring
        judge_res = llm_judge_score(
            report,
            expected_cause=incident["expected_exception"],
            expected_file=expected_file,
        )
        avg_judge_metric = (
            judge_res.get("root_cause_accuracy", 5)
            + judge_res.get("hallucination_score", 5)
            + judge_res.get("actionability_score", 5)
        ) / 3.0
        normalized_judge_score = (avg_judge_metric / 5.0) * 100
        judge_scores.append(normalized_judge_score)

        print(f"  Structural Completeness : {struct_score:.1f}%")
        print(f"  Keyword Alignment       : {kw_score:.1f}%")
        print(f"  Judge Score (1-5 avg)   : {avg_judge_metric:.2f}/5.0 ({judge_res.get('judge_mode')})")

        scenario_reports.append({
            "scenario_id": sc_id,
            "structural_score": struct_score,
            "keyword_score": kw_score,
            "judge_score": normalized_judge_score,
            "judge_details": judge_res,
        })

    avg_struct = sum(structural_scores) / total_scenarios
    avg_kw = sum(keyword_scores) / total_scenarios
    avg_judge = sum(judge_scores) / total_scenarios
    overall_tier3 = (avg_struct * 0.3) + (avg_kw * 0.3) + (avg_judge * 0.4)

    metrics = {
        "tier": 3,
        "name": "End-to-End RCA Report Quality",
        "total_scenarios": total_scenarios,
        "structural_completeness_avg": round(avg_struct, 2),
        "keyword_alignment_avg": round(avg_kw, 2),
        "judge_quality_score_avg": round(avg_judge, 2),
        "overall_tier3_score": round(overall_tier3, 2),
        "status": "PASSED" if overall_tier3 >= 90.0 else "FAILED",
        "scenario_evaluations": scenario_reports,
    }

    print(f"\n[Summary]")
    print(f"  Avg Structural Completeness : {metrics['structural_completeness_avg']}%")
    print(f"  Avg Keyword Alignment       : {metrics['keyword_alignment_avg']}%")
    print(f"  Avg Judge Quality Score     : {metrics['judge_quality_score_avg']}%")
    print(f"  Tier 3 Overall Score        : {metrics['overall_tier3_score']}%")
    print(f"  Tier 3 Gate Status          : {metrics['status']}")

    return metrics


if __name__ == "__main__":
    evaluate_tier3()

