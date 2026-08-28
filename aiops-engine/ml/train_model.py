import os
from pathlib import Path
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


def train_anomaly_detector(
    dataset_path: Path, model_output_path: Path
) -> Pipeline:
    """Trains a TF-IDF + Logistic Regression pipeline for log anomaly detection."""
    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path, skipinitialspace=True)
    df.columns = [c.strip() for c in df.columns]

    x = df["log_text"]
    y = df["label"]

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    max_features=5000,
                    lowercase=True,
                    stop_words="english",
                ),
            ),
            ("clf", LogisticRegression(C=1.0, max_iter=1000, random_state=42)),
        ]
    )

    print("Fitting Scikit-Learn Pipeline...")
    pipeline.fit(x_train, y_train)

    y_pred = pipeline.predict(x_test)
    print("\nModel Evaluation Metrics:")
    print(classification_report(y_test, y_pred, target_names=["Normal", "Anomaly"]))

    model_output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_output_path)
    print(f"Model successfully saved to: {model_output_path}")

    return pipeline


if __name__ == "__main__":
    current_dir = Path(__file__).resolve().parent
    data_file = current_dir / "logs_dataset.csv"
    model_file = current_dir / "model.joblib"

    if not data_file.exists():
        from generate_data import generate_synthetic_logs
        generate_synthetic_logs(data_file)

    train_anomaly_detector(data_file, model_file)

