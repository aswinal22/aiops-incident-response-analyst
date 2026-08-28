"""Tier 4 Evaluator: Operational Performance, Latency Percentiles (p50/p95), & Token Efficiency."""

import statistics
import sys
import time
from pathlib import Path
from typing import Any

# Ensure aiops-engine root is in path
base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from agents.graph import create_investigation_graph
from eval.dataset import GOLDEN_INCIDENTS


def calculate_percentile(data: list[float], percentile: float) -> float:
    """Calculates the specified percentile from a list of numerical values."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * (percentile / 100.0))
    idx = min(idx, len(sorted_data) - 1)
    return round(sorted_data[idx], 2)


def evaluate_tier4(iterations_per_scenario: int = 3) -> dict[str, Any]:
    """Runs repeated benchmark passes to compute latency percentiles and token efficiency."""
    print("\n" + "=" * 60)
    print(" Tier 4 Evaluation: Operational Latency & Token Efficiency")
    print("=" * 60)

    workflow_latencies: list[float] = []
    log_analyst_latencies: list[float] = []
    code_investigator_latencies: list[float] = []
    rca_synthesizer_latencies: list[float] = []

    input_tokens_list: list[int] = []
    output_tokens_list: list[int] = []
    total_tokens_list: list[int] = []

    successful_runs = 0
    total_runs = len(GOLDEN_INCIDENTS) * iterations_per_scenario

    print(f"Running {total_runs} benchmark passes ({iterations_per_scenario} per scenario)...")

    graph = create_investigation_graph()

    start_bench_t = time.perf_counter()

    for idx, incident in enumerate(GOLDEN_INCIDENTS):
        trigger_log = incident["trigger_log"]
        for it in range(iterations_per_scenario):
            try:
                initial_state = {
                    "log_message": trigger_log,
                    "related_logs": "",
                    "code_context": "",
                    "rca_report": "",
                    "metrics": {},
                }
                final_state = graph.invoke(initial_state)
                metrics = final_state.get("metrics", {})

                tot_lat = metrics.get("total_workflow_latency_ms", 0.0)
                la_lat = metrics.get("log_analyst", {}).get("latency_ms", 0.0)
                ci_lat = metrics.get("code_investigator", {}).get("latency_ms", 0.0)
                rca_metric = metrics.get("rca_synthesizer", {})
                rca_lat = rca_metric.get("latency_ms", 0.0)

                tok_usage = rca_metric.get("token_usage", {})
                in_tok = tok_usage.get("input_tokens", 0)
                out_tok = tok_usage.get("output_tokens", 0)
                tot_tok = tok_usage.get("total_tokens", 0)

                workflow_latencies.append(tot_lat)
                log_analyst_latencies.append(la_lat)
                code_investigator_latencies.append(ci_lat)
                rca_synthesizer_latencies.append(rca_lat)

                input_tokens_list.append(in_tok)
                output_tokens_list.append(out_tok)
                total_tokens_list.append(tot_tok)

                successful_runs += 1
            except Exception as e:
                print(f"  [Error during run]: {e}")

    total_bench_duration = time.perf_counter() - start_bench_t
    throughput = round(successful_runs / total_bench_duration, 2) if total_bench_duration > 0 else 0.0

    p50_lat = calculate_percentile(workflow_latencies, 50)
    p90_lat = calculate_percentile(workflow_latencies, 90)
    p95_lat = calculate_percentile(workflow_latencies, 95)
    p99_lat = calculate_percentile(workflow_latencies, 99)
    mean_lat = round(statistics.mean(workflow_latencies), 2) if workflow_latencies else 0.0

    avg_in_tok = round(statistics.mean(input_tokens_list), 1) if input_tokens_list else 0.0
    avg_out_tok = round(statistics.mean(output_tokens_list), 1) if output_tokens_list else 0.0
    avg_tot_tok = round(statistics.mean(total_tokens_list), 1) if total_tokens_list else 0.0

    sla_passed = p95_lat <= 5000.0 and (successful_runs == total_runs)

    results = {
        "tier": 4,
        "name": "Operational Performance & Telemetry",
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "success_rate_pct": round((successful_runs / total_runs) * 100, 2),
        "latency_metrics_ms": {
            "mean": mean_lat,
            "p50": p50_lat,
            "p90": p90_lat,
            "p95": p95_lat,
            "p99": p99_lat,
            "log_analyst_avg": round(statistics.mean(log_analyst_latencies), 2) if log_analyst_latencies else 0.0,
            "code_investigator_avg": round(statistics.mean(code_investigator_latencies), 2) if code_investigator_latencies else 0.0,
            "rca_synthesizer_avg": round(statistics.mean(rca_synthesizer_latencies), 2) if rca_synthesizer_latencies else 0.0,
        },
        "token_metrics": {
            "avg_input_tokens": avg_in_tok,
            "avg_output_tokens": avg_out_tok,
            "avg_total_tokens": avg_tot_tok,
        },
        "throughput_incidents_per_sec": throughput,
        "sla_p95_target_met": sla_passed,
        "status": "PASSED" if sla_passed else "FAILED",
    }

    print(f"\n[Results]")
    print(f"  Success Rate             : {results['success_rate_pct']}% ({successful_runs}/{total_runs})")
    print(f"  Mean Workflow Latency    : {mean_lat} ms")
    print(f"  p50 Workflow Latency     : {p50_lat} ms")
    print(f"  p95 Workflow Latency     : {p95_lat} ms")
    print(f"  p99 Workflow Latency     : {p99_lat} ms")
    print(f"  Avg Input Tokens         : {avg_in_tok}")
    print(f"  Avg Output Tokens        : {avg_out_tok}")
    print(f"  Avg Total Tokens         : {avg_tot_tok}")
    print(f"  Throughput               : {throughput} incidents/sec")
    print(f"  Tier 4 Gate Status       : {results['status']}")

    return results


if __name__ == "__main__":
    evaluate_tier4()

