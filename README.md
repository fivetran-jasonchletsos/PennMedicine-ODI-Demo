# Penn Medicine ODI Demo

End-to-end Epic Clarity → Fivetran → Databricks (Unity Catalog + Delta Lake) → dbt Labs
→ React demo showcasing Fivetran + dbt Labs + Databricks on a healthcare data model.

```
   ┌─────────────────────────────────────────────────────────┐
   │  Epic Clarity (Clarity reporting DB on AWS EC2)         │
   │  patient, pat_enc, pat_enc_dx, hsp_account, …           │
   └──────────────────────────┬──────────────────────────────┘
                              │  Fivetran Epic Clarity connector (log-based CDC)
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Databricks Unity Catalog — Delta Lake                  │
   │  governed lakehouse · ACID · time travel                │
   │  catalog: jason_chletsos_pennmed                         │
   │  schema:  jason_chletsos_pennmed_ehr_demo                │
   └──────────────────────────┬──────────────────────────────┘
                              │  Databricks SQL warehouses
                              │  (elastic compute over the same Delta tables)
                              ▼
   ┌─────────────────────────────────────────────────────────┐
   │  Fivetran Transformations triggers dbt Labs             │
   │  (fires when Epic Clarity sync finishes)                │
   │  bronze → silver → gold · 21 tested models              │
   │  schemas: staging / intermediate / clinical / financial │
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
| `transform/` | dbt project — Databricks adapter |
| `healthcare-app/frontend/` | React SPA (mirrors fivetran-sheetz-demo) |
| `healthcare-app/backend/` | Not implemented — the frontend reads static JSON snapshots built by `healthcare-app/scripts/build_snapshot.py`, there is no live query-serving backend |
| `.github/workflows/` | Pages deploy + scheduled Databricks-driven snapshot refresh |

## Pipeline

1. Source: Epic Clarity reporting database on EC2 holds the EHR schema
   (`patient`, `pat_enc`, `pat_enc_dx`, `hsp_account`, …).
2. Fivetran's Epic Clarity connector lands every change into Databricks
   Unity Catalog via log-based CDC. Catalog: `jason_chletsos_pennmed`,
   schema: `jason_chletsos_pennmed_ehr_demo`.
3. Databricks SQL warehouses provide elastic compute directly over the same
   governed Delta tables — no duplication, no extracts.
4. Fivetran Transformations triggers the dbt job the moment the Epic Clarity
   sync finishes. dbt builds staging → intermediate → marts under
   `jason_chletsos_pennmed.{staging, intermediate, clinical, financial}`.
5. `scripts/build_snapshot.py` queries the marts and writes the JSON the
   React frontend serves at runtime.

## Local development

```bash
# Provision Epic Clarity reporting DB + load demo data
cd infra && terraform apply
cd ../scripts && python load_to_sqlserver.py

# Trigger Fivetran sync
python trigger_fivetran_sync.py

# Build dbt models on Databricks
cd ../transform
export $(cat ../.env | xargs)
dbt deps && dbt run && dbt test

# Build the JSON snapshot from Databricks marts
cd ../scripts
python build_snapshot.py

# Run the frontend
cd ../healthcare-app/frontend
npm install && npm run dev
```
