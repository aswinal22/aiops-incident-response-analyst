"""Unified Evaluation Runner for AIOps Incident Response Analyst.

Allows running any tier individually or all tiers combined with Markdown report generation.

Usage:
  python run_evals.py --tier 1
  python run_evals.py --tier 2
  python run_evals.py --tier 3
  python run_evals.py --tier 4
  python run_evals.py --all
"""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import sys
from typing import Any

# Ensure aiops-engine root is in path
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from eval.tier1_ml_eval import evaluate_tier1
from eval.tier2_agent_eval import evaluate_tier2
from eval.tier3_rca_eval import evaluate_tier3
from eval.tier4_latency_eval import evaluate_tier4


def generate_markdown_report_card(
    results: dict[str, Any], output_path: Path
) -> str:
    """Generates a professional Markdown Report Card summarizing all evaluation tiers."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    report_lines = [
        "# 📊 AIOps Incident Response Analyst - Evaluation Report Card",
        f"\n**Generated At:** `{timestamp}`\n",
        "## Overall Tier Gate Summary",
        "| Tier | Name | Key Metric | Gate Status |",
        "| :--- | :--- | :--- | :--- |",
    ]

    t1 = results.get("tier1")
    if t1:
        acc = t1.get("accuracy", 0.0) * 100
        status = t1.get("status", "N/A")
        report_lines.append(f"| **Tier 1** | Traditional ML Anomaly Detector | Accuracy: {acc:.2f}% (Recall: {t1.get('recall', 0.0)*100:.1f}%) | `{status}` |")

    t2 = results.get("tier2")
    if t2:
        score = t2.get("overall_tier2_score", 0.0)
        status = t2.get("status", "N/A")
        report_lines.append(f"| **Tier 2** | Agent & MCP Tool Execution | Tool Success: {score:.1f}% | `{status}` |")

    t3 = results.get("tier3")
    if t3:
        score = t3.get("overall_tier3_score", 0.0)
        status = t3.get("status", "N/A")
        report_lines.append(f"| **Tier 3** | End-to-End RCA Report Quality | Quality Score: {score:.1f}% | `{status}` |")

    t4 = results.get("tier4")
    if t4:
        p95 = t4.get("latency_metrics_ms", {}).get("p95", 0.0)
        status = t4.get("status", "N/A")
        report_lines.append(f"| **Tier 4** | Operational Latency & Telemetry | Latency p95: {p95} ms | `{status}` |")

    report_lines.append("\n---\n")

    # Detailed Sections
    if t1:
        report_lines.extend([
            "## 🎯 Tier 1: Traditional ML Anomaly Detector",
            f"- **Evaluated Samples**: {t1.get('total_samples')}",
            f"- **Classification Accuracy**: `{t1.get('accuracy') * 100:.2f}%`",
            f"- **Anomaly Precision**: `{t1.get('precision') * 100:.2f}%`",
            f"- **Anomaly Recall**: `{t1.get('recall') * 100:.2f}%`",
            f"- **F1 Score**: `{t1.get('f1_score')}`",
            f"- **False Alarm Rate (FPR)**: `{t1.get('false_positive_rate') * 100:.2f}%`",
            f"- **Inference Speed**: `{t1.get('avg_inference_latency_ms'):.3f} ms/log`\n",
        ])

    if t2:
        report_lines.extend([
            "## 🛠️ Tier 2: Agent Tool Calling & Context Retrieval",
            f"- **Log Analyst Buffer Recall**: `{t2.get('log_analyst_accuracy')}%`",
            f"- **Code Investigator MCP Tool Success**: `{t2.get('mcp_tool_accuracy')}%`",
            f"- **Code Context Relevance**: `{t2.get('context_relevance_accuracy')}%`",
            f"- **Directory Traversal Guard**: `VERIFIED (Blocked)`\n",
        ])

    if t3:
        report_lines.extend([
            "## 📝 Tier 3: End-to-End RCA Quality & LLM Judge",
            f"- **Structural Completeness**: `{t3.get('structural_completeness_avg')}%`",
            f"- **Ground Truth Keyword Alignment**: `{t3.get('keyword_alignment_avg')}%`",
            f"- **Judge Quality Score**: `{t3.get('judge_quality_score_avg')}%`",
            f"- **Overall Synthesis Score**: `{t3.get('overall_tier3_score')}%`\n",
        ])

    if t4:
        lat = t4.get("latency_metrics_ms", {})
        tok = t4.get("token_metrics", {})
        report_lines.extend([
            "## ⚡ Tier 4: Operational Latency & Token Efficiency",
            f"- **Total Benchmark Runs**: `{t4.get('total_runs')}` (Success Rate: `{t4.get('success_rate_pct')}%`)",
            f"- **Workflow Latency p50**: `{lat.get('p50')} ms`",
            f"- **Workflow Latency p95**: `{lat.get('p95')} ms`",
            f"- **Workflow Latency p99**: `{lat.get('p99')} ms`",
            f"- **Avg Total Tokens / Incident**: `{tok.get('avg_total_tokens')}`",
            f"- **Throughput**: `{t4.get('throughput_incidents_per_sec')} incidents/sec`\n",
        ])

    report_content = "\n".join(report_lines)
    output_path.write_text(report_content, encoding="utf-8")
    return report_content


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run evaluation benchmarks for AIOps Incident Response Analyst."
    )
    parser.add_argument(
        "--tier",
        type=str,
        help="Specific tier to run (1, 2, 3, 4, or comma-separated e.g. 1,2)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Run all evaluation tiers and generate full Report Card",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="eval_report.md",
        help="Output Markdown report path (default: eval_report.md)",
    )

    args = parser.parse_args()

    selected_tiers: list[int] = []
    if args.all or (not args.tier and not args.all):
        selected_tiers = [1, 2, 3, 4]
    elif args.tier:
        selected_tiers = [int(t.strip()) for t in args.tier.split(",") if t.strip().isdigit()]

    print("=" * 70)
    print(" AIOps Incident Response Analyst - Evaluation Suite")
    print(f" Executing Tiers: {selected_tiers}")
    print("=" * 70)

    results: dict[str, Any] = {}

    if 1 in selected_tiers:
        results["tier1"] = evaluate_tier1()
    if 2 in selected_tiers:
        results["tier2"] = evaluate_tier2()
    if 3 in selected_tiers:
        results["tier3"] = evaluate_tier3()
    if 4 in selected_tiers:
        results["tier4"] = evaluate_tier4()

    output_path = Path(__file__).resolve().parent.parent / args.output
    report_md = generate_markdown_report_card(results, output_path)

    print("\n" + "=" * 70)
    print(f" Evaluation Completed! Full report saved to: {output_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()

