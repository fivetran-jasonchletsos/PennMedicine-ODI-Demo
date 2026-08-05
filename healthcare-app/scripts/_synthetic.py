"""
Synthetic Epic Clarity-like dataset generator for the demo fallback path.

The output of `generate(n)` shapes exactly like what build_snapshot.py would
get back from Snowflake — so the React frontend behaves identically whether
the data came from a live SQL → Fivetran → Snowflake → dbt pipeline or from
this generator.

Everything is deterministic via a seeded Random instance so the demo is
repeatable: the same patient always lives at the same address with the same
chronic conditions.
"""
from __future__ import annotations

import datetime as dt
import random
from typing import Any

# Common Allegheny + Pittsburgh-metro ZIPs with rough coordinates.
ZIP_CENTROIDS = [
    ("Pittsburgh",     "15217", 40.4378, -79.9301),   # Squirrel Hill
    ("Pittsburgh",     "15206", 40.4612, -79.9148),   # East Liberty
    ("Pittsburgh",     "15201", 40.4738, -79.9608),   # Lawrenceville
    ("Pittsburgh",     "15212", 40.4543, -80.0078),   # North Side
    ("Pittsburgh",     "15213", 40.4441, -79.9608),   # Oakland
    ("Pittsburgh",     "15232", 40.4504, -79.9305),   # Shadyside
    ("Pittsburgh",     "15222", 40.4445, -79.9968),   # Downtown
    ("Glenshaw",       "15116", 40.5278, -79.9598),
    ("Mt Lebanon",     "15228", 40.3756, -80.0509),
    ("Aspinwall",      "15215", 40.4923, -79.9051),
    ("Bethel Park",    "15102", 40.3299, -80.0392),
    ("Monroeville",    "15146", 40.4239, -79.7886),
    ("Robinson Twp",   "15205", 40.4453, -80.1037),
    ("Penn Hills",     "15235", 40.4753, -79.8348),
    ("McKeesport",     "15132", 40.3475, -79.8492),
    ("West Mifflin",   "15122", 40.3603, -79.9008),
    ("Plum",           "15239", 40.5022, -79.7625),
    ("Wexford",        "15090", 40.6296, -80.0584),
    ("Cranberry Twp",  "16066", 40.6843, -80.1058),
    ("Greensburg",     "15601", 40.3015, -79.5389),
]

FIRST_NAMES_F = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara",
                 "Susan", "Margaret", "Sandra", "Ashley", "Aisha", "Reshma", "Sofia",
                 "Kimberly", "Donna", "Carol", "Sharon", "Michelle", "Maria", "Janet"]
FIRST_NAMES_M = ["James", "John", "Robert", "Michael", "William", "David", "Richard",
                 "Joseph", "Thomas", "Daniel", "Anil", "Kenji", "Carlos", "Hassan",
                 "Christopher", "Mark", "Paul", "Andrew", "Kevin", "George"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
              "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
              "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
              "Patel", "Okonkwo", "Walsh", "Chen", "Greene", "Kim", "Nguyen",
              "O'Brien", "Schmidt", "Russo", "Petrov", "Singh", "Khan", "Park", "Wong"]

# Chronic conditions with realistic prevalence in a primary-care population.
# Tuple: (icd10, name, base_prevalence_pct, age_adjusted)
CHRONIC = [
    ("E11.9",  "Type 2 diabetes mellitus",                    9,  True),
    ("I10",    "Essential (primary) hypertension",            32, True),
    ("E78.5",  "Hyperlipidemia, unspecified",                 21, True),
    ("J44.9",  "Chronic obstructive pulmonary disease",       6,  True),
    ("J45.909","Unspecified asthma, uncomplicated",           8,  False),
    ("M19.90", "Unspecified osteoarthritis",                  14, True),
    ("F32.A",  "Depression, unspecified",                     11, False),
    ("F41.9",  "Anxiety disorder, unspecified",               13, False),
    ("N18.3",  "Chronic kidney disease, stage 3",             4,  True),
    ("I50.9",  "Heart failure, unspecified",                  3,  True),
    ("G47.33", "Obstructive sleep apnea (adult)",             7,  False),
    ("E66.9",  "Obesity, unspecified",                        18, False),
    ("K21.9",  "GERD without esophagitis",                    12, False),
    ("M54.50", "Low back pain, unspecified",                  15, False),
]

ACUTE_DX = [
    ("J20.9", "Acute bronchitis, unspecified"),
    ("J06.9", "Acute upper respiratory infection"),
    ("N39.0", "Urinary tract infection"),
    ("S00.93", "Contusion of head"),
    ("R10.9", "Unspecified abdominal pain"),
    ("R51",   "Headache"),
    ("R07.9", "Chest pain, unspecified"),
    ("J45.901","Unspecified asthma with exacerbation"),
    ("L03.90","Cellulitis, unspecified"),
    ("M25.50","Pain in unspecified joint"),
]

DEPARTMENTS = [
    ("Internal Medicine — Squirrel Hill",   "IM-SH"),
    ("Family Medicine — North Hills",       "FM-NH"),
    ("Emergency Department — Main",         "ED-MAIN"),
    ("Cardiology",                          "CARD"),
    ("Endocrinology",                       "ENDO"),
    ("Pulmonology",                         "PULM"),
    ("Orthopedics",                         "ORTHO"),
    ("Psychiatry & Behavioral Health",      "PSYCH"),
    ("Nephrology",                          "NEPH"),
    ("OB-GYN",                              "OBGYN"),
    ("Pediatrics — Children's Hospital",    "PEDS"),
    ("Urgent Care — Mt Lebanon",            "UC-ML"),
]

PROVIDER_FIRST = ["Sarah", "David", "Aisha", "Michael", "Priya", "James", "Maria",
                  "Daniel", "Linda", "Hassan", "Emily", "Kenji", "Ashley", "Carlos",
                  "Rachel", "Anil", "Jennifer", "Mark", "Sophia", "Robert"]
PROVIDER_LAST = LAST_NAMES

ENCOUNTER_TYPES = [
    ("Office Visit",     0.55),
    ("Telehealth",       0.18),
    ("Hospital Admission", 0.04),
    ("Emergency Visit",  0.08),
    ("Lab Only",         0.07),
    ("Procedure",        0.05),
    ("Follow-up",        0.03),
]

PAYERS = [
    ("UPMC Health Plan",     0.27),
    ("Highmark BCBS",        0.31),
    ("Aetna",                0.09),
    ("Cigna",                0.06),
    ("Medicare",             0.18),
    ("Medicaid",             0.07),
    ("Self-pay",             0.02),
]

# Encounter-type → base charge range
CHARGE_RANGES = {
    "Office Visit":         (180, 420),
    "Telehealth":           (95, 220),
    "Hospital Admission":   (4800, 38000),
    "Emergency Visit":      (1200, 6500),
    "Lab Only":             (45, 320),
    "Procedure":            (900, 7500),
    "Follow-up":            (120, 280),
}


def _weighted_choice(rng: random.Random, items_with_weight: list[tuple[Any, float]]):
    total = sum(w for _, w in items_with_weight)
    r = rng.random() * total
    cum = 0.0
    for item, w in items_with_weight:
        cum += w
        if r <= cum:
            return item
    return items_with_weight[-1][0]


def _chronic_for(rng: random.Random, age: int) -> list[tuple[str, str, str]]:
    """Returns list of (icd10, name, first_recorded ISO date)."""
    today = dt.date.today()
    out = []
    for icd, name, base_pct, age_adj in CHRONIC:
        pct = base_pct
        if age_adj:
            if age < 30: pct *= 0.15
            elif age < 50: pct *= 0.45
            elif age < 65: pct *= 1.0
            elif age < 80: pct *= 1.8
            else: pct *= 2.2
        if rng.random() * 100 < pct:
            years_back = rng.randint(1, max(2, age - 18))
            first = today.replace(year=today.year - years_back)
            out.append((icd, name, first.isoformat()))
    return out


def _encounters_for(rng: random.Random, base: int) -> list[tuple[str, str, str]]:
    """Returns list of (type, contact_date ISO, chief_complaint)."""
    today = dt.date.today()
    out = []
    for _ in range(base):
        etype = _weighted_choice(rng, ENCOUNTER_TYPES)
        days_ago = rng.randint(1, 730)  # last 2 years
        date = (today - dt.timedelta(days=days_ago)).isoformat()
        complaint = rng.choice(ACUTE_DX)[1] if rng.random() < 0.7 else None
        out.append((etype, date, complaint))
    out.sort(key=lambda x: x[1], reverse=True)
    return out


def generate(n_patients: int = 10000, seed: int = 42) -> dict[str, Any]:
    rng = random.Random(seed)
    today = dt.date.today()

    providers = []
    for i in range(40):
        providers.append(f"Dr. {rng.choice(PROVIDER_FIRST)} {rng.choice(PROVIDER_LAST)}")

    patients_list: list[dict[str, Any]] = []
    detail_bundles: dict[str, dict[str, Any]] = {}

    for i in range(n_patients):
        age = rng.choices(
            [rng.randint(0, 17), rng.randint(18, 34), rng.randint(35, 54),
             rng.randint(55, 64), rng.randint(65, 79), rng.randint(80, 95)],
            weights=[8, 18, 24, 16, 22, 12],
        )[0]
        sex = rng.choice(["M", "F"])
        first = rng.choice(FIRST_NAMES_M if sex == "M" else FIRST_NAMES_F)
        last = rng.choice(LAST_NAMES)
        full_name = f"{first} {last}"
        birth = today.replace(year=today.year - age, month=rng.randint(1, 12), day=rng.randint(1, 28))
        city, zip_code, lat, lng = rng.choice(ZIP_CENTROIDS)
        # jitter so multiple patients in same ZIP don't render on top
        lat += (rng.random() - 0.5) * 0.012
        lng += (rng.random() - 0.5) * 0.012

        chronic = _chronic_for(rng, age)
        # higher chronic burden → more encounters
        encounter_base = max(0, rng.randint(0, 12) + len(chronic) * 2 + (3 if age >= 65 else 0))
        encounters = _encounters_for(rng, encounter_base)

        pcp = rng.choice(providers)

        # Charges
        total_charges = 0
        encounter_rows = []
        for j, (etype, date, complaint) in enumerate(encounters):
            lo, hi = CHARGE_RANGES[etype]
            ch = rng.randint(lo, hi)
            total_charges += ch
            dept_name, dept_code = rng.choice(DEPARTMENTS)
            encounter_rows.append({
                "pat_enc_csn_id": f"{i:07d}-{j:03d}",
                "contact_date": date,
                "encounter_type": etype,
                "department_name": dept_name,
                "provider_name": pcp if rng.random() < 0.55 else rng.choice(providers),
                "chief_complaint": complaint,
                "diagnosis_count": min(len(chronic) + (1 if complaint else 0), 6),
                "total_charges": ch,
            })

        # Acute diagnoses sprinkled into a couple of encounters
        diagnoses_rows: list[dict[str, Any]] = []
        for j, (icd, name, first_recorded) in enumerate(chronic):
            diagnoses_rows.append({
                "dx_id": f"{i:07d}-dx-{j:03d}",
                "pat_enc_csn_id": encounter_rows[0]["pat_enc_csn_id"] if encounter_rows else f"{i:07d}-000",
                "icd10_code": icd,
                "diagnosis_name": name,
                "chronic": True,
                "first_recorded": first_recorded,
            })
        for k, e in enumerate(encounter_rows[:3]):
            if e["chief_complaint"]:
                acute = next((a for a in ACUTE_DX if a[1] == e["chief_complaint"]), None)
                if acute:
                    diagnoses_rows.append({
                        "dx_id": f"{i:07d}-acu-{k:03d}",
                        "pat_enc_csn_id": e["pat_enc_csn_id"],
                        "icd10_code": acute[0],
                        "diagnosis_name": acute[1],
                        "chronic": False,
                        "first_recorded": e["contact_date"],
                    })

        # Accounts
        n_accounts = 1 if total_charges < 10000 else rng.randint(1, 3)
        accounts_rows: list[dict[str, Any]] = []
        remaining = total_charges
        for k in range(n_accounts):
            this_charges = remaining if k == n_accounts - 1 else rng.randint(0, max(1, remaining))
            remaining -= this_charges
            payer = _weighted_choice(rng, PAYERS)
            payment_pct = {
                "Self-pay": rng.uniform(0.25, 0.85),
                "Medicaid": rng.uniform(0.85, 0.97),
                "Medicare": rng.uniform(0.78, 0.92),
            }.get(payer, rng.uniform(0.60, 0.92))
            payments = int(this_charges * payment_pct)
            opened = (today - dt.timedelta(days=rng.randint(30, 900))).isoformat()
            closed = None if rng.random() < 0.35 else (today - dt.timedelta(days=rng.randint(1, 200))).isoformat()
            accounts_rows.append({
                "hsp_account_id": f"HSP{i:07d}{k:02d}",
                "account_type": rng.choice(["Hospital", "Professional", "Imaging", "Rx"]),
                "status": "Open" if closed is None else "Closed",
                "total_charges": this_charges,
                "total_payments": payments,
                "current_balance": max(0, this_charges - payments),
                "primary_payer": payer,
                "opened_date": opened,
                "closed_date": closed,
            })

        patient_summary = {
            "pat_id":   f"PAT{100000 + i:07d}",
            "med_rec_num": f"MRN{200000 + i:07d}",
            "full_name": full_name,
            "birth_date": birth.isoformat(),
            "age": age,
            "sex": sex,
            "city": city,
            "zip_code": zip_code,
            "primary_care_provider": pcp,
            "active_chronic_count": len(chronic),
            "encounter_count": len(encounter_rows),
            "total_charges": total_charges,
            "latitude": round(lat, 5),
            "longitude": round(lng, 5),
            "last_encounter_date": encounter_rows[0]["contact_date"] if encounter_rows else None,
        }
        patients_list.append(patient_summary)

        # Detail bundle for the first 1000 — others get synthesized in-browser.
        if i < 1500:
            pid = patient_summary["pat_id"]
            detail_bundles[pid] = {
                "patient": {
                    **patient_summary,
                    "race": rng.choice(["White", "Black or African American", "Asian",
                                        "Hispanic/Latino", "Other"]),
                    "ethnicity": rng.choice(["Not Hispanic or Latino", "Hispanic or Latino"]),
                    "mailing_address": f"{rng.randint(10, 9999)} {rng.choice(['Forbes', 'Murray', 'Penn', 'Liberty', 'Highland', 'Beacon', 'Centre', 'Walnut'])} {rng.choice(['Ave', 'St', 'Blvd', 'Rd'])}",
                    "state": "PA",
                    "phone": f"(412) {rng.randint(200, 999)}-{rng.randint(1000, 9999)}",
                    "primary_care_department": rng.choice(DEPARTMENTS)[0],
                },
                "encounters": {"pat_id": pid, "encounters": encounter_rows[:20]},
                "diagnoses": {"pat_id": pid, "diagnoses": diagnoses_rows},
                "accounts": {
                    "pat_id": pid,
                    "summary": {
                        "total_charges": sum(a["total_charges"] for a in accounts_rows),
                        "total_payments": sum(a["total_payments"] for a in accounts_rows),
                        "outstanding_balance": sum(a["current_balance"] for a in accounts_rows),
                        "account_count": len(accounts_rows),
                    },
                    "accounts": accounts_rows,
                },
                "comparables": {"pat_id": pid, "comparables": []},
            }

    # Comparables: same chronic count ± 1 + similar age — only need a few per detail bundle
    # Pre-bucket by (age decile, chronic count) for cheap lookup
    bucket: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for p in patients_list:
        key = (p["age"] // 10, p["active_chronic_count"])
        bucket.setdefault(key, []).append(p)
    for pid, b in detail_bundles.items():
        target = b["patient"]
        sibs = []
        for dx in (-1, 0, 1):
            key = (target["age"] // 10, target["active_chronic_count"] + dx)
            for c in bucket.get(key, []):
                if c["pat_id"] != pid and c["pat_id"] not in {s["pat_id"] for s in sibs}:
                    sibs.append(c)
                if len(sibs) >= 6:
                    break
            if len(sibs) >= 6:
                break
        b["comparables"] = {
            "pat_id": pid,
            "comparables": [
                {
                    "pat_id": s["pat_id"],
                    "full_name": s["full_name"],
                    "age": s["age"],
                    "sex": s["sex"],
                    "chronic_overlap_count": min(target["active_chronic_count"], s["active_chronic_count"]),
                    "encounter_count": s["encounter_count"],
                    "total_charges": s["total_charges"],
                }
                for s in sibs[:6]
            ],
        }

    total_encounters = sum(p["encounter_count"] for p in patients_list)
    total_diagnoses = sum(p["active_chronic_count"] for p in patients_list)
    total_chronic_active = total_diagnoses
    avg_encounter_cost = (
        sum(p["total_charges"] for p in patients_list) / max(1, total_encounters)
    )

    return {
        "summary": {
            "total_patients":        n_patients,
            "total_encounters":      total_encounters,
            "total_diagnoses":       total_diagnoses,
            "avg_encounter_cost":    round(avg_encounter_cost, 2),
            "active_chronic_count":  total_chronic_active,
            "current_year":          today.year,
        },
        "patients": patients_list,
        "details": detail_bundles,
    }
