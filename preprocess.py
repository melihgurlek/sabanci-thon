"""
Data pipeline: merges blood, clinical, and pathological data into
a single patients_final.json file ready for model training and frontend.
"""

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path("data")


def load_json(filename: str) -> list[dict]:
    with open(DATA_DIR / filename, encoding="utf-8") as f:
        return json.load(f)


def flag_analyte(value, sex: str, ref: dict) -> str:
    """Return 'low' | 'normal' | 'high' | 'unknown' based on reference range and patient sex."""
    sex_key = "male" if sex == "male" else "female"
    low = ref.get(f"normal_{sex_key}_min")
    high = ref.get(f"normal_{sex_key}_max")

    # fall back to male ranges if female ranges missing
    if low is None and high is None:
        low = ref.get("normal_male_min")
        high = ref.get("normal_male_max")

    if low is None and high is None:
        return "unknown"
    if low is None:
        return "normal" if value <= high else "high"
    if high is None:
        return "normal" if value >= low else "low"
    if value < low:
        return "low"
    if value > high:
        return "high"
    return "normal"


def pivot_blood_data(blood_df: pd.DataFrame, ref_lookup: dict, sex_lookup: dict) -> pd.DataFrame:
    """
    Pivot long-format blood data to one row per patient.
    Preference: day=0; fallback to day closest to 0.
    Returns a DataFrame with columns:
      analyte_<name>_value, analyte_<name>_flag, analyte_<name>_unit,
      analyte_<name>_days (which measurement day was used),
      blood_analyte_count (how many distinct analytes were recorded)
    Also returns a longitudinal dict (patient_id -> list of {analyte, day, value}).
    """
    # pick best day per patient/analyte: prefer day=0, then min absolute day
    blood_df = blood_df.copy()
    blood_df["abs_day"] = blood_df["days_before_first_treatment"].abs()
    blood_df_sorted = blood_df.sort_values(
        ["patient_id", "analyte_name", "abs_day", "days_before_first_treatment"]
    )
    best = blood_df_sorted.groupby(["patient_id", "analyte_name"]).first().reset_index()

    # longitudinal: all measurements per patient/analyte (for trend chart)
    longitudinal: dict[str, list[dict]] = {}
    for _, row in blood_df.iterrows():
        pid = row["patient_id"]
        if pid not in longitudinal:
            longitudinal[pid] = []
        longitudinal[pid].append(
            {
                "analyte": row["analyte_name"],
                "day": int(row["days_before_first_treatment"]),
                "value": float(row["value"]) if not pd.isna(row["value"]) else None,
            }
        )

    # analyte metadata (unit, group, LOINC)
    analyte_meta: dict[str, dict] = {}
    for _, row in best.iterrows():
        name = row["analyte_name"]
        if name not in analyte_meta:
            analyte_meta[name] = {
                "unit": row.get("unit"),
                "group": row.get("group"),
                "LOINC_name": row.get("LOINC_name"),
            }

    # count distinct analytes per patient
    analyte_counts = best.groupby("patient_id")["analyte_name"].nunique().rename("blood_analyte_count")

    # pivot to wide
    wide = best.pivot(index="patient_id", columns="analyte_name", values="value")
    wide.columns = [f"analyte_{col}" for col in wide.columns]

    # day used per analyte
    day_wide = best.pivot(index="patient_id", columns="analyte_name", values="days_before_first_treatment")
    day_wide.columns = [f"analyte_{col}_day" for col in day_wide.columns]

    result = pd.concat([wide, day_wide, analyte_counts], axis=1).reset_index()

    return result, analyte_meta, longitudinal


def build_biomarker_flags(row: pd.Series, analytes: list[str], ref_lookup: dict) -> dict:
    sex = row.get("sex", "male")
    flags = {}
    for analyte in analytes:
        val = row.get(f"analyte_{analyte}")
        if val is None or (isinstance(val, float) and math.isnan(val)):
            flags[analyte] = None
        else:
            ref = ref_lookup.get(analyte, {})
            flags[analyte] = flag_analyte(float(val), sex, ref)
    return flags


def impute_numeric_medians(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for col in cols:
        median = df[col].median()
        df[col] = df[col].fillna(median)
    return df


def impute_categorical_mode(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for col in cols:
        mode_vals = df[col].mode()
        if len(mode_vals) > 0:
            df[col] = df[col].fillna(mode_vals[0])
    return df


def encode_ordinal(series: pd.Series, ordered_values: list) -> pd.Series:
    mapping = {v: i for i, v in enumerate(ordered_values)}
    return series.map(mapping)


def normalize_pT_stage(val: str) -> str:
    """Normalize pT stage to a clean ordinal value."""
    if not isinstance(val, str):
        return "unknown"
    v = val.strip().upper()
    if v in ("PT4A", "PT4B"):
        return "pT4"
    if v.startswith("PT"):
        return "p" + v[1:3]  # e.g. pT2
    return val


def normalize_pN_stage(val: str) -> str:
    if not isinstance(val, str):
        return "unknown"
    v = val.strip().upper()
    if v == "NX":
        return "NX"
    if v.startswith("PN0"):
        return "pN0"
    if v.startswith("PN1"):
        return "pN1"
    if v.startswith("PN2"):
        return "pN2"
    if v.startswith("PN3"):
        return "pN3"
    return val


def main():
    print("Loading data files...")
    blood_raw = load_json("blood_data.json")
    clinical_raw = load_json("clinical_data.json")
    pathological_raw = load_json("pathological_data.json")
    ref_ranges_raw = load_json("blood_data_reference_ranges.json")

    # Reference range lookup: analyte_name -> range dict
    ref_lookup: dict[str, dict] = {r["analyte_name"]: r for r in ref_ranges_raw}
    ref_ranges_export = ref_lookup  # for export

    blood_df = pd.DataFrame(blood_raw)
    clinical_df = pd.DataFrame(clinical_raw)
    pathological_df = pd.DataFrame(pathological_raw)

    print(f"Blood records: {len(blood_df)}")
    print(f"Clinical records: {len(clinical_df)}")
    print(f"Pathological records: {len(pathological_df)}")

    # Build sex lookup for biomarker flagging
    sex_lookup = dict(zip(clinical_df["patient_id"], clinical_df["sex"]))

    # Pivot blood data
    print("Pivoting blood data...")
    blood_wide, analyte_meta, longitudinal = pivot_blood_data(blood_df, ref_lookup, sex_lookup)

    # Merge all three on patient_id
    print("Merging datasets...")
    merged = clinical_df.merge(pathological_df, on="patient_id", how="outer")
    merged = merged.merge(blood_wide, on="patient_id", how="left")

    print(f"Merged records: {len(merged)}")

    # Patients with all three sources
    has_blood = merged["blood_analyte_count"].notna()
    has_clinical = merged["survival_status"].notna()
    has_pathological = merged["primary_tumor_site"].notna()
    full_cohort = merged[has_blood & has_clinical & has_pathological].copy()
    print(f"Full cohort (all 3 sources): {len(full_cohort)}")

    # Normalize stages
    full_cohort["pT_stage_norm"] = full_cohort["pT_stage"].apply(normalize_pT_stage)
    full_cohort["pN_stage_norm"] = full_cohort["pN_stage"].apply(normalize_pN_stage)

    # Fix grading quirk: some rows have 'hpv_association_p16' as grading value
    full_cohort.loc[
        full_cohort["grading"] == "hpv_association_p16", "grading"
    ] = None

    # All analyte column names
    analyte_cols = [c.replace("analyte_", "") for c in full_cohort.columns if c.startswith("analyte_") and not c.endswith("_day")]
    analyte_cols = [c for c in analyte_cols if c != "count"]

    # Compute data_completeness per patient
    analyte_value_cols = [f"analyte_{a}" for a in analyte_cols]
    blood_total = len(analyte_cols)
    def completeness(row):
        present = sum(1 for c in analyte_value_cols if not pd.isna(row.get(c)))
        return round(present / blood_total, 3) if blood_total > 0 else 0.0
    full_cohort["blood_completeness"] = full_cohort.apply(completeness, axis=1)

    # Build output records
    print("Building output records...")
    output_records = []

    for _, row in full_cohort.iterrows():
        pid = str(row["patient_id"])
        sex = str(row.get("sex", ""))

        # Biomarker flags per analyte
        biomarker_flags = build_biomarker_flags(row, analyte_cols, ref_lookup)

        # Raw analyte values for export
        analyte_values = {}
        for a in analyte_cols:
            v = row.get(f"analyte_{a}")
            analyte_values[a] = float(v) if (v is not None and not (isinstance(v, float) and math.isnan(v))) else None

        # Longitudinal blood trend
        trend = longitudinal.get(pid, [])

        record = {
            "patient_id": pid,
            # Clinical
            "age": int(row["age_at_initial_diagnosis"]) if not pd.isna(row.get("age_at_initial_diagnosis")) else None,
            "sex": sex,
            "smoking_status": str(row.get("smoking_status", "")) if not pd.isna(row.get("smoking_status")) else None,
            "survival_status": str(row.get("survival_status", "")),
            "survival_status_with_cause": str(row.get("survival_status_with_cause", "")) if not pd.isna(row.get("survival_status_with_cause")) else None,
            "days_to_last_information": int(row["days_to_last_information"]) if not pd.isna(row.get("days_to_last_information")) else None,
            "first_treatment_intent": str(row.get("first_treatment_intent", "")) if not pd.isna(row.get("first_treatment_intent")) else None,
            "first_treatment_modality": str(row.get("first_treatment_modality", "")) if not pd.isna(row.get("first_treatment_modality")) else None,
            "adjuvant_radiotherapy": str(row.get("adjuvant_radiotherapy", "")) if not pd.isna(row.get("adjuvant_radiotherapy")) else None,
            "adjuvant_systemic_therapy": str(row.get("adjuvant_systemic_therapy", "")) if not pd.isna(row.get("adjuvant_systemic_therapy")) else None,
            "adjuvant_radiochemotherapy": str(row.get("adjuvant_radiochemotherapy", "")) if not pd.isna(row.get("adjuvant_radiochemotherapy")) else None,
            "recurrence": str(row.get("recurrence", "")) if not pd.isna(row.get("recurrence")) else None,
            "days_to_recurrence": int(row["days_to_recurrence"]) if not pd.isna(row.get("days_to_recurrence")) else None,
            "primarily_metastasis": str(row.get("primarily_metastasis", "")) if not pd.isna(row.get("primarily_metastasis")) else None,
            "metastasis_locations": [
                loc for loc in [
                    row.get("metastasis_1_locations"),
                    row.get("metastasis_2_locations"),
                    row.get("metastasis_3_locations"),
                    row.get("metastasis_4_locations"),
                ] if loc and not (isinstance(loc, float) and math.isnan(loc))
            ],
            # Pathological
            "primary_tumor_site": str(row.get("primary_tumor_site", "")) if not pd.isna(row.get("primary_tumor_site")) else None,
            "pT_stage": str(row.get("pT_stage", "")) if not pd.isna(row.get("pT_stage")) else None,
            "pT_stage_norm": str(row.get("pT_stage_norm", "")) if not pd.isna(row.get("pT_stage_norm")) else None,
            "pN_stage": str(row.get("pN_stage", "")) if not pd.isna(row.get("pN_stage")) else None,
            "pN_stage_norm": str(row.get("pN_stage_norm", "")) if not pd.isna(row.get("pN_stage_norm")) else None,
            "grading": str(row.get("grading", "")) if not pd.isna(row.get("grading")) else None,
            "hpv_association_p16": str(row.get("hpv_association_p16", "")) if not pd.isna(row.get("hpv_association_p16")) else None,
            "resection_status": str(row.get("resection_status", "")) if not pd.isna(row.get("resection_status")) else None,
            "histologic_type": str(row.get("histologic_type", "")) if not pd.isna(row.get("histologic_type")) else None,
            "perinodal_invasion": str(row.get("perinodal_invasion", "")) if not pd.isna(row.get("perinodal_invasion")) else None,
            "lymphovascular_invasion_L": str(row.get("lymphovascular_invasion_L", "")) if not pd.isna(row.get("lymphovascular_invasion_L")) else None,
            "infiltration_depth_in_mm": float(row["infiltration_depth_in_mm"]) if not pd.isna(row.get("infiltration_depth_in_mm")) else None,
            "number_of_positive_lymph_nodes": int(row["number_of_positive_lymph_nodes"]) if not pd.isna(row.get("number_of_positive_lymph_nodes")) else None,
            # Blood
            "blood_completeness": float(row["blood_completeness"]),
            "blood_analyte_count": int(row["blood_analyte_count"]) if not pd.isna(row.get("blood_analyte_count")) else 0,
            "analyte_values": analyte_values,
            "biomarker_flags": biomarker_flags,
            "blood_trend": trend,
        }
        output_records.append(record)

    # Export analyte metadata
    analyte_meta_export = {}
    for name, meta in analyte_meta.items():
        ref = ref_lookup.get(name, {})
        analyte_meta_export[name] = {
            "unit": meta.get("unit"),
            "group": meta.get("group"),
            "LOINC_name": meta.get("LOINC_name"),
            "normal_male_min": ref.get("normal_male_min"),
            "normal_male_max": ref.get("normal_male_max"),
            "normal_female_min": ref.get("normal_female_min"),
            "normal_female_max": ref.get("normal_female_max"),
        }

    patients_final = {
        "patients": output_records,
        "analyte_metadata": analyte_meta_export,
    }

    out_path = DATA_DIR / "patients_final.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(patients_final, f, ensure_ascii=False, allow_nan=False, indent=1)

    print(f"\nWrote {len(output_records)} patients to {out_path}")
    print(f"Analytes tracked: {len(analyte_meta_export)}")

    # Quick summary stats
    living = sum(1 for r in output_records if r["survival_status"] == "living")
    deceased = sum(1 for r in output_records if r["survival_status"] == "deceased")
    recurrence = sum(1 for r in output_records if r.get("recurrence") == "yes")
    print(f"Survival: {living} living / {deceased} deceased")
    print(f"Recurrence: {recurrence} yes")
    print("Done. Run train_model.py next.")


if __name__ == "__main__":
    main()
