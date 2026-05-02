"""
Model training: loads patients_final.json, trains two logistic regression models
(survival + recurrence), and writes patients_with_predictions.json and model_metadata.json.
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder, StandardScaler

DATA_DIR = Path("data")


def load_json(filename: str):
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


# Analytes most clinically relevant for HNSCC outcomes (from literature)
BLOOD_FEATURES = [
    "CRP", "Hemoglobin", "Leukocytes", "Lymphocytes", "Albumin",
    "Platelets", "Sodium", "Creatinine", "Glucose", "Neutrophils",
]

CATEGORICAL_FEATURES = {
    "sex": ["female", "male"],
    "smoking_status": ["non-smoker", "former", "smoker"],
    "primary_tumor_site": ["Oropharynx", "Oral_Cavity", "Larynx", "Hypopharynx", "CUP"],
    "pT_stage_norm": ["pT1", "pT2", "pT3", "pT4", "pTX", "unknown"],
    "pN_stage_norm": ["NX", "pN0", "pN1", "pN2", "pN3", "unknown"],
    "hpv_association_p16": ["negative", "not_tested", "positive"],
    "resection_status": ["R0", "R1", "R2", "unknown"],
    "grading": ["G1", "G2", "G3"],
    "perinodal_invasion": ["no", "yes"],
    "lymphovascular_invasion_L": ["no", "yes"],
}

NUMERIC_FEATURES = [
    "age",
    "infiltration_depth_in_mm",
    "number_of_positive_lymph_nodes",
    "blood_completeness",
]


def safe_float(val): #-> float | None: # removed here because "|" throws error.
    if val is None:
        return None
    try:
        v = float(val)
        return None if math.isnan(v) else v
    except (TypeError, ValueError):
        return None


def build_feature_matrix(records: list[dict]) -> tuple[pd.DataFrame, list[str]]:
    rows = []
    for r in records:
        row = {}

        # Numeric clinical/pathological features
        for feat in NUMERIC_FEATURES:
            row[feat] = safe_float(r.get(feat))

        # Categorical: ordinal encoding based on predefined order
        for feat, levels in CATEGORICAL_FEATURES.items():
            val = r.get(feat)
            if val in levels:
                row[feat] = levels.index(val)
            else:
                row[feat] = None  # will be imputed

        # Blood analytes
        analyte_vals = r.get("analyte_values", {})
        for analyte in BLOOD_FEATURES:
            row[f"blood_{analyte}"] = safe_float(analyte_vals.get(analyte))

        rows.append(row)

    df = pd.DataFrame(rows)
    feature_names = list(df.columns)

    return df, feature_names


def impute_df(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in df.columns:
        if df[col].isna().any():
            if pd.api.types.is_float_dtype(df[col]) or pd.api.types.is_integer_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                mode = df[col].mode()
                fill_val = mode[0] if len(mode) > 0 else 0
                df[col] = df[col].fillna(fill_val).infer_objects(copy=False)
    return df


def get_top_factors(
    coef: np.ndarray,
    feature_values: np.ndarray,
    feature_names: list[str],
    scaler_mean: np.ndarray,
    scaler_std: np.ndarray,
    n: int = 5,
) -> list[dict]:
    """
    Compute feature contributions as coef * (x - mean) / std (i.e. contribution in log-odds space).
    Returns the top n by absolute value.
    """
    # feature_values are already scaled; contribution is coef * scaled_value
    contributions = coef * feature_values

    indexed = sorted(
        enumerate(contributions), key=lambda x: abs(x[1]), reverse=True
    )[:n]

    result = []
    for idx, contrib in indexed:
        name = feature_names[idx]
        result.append(
            {
                "feature": name,
                "contribution": float(round(contrib, 4)),
                "direction": "increases_risk" if contrib > 0 else "decreases_risk",
            }
        )
    return result


def human_label(feature_name: str) -> str:
    """Convert internal feature name to a readable label."""
    labels = {
        "age": "Age",
        "infiltration_depth_in_mm": "Infiltration Depth",
        "number_of_positive_lymph_nodes": "Positive Lymph Nodes",
        "blood_completeness": "Blood Data Completeness",
        "sex": "Sex",
        "smoking_status": "Smoking Status",
        "primary_tumor_site": "Tumor Site",
        "pT_stage_norm": "Tumor Stage (pT)",
        "pN_stage_norm": "Node Stage (pN)",
        "hpv_association_p16": "HPV Status (p16)",
        "resection_status": "Resection Status",
        "grading": "Tumor Grade",
        "perinodal_invasion": "Perinodal Invasion",
        "lymphovascular_invasion_L": "Lymphovascular Invasion",
    }
    if feature_name in labels:
        return labels[feature_name]
    if feature_name.startswith("blood_"):
        return feature_name.replace("blood_", "") + " (blood)"
    return feature_name


def compute_risk_percentiles(probs: list[float]) -> dict:
    """Derive low/medium/high thresholds from cohort distribution (33rd and 66th percentiles)."""
    arr = np.array(probs)
    return {
        "low_threshold": float(round(np.percentile(arr, 33), 3)),
        "high_threshold": float(round(np.percentile(arr, 66), 3)),
    }


def train_and_predict(
    X_scaled: np.ndarray,
    y: np.ndarray,
    feature_names: list[str],
    scaler_mean: np.ndarray,
    scaler_std: np.ndarray,
    label: str,
) -> tuple[np.ndarray, np.ndarray, list[list[dict]], LogisticRegression]:
    """Train logistic regression, return probabilities and top factors."""
    # class_weight='balanced' helps with imbalanced survival/recurrence targets
    model = LogisticRegression(
        max_iter=1000,
        class_weight="balanced",
        solver="lbfgs",
        C=1.0,
        random_state=42,
    )
    model.fit(X_scaled, y)
    probs = model.predict_proba(X_scaled)[:, 1]
    preds = model.predict(X_scaled)

    # Feature importance per patient
    coef = model.coef_[0]
    top_factors_list = []
    for i in range(len(X_scaled)):
        top_factors_list.append(
            get_top_factors(coef, X_scaled[i], feature_names, scaler_mean, scaler_std)
        )

    # Model performance
    from sklearn.metrics import roc_auc_score, accuracy_score
    acc = accuracy_score(y, preds)
    try:
        auc = roc_auc_score(y, probs)
    except ValueError:
        auc = float("nan")
    print(f"  {label}: accuracy={acc:.3f}, AUC={auc:.3f}, n={len(y)}, positive_rate={y.mean():.3f}")

    return probs, preds, top_factors_list, model, coef


def main():
    print("Loading patients_final.json...")
    import src.preprocess as preprocess
    data = preprocess.main()
    records = data["patients"]
    analyte_metadata = data["analyte_metadata"]
    print(f"  {len(records)} patients loaded")

    # Build feature matrix
    print("Building feature matrix...")
    X_df, feature_names = build_feature_matrix(records)
    X_df_imputed = impute_df(X_df)

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_df_imputed.values.astype(float))

    # Survival target
    survival_labels = np.array([1 if r["survival_status"] == "deceased" else 0 for r in records])
    recurrence_labels = np.array([1 if r.get("recurrence") == "yes" else 0 for r in records])

    print("Training models...")
    surv_probs, surv_preds, surv_factors, surv_model, surv_coef = train_and_predict(
        X_scaled, survival_labels, feature_names, scaler.mean_, scaler.scale_, "Survival"
    )
    rec_probs, rec_preds, rec_factors, rec_model, rec_coef = train_and_predict(
        X_scaled, recurrence_labels, feature_names, scaler.mean_, scaler.scale_, "Recurrence"
    )

    # Cohort risk distribution thresholds
    surv_thresholds = compute_risk_percentiles(surv_probs.tolist())
    rec_thresholds = compute_risk_percentiles(rec_probs.tolist())

    # Attach predictions to records
    print("Attaching predictions to patient records...")
    augmented = []
    for i, r in enumerate(records):
        r = dict(r)
        r["survival_prob"] = float(round(surv_probs[i], 4))
        r["survival_factors"] = [
            {**f, "label": human_label(f["feature"])} for f in surv_factors[i]
        ]
        r["recurrence_prob"] = float(round(rec_probs[i], 4))
        r["recurrence_factors"] = [
            {**f, "label": human_label(f["feature"])} for f in rec_factors[i]
        ]
        augmented.append(r)

    # Pick demo patients
    # Best low-risk living
    living_sorted = sorted(
        [r for r in augmented if r["survival_status"] == "living"],
        key=lambda r: r["survival_prob"]
    )
    # Best high-risk deceased
    deceased_sorted = sorted(
        [r for r in augmented if r["survival_status"] == "deceased"],
        key=lambda r: r["survival_prob"],
        reverse=True
    )
    # One with incomplete blood data
    incomplete_sorted = sorted(
        [r for r in augmented],
        key=lambda r: r["blood_completeness"]
    )
    demo_ids = []
    if living_sorted:
        demo_ids.append(living_sorted[0]["patient_id"])
    if deceased_sorted:
        demo_ids.append(deceased_sorted[0]["patient_id"])
    if incomplete_sorted:
        candidate = incomplete_sorted[0]
        if candidate["patient_id"] not in demo_ids:
            demo_ids.append(candidate["patient_id"])
        elif len(incomplete_sorted) > 1:
            demo_ids.append(incomplete_sorted[1]["patient_id"])

    print(f"  Demo patients: {demo_ids}")

    # Write patients_with_predictions.json
    output = {
        "patients": augmented,
        "analyte_metadata": analyte_metadata,
        "demo_patient_ids": demo_ids,
    }
    # out_path = DATA_DIR / "patients_with_predictions.json"
    # with open(out_path, "w", encoding="utf-8") as f:
    #     json.dump(output, f, ensure_ascii=False, allow_nan=False, indent=1)
    # print(f"  Wrote {out_path}")

    # Write model_metadata.json (needed for what-if mode in frontend)
    categorical_orders = CATEGORICAL_FEATURES

    model_metadata = {
        "feature_names": feature_names,
        "feature_labels": {name: human_label(name) for name in feature_names},
        "blood_features": BLOOD_FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": categorical_orders,
        "scaler_mean": scaler.mean_.tolist(),
        "scaler_std": scaler.scale_.tolist(),
        "survival_coef": surv_coef.tolist(),
        "survival_intercept": float(surv_model.intercept_[0]),
        "recurrence_coef": rec_coef.tolist(),
        "recurrence_intercept": float(rec_model.intercept_[0]),
        "survival_thresholds": surv_thresholds,
        "recurrence_thresholds": rec_thresholds,
    }

    # meta_path = DATA_DIR / "model_metadata.json"
    # with open(meta_path, "w", encoding="utf-8") as f:
    #     json.dump(model_metadata, f, ensure_ascii=False, indent=1)
    # print(f"  Wrote {meta_path}")

    print("\nDone! Frontend data files are ready.")
    return {"data":data, "output": output, "model_metadata": model_metadata}

if __name__ == "__main__":
    main()
