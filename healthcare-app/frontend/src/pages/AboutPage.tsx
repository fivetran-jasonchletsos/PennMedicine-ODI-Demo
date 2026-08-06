import { ProvenanceStrip } from '../components/Executive';

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="eyebrow mb-1">Reference Architecture</div>
        <h1 className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">About this demo</h1>
        <p className="mt-3 text-[var(--ink-muted)] leading-relaxed">
          A reference build that demonstrates an end-to-end EHR → Fivetran → Databricks (Unity
          Catalog) → dbt Labs → React data pipeline. The source is an Epic Clarity reporting
          database hosted on AWS EC2; Fivetran's Epic Clarity connector captures change data via
          log-based CDC and lands it directly into Databricks Unity Catalog as Delta Lake tables —
          no intermediary lake, no hand-built ingestion pipeline to maintain against Epic's schema
          changes; Databricks is the primary read/write engine; Fivetran Transformations triggers
          dbt Labs the moment the Epic Clarity sync finishes, which builds the bronze (staging),
          silver (intermediate), and gold (mart) layers on Databricks compute; a Python script
          exports the marts to JSON and a static React SPA serves the user-facing experience.
        </p>
      </header>

      <div className="mb-8 clinical-card px-5 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div className="eyebrow shrink-0">Live Stack</div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-lg font-semibold text-[var(--ink-strong)] tabular leading-none">4.2 min</span>
          <span className="text-xs text-[var(--ink-soft)]">last Fivetran sync</span>
        </div>
        <span className="text-[var(--hairline)]">│</span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-lg font-semibold text-[var(--clinical-teal)] tabular leading-none">99.7%</span>
          <span className="text-[var(--ink-soft)] text-xs">SLA</span>
        </div>
        <span className="text-[var(--hairline)]">│</span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-lg font-semibold text-[var(--ink-strong)] tabular leading-none">$0.84</span>
          <span className="text-xs text-[var(--ink-soft)]">Databricks compute / patient / month</span>
        </div>
      </div>

      <div className="mb-4">
        <ProvenanceStrip
          freshness="4.2 min ago"
          source="Penn Medicine · Epic Clarity CDC"
          rows="2.4M rows · 8 tables"
          fivetranUrl="https://fivetran.com/dashboard/connections/courteously_ivy/status"
        />
      </div>

      <div className="mb-4">
        <ProvenanceStrip
          freshness="Historical sync complete"
          source="Penn Medicine · Workday HCM"
          rows="73 tables · workforce & HR"
          fivetranUrl="https://fivetran.com/dashboard/connections/passivity_threshing/status"
        />
      </div>

      <div className="mb-10">
        <ProvenanceStrip
          freshness="Initial sync in progress"
          source="Penn Medicine · Qualtrics"
          rows="35 tables · survey & experience"
          fivetranUrl="https://fivetran.com/dashboard/connections/conversing_format/status"
        />
      </div>


      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] border-b border-[var(--hairline)] pb-2 mb-3">Data sources</h2>
        <div className="space-y-3">
          {DATA_SOURCES.map((s) => (
            <article key={s.title} className="clinical-card p-5">
              <h3 className="font-serif text-lg font-semibold text-[var(--ink-strong)]">{s.title}</h3>
              <p className="mt-1 text-sm text-[var(--ink-muted)] leading-relaxed">{s.description}</p>
              {s.note && <p className="mt-2 text-xs text-[var(--ink-soft)]">{s.note}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] border-b border-[var(--hairline)] pb-2 mb-3">Architecture</h2>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <div key={s.name} className="clinical-card p-5">
              <div className="flex items-start gap-4">
                <div
                  className="h-10 w-10 rounded-md flex items-center justify-center font-serif font-semibold shrink-0"
                  style={{ background: 'var(--clinical-teal-bg)', color: 'var(--clinical-teal)' }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="font-serif text-lg font-semibold text-[var(--ink-strong)]">{s.name}</div>
                  <p className="mt-1 text-sm text-[var(--ink-muted)] leading-relaxed">{s.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)] bg-[var(--paper-deep)] border border-[var(--hairline)] px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-lg bg-[var(--paper-deep)] border border-[var(--hairline)] p-5 text-sm text-[var(--ink)]">
        <div className="eyebrow mb-2" style={{ color: 'var(--clinical-amber)' }}>Disclaimer</div>
        <p className="text-[var(--ink-muted)] leading-relaxed">
          <strong className="text-[var(--ink-strong)]">All patient data shown is synthetic</strong>, generated for demonstration
          purposes. The schema is modeled after Epic's Clarity reporting database but contains no
          real Protected Health Information (PHI).
        </p>
      </section>
    </div>
  );
}

const DATA_SOURCES = [
  {
    title: 'EHR Source (Epic Clarity on EC2)',
    description:
      "An EC2-hosted Epic Clarity reporting database with a synthetic EHR schema: patient, pat_enc, pat_enc_dx, hsp_account, hsp_transaction, providers, departments, and more.",
    note: 'Provisioned via Terraform in infra/. Synthetic data generated by scripts/generate_data.py.',
  },
  {
    title: 'Fivetran Epic Clarity connector',
    description:
      'Mirrors every change in the Epic Clarity source (inserts, updates, deletes) directly into Databricks Unity Catalog as Delta Lake tables via log-based CDC, on a configurable schedule — schema drift from an Epic upgrade lands automatically instead of breaking a hand-built pipeline. Schema name lands as jason_chletsos_pennmed_ehr_demo.',
  },
  {
    title: 'Fivetran Workday HCM connector',
    description:
      'Replicates workforce, organization, and HR data from Workday HCM into the same Databricks Unity Catalog destination — 73 tables landing as jason_chletsos_pennmed_workday, joinable against the Epic Clarity marts on the same lakehouse with no separate integration.',
  },
  {
    title: 'Fivetran Qualtrics connector',
    description:
      'Replicates survey and patient-experience data from Qualtrics into the same Databricks Unity Catalog destination — 35 tables landing as jason_chletsos_qualtrics. Initial sync is still in progress.',
  },
  {
    title: 'Databricks — Unity Catalog (Delta Lake)',
    description:
      'Unity Catalog governs the bronze/silver/gold Delta tables as one namespace with row filters and column masks on PHI, and is the single source of truth — no separate lake, no duplication, no extracts. A serverless SQL warehouse runs dbt Labs (Fivetran-triggered) and serves the API layer, auto-stopping between queries.',
  },
];

const STEPS = [
  {
    icon: '1',
    name: 'Fivetran — Ingestion',
    desc: 'Epic Clarity connector replicates Clarity reporting tables directly into Databricks Unity Catalog as Delta Lake tables — no intermediary lake, no custom ETL.',
    tags: ['Epic Clarity CDC', 'Incremental sync', 'Schema discovery'],
  },
  {
    icon: '2',
    name: 'Databricks (Unity Catalog) — Storage + query engine',
    desc: 'Fivetran writes every CDC row directly into Unity Catalog as Delta Lake tables. One copy of the data, one source of truth, ACID transactions + time travel. A serverless Databricks SQL warehouse is the primary engine for this demo; Trino and other engines can reach the same tables through Unity Catalog\'s UniForm (Iceberg-compatible) metadata at zero extra storage cost.',
    tags: ['Delta Lake', 'Unity Catalog', 'ACID + time travel', 'Zero copy'],
  },
  {
    icon: '3',
    name: 'dbt Labs — Transformation (Fivetran-triggered)',
    desc: 'Fivetran Transformations kicks off the dbt job the moment the Epic Clarity sync finishes. Tested SQL builds dim_patients, dim_providers, dim_departments, fct_encounters, fct_diagnoses, fct_account_summary across the bronze → silver → gold layers.',
    tags: ['Fivetran-triggered', 'dbt Labs', 'Dimensional model', 'Tests'],
  },
  {
    icon: '4',
    name: 'React + Recharts — Public portal',
    desc: 'Static SPA reads daily JSON exports of the marts. No backend required at request time.',
    tags: ['React 19', 'Recharts', 'GitHub Pages'],
  },
];
