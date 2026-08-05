# Healthcare EPIC Snowflake Demo

End-to-end Epic Clarity → Fivetran → Iceberg (MDLS) → Snowflake / Athena / Trino → dbt
→ React demo showcasing the modern open-lake data stack on a healthcare data model.

```
   ┌─────────────────────────────────────────────────────────┐
   │  Epic Clarity (Clarity reporting DB on AWS EC2)         │
   │  patient, pat_enc, pat_enc_dx, hsp_account, …           │
   └──────────────────────────┬──────────────────────────────┘
                              │  Fivetran Epic Clarity connector (CDC)
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Iceberg (MDLS) — Managed Data Lake on S3               │
   │  open Apache Iceberg · ACID · one copy of the bytes     │
   │  schema: JASON_CHLETSOS_EHR_DEMO                        │
   └──────────────────────────┬──────────────────────────────┘
                              │  Snowflake · Athena · Trino
                              │  (external Iceberg reads — no copies)
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Fivetran Transformations triggers dbt Labs             │
   │  (fires when Epic Clarity sync finishes)                │
   │  bronze → silver → gold · 21 tested models              │
   │  schemas: STAGING / INTERMEDIATE / CLINICAL / FINANCIAL │
   │  marts:   dim_patients, dim_providers, fct_encounters,  │
   │           fct_diagnoses, fct_account_summary, …         │
   └──────────────────────────┬──────────────────────────────┘
                              │  build_snapshot.py → JSON
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  React + Vite SPA (GitHub Pages)                        │
   │  Home · Patients · Patient detail · Dashboard · Map ·   │
   │  Ask AI agent · Pipeline health · About                 │
   └─────────────────────────────────────────────────────────┘
```

## Layout

| Path | Purpose |
| --- | --- |
| `infra/` | Terraform for the Clarity reporting DB EC2 + Fivetran Epic Clarity connector |
| `scripts/` | Source data generators + sync triggers + snapshot builder |
| `transform/` | dbt project — Snowflake adapter |
| `healthcare-app/frontend/` | React SPA (mirrors fivetran-sheetz-demo) |
| `healthcare-app/backend/` | FastAPI service for local dev (queries Snowflake) |
| `.github/workflows/` | Pages deploy + scheduled Snowflake-driven snapshot refresh |

## Pipeline

1. Source: Epic Clarity reporting database on EC2 holds the EHR schema
   (`patient`, `pat_enc`, `pat_enc_dx`, `hsp_account`, …).
2. Fivetran's Epic Clarity connector lands every change into Iceberg (MDLS)
   on S3 in open Apache Iceberg format. Schema: `JASON_CHLETSOS_EHR_DEMO`.
3. Snowflake, Athena, and Trino all read the same Iceberg bytes through
   external table catalogs — no duplication, no extracts. Snowflake is the
   primary engine in this demo (`JASON_CHLETSOS_EPIC`).
4. Fivetran Transformations triggers the dbt job the moment the Epic Clarity
   sync finishes. dbt builds staging → intermediate → marts under
   `JASON_CHLETSOS_EPIC.{STAGING, INTERMEDIATE, CLINICAL, FINANCIAL}`.
5. `scripts/build_snapshot.py` queries the marts and writes the JSON the
   React frontend serves at runtime.

## Local development

```bash
# Provision Epic Clarity reporting DB + load demo data
cd infra && terraform apply
cd ../scripts && python load_to_sqlserver.py

# Trigger Fivetran sync
python trigger_fivetran_sync.py

# Build dbt models in Snowflake
cd ../transform
export $(cat ../.env | xargs)
dbt deps && dbt run && dbt test

# Build the JSON snapshot from Snowflake marts
cd ../scripts
python build_snapshot.py

# Run the frontend
cd ../healthcare-app/frontend
npm install && npm run dev
```
