"""Tier 1 Evaluator: Upstream ML Anomaly Detection Model Performance."""

from pathlib import Path
import time
from typing import Any
import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)


def evaluate_tier1(
    model_path: Path | None = None, dataset_path: Path | None = None
) -> dict[str, Any]:
    """Evaluates the traditional ML classifier against the test dataset."""
    base_dir = Path(__file__).resolve().parent.parent
    if model_path is None:
        model_path = base_dir / "ml" / "model.joblib"
    if dataset_path is None:
        dataset_path = base_dir / "ml" / "logs_dataset.csv"

    print("\n" + "=" * 60)
    print(" Tier 1 Evaluation: Traditional ML Anomaly Detector")
    print("=" * 60)

    if not model_path.exists():
        raise FileNotFoundError(f"Model file not found at: {model_path}")
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found at: {dataset_path}")

    print(f"Loading Model: {model_path.name}")
    print(f"Loading Dataset: {dataset_path.name}")

    pipeline = joblib.load(model_path)
    df = pd.read_csv(dataset_path, skipinitialspace=True)
    df.columns = [c.strip() for c in df.columns]

    x = df["log_text"]
    y_true = df["label"]


    start_t = time.perf_counter()
    y_pred = pipeline.predict(x)
    inference_time_ms = ((time.perf_counter() - start_t) / len(x)) * 1000

    acc = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, pos_label=1))
    rec = float(recall_score(y_true, y_pred, pos_label=1))
    f1 = float(f1_score(y_true, y_pred, pos_label=1))

    tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
    fpr = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    fnr = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0

    metrics = {
        "tier": 1,
        "name": "ML Anomaly Detector",
        "total_samples": len(df),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "false_negative_rate": round(fnr, 4),
        "avg_inference_latency_ms": round(inference_time_ms, 4),
        "status": "PASSED" if (acc >= 0.95 and rec >= 0.95) else "FAILED",
    }

    print(f"\n[Results]")
    print(f"  Total Samples Evaluated  : {metrics['total_samples']}")
    print(f"  Accuracy                : {metrics['accuracy'] * 100:.2f}%")
    print(f"  Anomaly Precision       : {metrics['precision'] * 100:.2f}%")
    print(f"  Anomaly Recall          : {metrics['recall'] * 100:.2f}%")
    print(f"  F1 Score                : {metrics['f1_score']:.4f}")
    print(f"  False Positive Rate     : {metrics['false_positive_rate'] * 100:.2f}%")
    print(f"  False Negative Rate     : {metrics['false_negative_rate'] * 100:.2f}%")
    print(f"  Avg Inference Latency   : {metrics['avg_inference_latency_ms']:.3f} ms/log")
    print(f"  Tier 1 Gate Status      : {metrics['status']}")

    return metrics


if __name__ == "__main__":
    evaluate_tier1()
