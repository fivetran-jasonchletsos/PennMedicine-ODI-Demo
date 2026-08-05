"""
Build a static JSON snapshot of the Databricks clinical + financial marts
for the React frontend.

Run locally:
    DATABRICKS_HOST=... DATABRICKS_HTTP_PATH=... DATABRICKS_TOKEN=... \
    DATABRICKS_CATALOG=jason_chletsos_pennmed \
        python scripts/build_snapshot.py

Without Databricks credentials the script falls back to a synthetic
demo dataset so the site is never empty.

Output:
    healthcare-app/frontend/public/data/summary.json
    healthcare-app/frontend/public/data/patients.json   (compact)
    healthcare-app/frontend/public/data/patients/<pat_id>.json
"""
from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

# Local module — keeps the realistic-Epic synthetic dataset isolated.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _synthetic import generate as synth_generate  # type: ignore  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "frontend" / "public" / "data"
PATIENT_DIR = OUTPUT_DIR / "patients"

CATALOG = os.getenv("DATABRICKS_CATALOG", "jason_chletsos_pennmed")
CLINICAL = os.getenv("DATABRICKS_CLINICAL_SCHEMA", "jason_chletsos_pennmed_clinical")
FINANCIAL = os.getenv("DATABRICKS_FINANCIAL_SCHEMA", "jason_chletsos_pennmed_financial")


def have_databricks() -> bool:
    return all(
        os.getenv(k)
        for k in ("DATABRICKS_HOST", "DATABRICKS_HTTP_PATH", "DATABRICKS_TOKEN")
    )


def connect():
    from databricks import sql  # type: ignore
    return sql.connect(
        server_hostname=os.environ["DATABRICKS_HOST"],
        http_path=os.environ["DATABRICKS_HTTP_PATH"],
        access_token=os.environ["DATABRICKS_TOKEN"],
    )


def rows_to_dicts(cur) -> list[dict[str, Any]]:
    cols = [c[0].lower() for c in cur.description]
    out = []
    for row in cur.fetchall():
        d = {}
        for i, c in enumerate(cols):
            v = row[i]
            if hasattr(v, "isoformat"):
                v = v.isoformat()
            elif v is not None and not isinstance(v, (int, float, str, bool, list, dict)):
                try:
                    v = float(v)
                except Exception:  # noqa: BLE001
                    v = str(v)
            d[c] = v
        out.append(d)
    return out


# ---------------------------------------------------------------------------

def from_databricks() -> dict[str, Any]:
    conn = connect()
    cur = conn.cursor()
    try:
        cur.execute(
            f"""
            SELECT
                COUNT(DISTINCT pat_id)      AS total_patients,
                COUNT(*)                    AS total_encounters,
                AVG(total_charges)          AS avg_encounter_cost,
                YEAR(MAX(contact_date))     AS current_year
            FROM {CATALOG}.{CLINICAL}.fct_encounters
            """
        )
        summary_row = rows_to_dicts(cur)[0]

        cur.execute(
            f"""
            SELECT
                p.pat_id, p.med_rec_num,
                p.full_name, p.birth_date,
                FLOOR(DATEDIFF(CURRENT_DATE(), p.birth_date) / 365.25) AS age,
                p.sex, p.city, p.zip_code,
                p.primary_care_provider,
                COALESCE(p.active_chronic_count, 0) AS active_chronic_count,
                COALESCE(e.encounter_count, 0)      AS encounter_count,
                COALESCE(e.total_charges, 0)        AS total_charges,
                p.latitude, p.longitude
            FROM {CATALOG}.{CLINICAL}.dim_patients p
            LEFT JOIN (
                SELECT pat_id,
                       COUNT(*) AS encounter_count,
                       SUM(total_charges) AS total_charges
                FROM {CATALOG}.{CLINICAL}.fct_encounters
                GROUP BY pat_id
            ) e ON p.pat_id = e.pat_id
            ORDER BY encounter_count DESC NULLS LAST
            """
        )
        patients = rows_to_dicts(cur)

        return {
            "summary": summary_row,
            "patients": patients,
        }
    finally:
        cur.close()
        conn.close()


# ---------------------------------------------------------------------------
# Demo fallback so the site renders something even without Databricks.


def fallback_dataset(n: int = 10000) -> dict[str, Any]:
    return synth_generate(n_patients=n)


# ---------------------------------------------------------------------------

LIST_COLUMNS = [
    "pat_id", "med_rec_num", "full_name", "birth_date", "age", "sex",
    "city", "zip_code", "primary_care_provider", "active_chronic_count",
    "encounter_count", "total_charges", "latitude", "longitude",
]


def write_snapshot(bundle: dict[str, Any], source: str):
    if PATIENT_DIR.exists():
        shutil.rmtree(PATIENT_DIR)
    PATIENT_DIR.mkdir(parents=True, exist_ok=True)

    generated_at = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    summary = {**bundle["summary"], "generated_at": generated_at, "source": source}
    (OUTPUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2))

    patients = bundle["patients"]
    rows = [[p.get(c) for c in LIST_COLUMNS] for p in patients]
    (OUTPUT_DIR / "patients.json").write_text(
        json.dumps({"count": len(rows), "columns": LIST_COLUMNS, "rows": rows}, separators=(",", ":"))
    )

    # Real per-patient detail bundles come from the generator (or in
    # production from per-patient SELECTs against Databricks). Frontend
    # synthesizes the rest from the list view if a detail is missing.
    details = bundle.get("details") if isinstance(bundle, dict) else None
    if details:
        for pid, detail in details.items():
            (PATIENT_DIR / f"{pid}.json").write_text(json.dumps(detail, indent=2))
        n_details = len(details)
    else:
        n_details = 0

    print(f"Wrote snapshot ({source}): {len(patients)} patients, {n_details} detail bundles")


def main() -> int:
    if have_databricks():
        try:
            print("Pulling live snapshot from Databricks…")
            bundle = from_databricks()
            write_snapshot(bundle, source="live")
            return 0
        except Exception as e:  # noqa: BLE001
            print(f"Databricks query failed: {e}", file=sys.stderr)
            print("Falling back to synthetic demo dataset.", file=sys.stderr)

    print("No Databricks credentials — writing synthetic demo snapshot.")
    write_snapshot(fallback_dataset(), source="demo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
