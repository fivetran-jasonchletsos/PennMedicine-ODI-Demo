"""
Build a static JSON snapshot of the Snowflake clinical + financial marts
for the React frontend.

Run locally:
    SNOWFLAKE_ACCOUNT=... SNOWFLAKE_USER=... SNOWFLAKE_PASSWORD=... \
    SNOWFLAKE_DATABASE=JASON_CHLETSOS_EPIC \
    SNOWFLAKE_WAREHOUSE=JASON_CHLETSOS_QUERY_WH \
        python scripts/build_snapshot.py

Without Snowflake credentials the script falls back to a synthetic
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

DATABASE = os.getenv("SNOWFLAKE_DATABASE", "JASON_CHLETSOS_EPIC")
CLINICAL = os.getenv("SNOWFLAKE_CLINICAL_SCHEMA", "CLINICAL")
FINANCIAL = os.getenv("SNOWFLAKE_FINANCIAL_SCHEMA", "FINANCIAL")


def have_snowflake() -> bool:
    return all(
        os.getenv(k)
        for k in ("SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD")
    )


def connect():
    import snowflake.connector  # type: ignore
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        role=os.getenv("SNOWFLAKE_ROLE", "JASON_CHLETSOS_DBT_ROLE"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "JASON_CHLETSOS_QUERY_WH"),
        database=DATABASE,
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

def from_snowflake() -> dict[str, Any]:
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
            FROM {DATABASE}.{CLINICAL}.fct_encounters
            """
        )
        summary_row = rows_to_dicts(cur)[0]

        cur.execute(
            f"""
            SELECT
                p.pat_id, p.med_rec_num,
                p.full_name, p.birth_date,
                DATEDIFF('year', p.birth_date, CURRENT_DATE()) AS age,
                p.sex, p.city, p.zip_code,
                p.primary_care_provider,
                COALESCE(p.active_chronic_count, 0) AS active_chronic_count,
                COALESCE(e.encounter_count, 0)      AS encounter_count,
                COALESCE(e.total_charges, 0)        AS total_charges,
                p.latitude, p.longitude
            FROM {DATABASE}.{CLINICAL}.dim_patients p
            LEFT JOIN (
                SELECT pat_id,
                       COUNT(*) AS encounter_count,
                       SUM(total_charges) AS total_charges
                FROM {DATABASE}.{CLINICAL}.fct_encounters
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
# Demo fallback so the site renders something even without Snowflake.

FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael",
               "Linda", "William", "Elizabeth", "David", "Barbara", "Anil", "Reshma",
               "Sofia", "Daniel", "Margaret", "Robert", "Aisha", "Kenji"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
              "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
              "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
              "Patel", "Okonkwo", "Walsh", "Greene", "Chen"]
CITIES = ["Pittsburgh", "Shaler", "Mt Lebanon", "Squirrel Hill", "Lawrenceville",
          "North Side", "Highland Park", "Aspinwall", "Oakland", "Shadyside"]
ZIPS = ["15116", "15217", "15222", "15206", "15212", "15201", "15228", "15215",
        "15213", "15232"]
PROVIDERS = ["Dr. Patel", "Dr. Nguyen", "Dr. Williams", "Dr. Chen", "Dr. Garcia",
             "Dr. Rodriguez", "Dr. Kim", "Dr. O'Connor"]


def fallback_dataset(n: int = 10000) -> dict[str, Any]:
    return synth_generate(n_patients=n)


def _legacy_demo_dataset(n: int = 240) -> dict[str, Any]:
    rng = random.Random(42)
    today = dt.date.today()
    patients: list[dict[str, Any]] = []
    for i in range(n):
        first = rng.choice(FIRST_NAMES)
        last = rng.choice(LAST_NAMES)
        age = rng.randint(2, 92)
        birth = today.replace(year=today.year - age, month=rng.randint(1, 12), day=rng.randint(1, 28))
        sex = rng.choice(["M", "F"])
        city_idx = rng.randint(0, len(CITIES) - 1)
        encounters = rng.randint(0, 25)
        chronic = rng.choices([0, 1, 2, 3, 4, 5], weights=[55, 22, 12, 6, 3, 2])[0]
        charge_per_visit = rng.randint(150, 4500)
        patients.append({
            "pat_id": f"PAT{100000 + i:06d}",
            "med_rec_num": f"MRN{100042 + i * 7:06d}",
            "full_name": f"{first} {last}",
            "birth_date": birth.isoformat(),
            "age": age,
            "sex": sex,
            "city": CITIES[city_idx],
            "zip_code": ZIPS[city_idx],
            "primary_care_provider": rng.choice(PROVIDERS),
            "active_chronic_count": chronic,
            "encounter_count": encounters,
            "total_charges": encounters * charge_per_visit,
            "latitude": 40.45 + (city_idx - 5) * 0.02,
            "longitude": -79.99 + (city_idx - 5) * 0.02,
        })
    summary = {
        "total_patients": n,
        "total_encounters": sum(p["encounter_count"] for p in patients),
        "total_diagnoses": sum(p["active_chronic_count"] for p in patients) * 2,
        "avg_encounter_cost": round(sum(p["total_charges"] for p in patients) / max(1, sum(p["encounter_count"] for p in patients)), 2),
        "active_chronic_count": sum(p["active_chronic_count"] for p in patients),
        "current_year": today.year,
    }
    return {"summary": summary, "patients": patients}


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
    # production from per-patient SELECTs against Snowflake). Frontend
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
    if have_snowflake():
        try:
            print("Pulling live snapshot from Snowflake…")
            bundle = from_snowflake()
            write_snapshot(bundle, source="live")
            return 0
        except Exception as e:  # noqa: BLE001
            print(f"Snowflake query failed: {e}", file=sys.stderr)
            print("Falling back to synthetic demo dataset.", file=sys.stderr)

    print("No Snowflake credentials — writing synthetic demo snapshot.")
    write_snapshot(fallback_dataset(), source="demo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
