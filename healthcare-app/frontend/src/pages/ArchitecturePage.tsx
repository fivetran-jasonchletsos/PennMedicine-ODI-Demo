// Clarity Health — Open Data Infrastructure architecture page.
//
// Ported from Verity Insurance's ArchitecturePage to give Clarity the
// same medallion / multi-engine surface (Snowflake Summit 2026 recording
// set, 9am). Healthcare-flavoured: Clarity EHR (Epic Clarity) + payor
// claims (Oracle) + HL7 v2 feed + CMS public datasets. Snowflake is
// the primary engine; Athena/DuckDB/Trino/Spark stay listed as the
// same open-lake reads.
//
// Iceberg table list is inlined (no extra API endpoint) so the page
// can render in the recording even if connectors are paused.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AliveMedallion, type SourceNode, type EngineNode } from '../components/AliveMedallion';
import ProductStageRail from '../components/ProductStageRail';

const CLARITY_SOURCES: SourceNode[] = [
  { id: 'sql',    label: 'Epic Clarity EHR',  sub: 'Epic Clarity CDC source',   logo: 'epic_clarity', freshness: '47s lag',  status: 'healthy' },
  { id: 'oracle', label: 'Payor Claims Mart', sub: 'Oracle Binary Log Reader', logo: 'oracle',  freshness: '2 min lag', status: 'healthy' },
  { id: 'hl7',    label: 'HL7 ADT Feed',      sub: 'MLLP event stream',     logo: 'hl7',       freshness: 'live',      status: 'healthy', streaming: true },
  { id: 'cms',    label: 'CMS NPPES',         sub: 'Weekly NPI registry',   logo: 'cms',       freshness: '3d lag',   status: 'healthy' },
];

const CLARITY_ENGINES: EngineNode[] = [
  { name: 'Snowflake', active: true,  logo: 'snowflake' },
  { name: 'Athena',                   logo: 'athena' },
  { name: 'DuckDB',                   logo: 'duckdb' },
  { name: 'Trino',                    logo: 'trino' },
  { name: 'Spark',                    logo: 'spark' },
];

// ─── Types (local) ──────────────────────────────────────────────────────────

interface IcebergTable {
  database: 'bronze' | 'silver' | 'gold';
  table: string;
  source_system: string;
  rows: number;
  bytes: number;
  schema_columns: number;
  partitions: string[];
  last_updated_at: string;
}

interface QueryEngine {
  name: 'Snowflake' | 'Athena' | 'DuckDB' | 'Trino' | 'Spark';
  status: 'active' | 'available' | 'demo';
  description: string;
  sample_query: string;
}

const TABLES: IcebergTable[] = [
  { database: 'bronze', table: 'bronze.clarity__patient',          source_system: 'epic_clarity · Clarity EHR', rows: 412_820,   bytes: 318_440_000,   schema_columns: 142, partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.clarity__pat_enc',          source_system: 'epic_clarity · Clarity EHR', rows: 4_182_220, bytes: 2_140_000_000, schema_columns: 187, partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.clarity__pat_enc_dx',       source_system: 'epic_clarity · Clarity EHR', rows: 12_414_380,bytes: 4_820_000_000, schema_columns: 24,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.clarity__hsp_account',      source_system: 'epic_clarity · Clarity EHR', rows: 1_842_200, bytes: 1_120_000_000, schema_columns: 92,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.clarity__hsp_transaction',  source_system: 'epic_clarity · Clarity EHR', rows: 18_142_200,bytes: 5_410_000_000, schema_columns: 71,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.clarity__medications',      source_system: 'epic_clarity · Clarity EHR', rows: 864_200,   bytes: 462_000_000,   schema_columns: 38,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:14:00Z' },
  { database: 'bronze', table: 'bronze.payor__claims',             source_system: 'oracle · Payor Mart',      rows: 2_864_000, bytes: 1_810_000_000, schema_columns: 64,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:11:00Z' },
  { database: 'bronze', table: 'bronze.hl7__adt_events',           source_system: 'http · HL7 v2 feed',       rows: 384_000,   bytes: 142_000_000,   schema_columns: 28,  partitions: ['ingest_date'],            last_updated_at: '2026-05-24T07:12:00Z' },
  { database: 'bronze', table: 'bronze.cms__npi_registry',         source_system: 'http · CMS NPPES',         rows: 12_460,    bytes: 18_400_000,    schema_columns: 32,  partitions: [],                          last_updated_at: '2026-05-23T03:00:00Z' },

  { database: 'silver', table: 'silver.int_patient_encounter_spine',source_system: 'dbt · merged',            rows: 1_842_200, bytes: 980_000_000,   schema_columns: 62,  partitions: ['encounter_date'],         last_updated_at: '2026-05-24T07:18:00Z' },
  { database: 'silver', table: 'silver.int_chronic_conditions',    source_system: 'dbt · merged',             rows: 412_820,   bytes: 224_000_000,   schema_columns: 24,  partitions: [],                          last_updated_at: '2026-05-24T07:18:00Z' },
  { database: 'silver', table: 'silver.int_encounter_diagnoses',   source_system: 'dbt · merged',             rows: 12_414_380,bytes: 3_120_000_000, schema_columns: 18,  partitions: ['encounter_date'],         last_updated_at: '2026-05-24T07:18:00Z' },
  { database: 'silver', table: 'silver.int_financials',            source_system: 'dbt · merged',             rows: 18_142_200,bytes: 4_410_000_000, schema_columns: 31,  partitions: ['transaction_date'],       last_updated_at: '2026-05-24T07:18:00Z' },
  { database: 'silver', table: 'silver.int_claims_reconciled',     source_system: 'dbt · merged',             rows: 2_864_000, bytes: 1_640_000_000, schema_columns: 42,  partitions: ['claim_period'],           last_updated_at: '2026-05-24T07:18:00Z' },

  { database: 'gold',   table: 'gold.dim_patients',                source_system: 'dbt mart',                 rows: 412_820,   bytes: 184_000_000,   schema_columns: 38,  partitions: [],                          last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.dim_providers',               source_system: 'dbt mart',                 rows: 18_240,    bytes: 12_400_000,    schema_columns: 28,  partitions: [],                          last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.dim_departments',             source_system: 'dbt mart',                 rows: 860,       bytes: 480_000,       schema_columns: 14,  partitions: [],                          last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.fct_encounters',              source_system: 'dbt mart',                 rows: 1_842_200, bytes: 720_000_000,   schema_columns: 44,  partitions: ['encounter_month'],        last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.fct_diagnoses',               source_system: 'dbt mart',                 rows: 12_414_380,bytes: 2_410_000_000, schema_columns: 22,  partitions: ['encounter_month'],        last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.fct_account_summary',         source_system: 'dbt mart',                 rows: 1_842_200, bytes: 612_000_000,   schema_columns: 26,  partitions: ['statement_period'],       last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.fct_chronic_cohorts',         source_system: 'dbt mart',                 rows: 412_820,   bytes: 184_000_000,   schema_columns: 18,  partitions: [],                          last_updated_at: '2026-05-24T07:22:00Z' },
  { database: 'gold',   table: 'gold.fct_payor_denied_claims',     source_system: 'dbt mart',                 rows: 184_220,   bytes: 96_000_000,    schema_columns: 31,  partitions: ['denial_month'],           last_updated_at: '2026-05-24T07:22:00Z' },
];

const ENGINES: QueryEngine[] = [
  {
    name: 'Snowflake',
    status: 'active',
    description: 'Primary engine for the Clarity gold layer. Reads Iceberg externals through Polaris catalog; auto-suspends between queries. Where the front end, the cost-estimator, and the dbt-wizard run-time agents all land. Humans and agents read the same gold layer.',
    sample_query: `SELECT
  p.patient_id, p.age_band, p.payor_class,
  c.condition_label, c.last_seen_at,
  e.encounter_count_12m, e.ed_visit_count_12m
FROM gold.dim_patients         p
JOIN gold.fct_chronic_cohorts  c USING (patient_id)
JOIN gold.fct_encounters       e USING (patient_id)
WHERE c.condition_label = 'CHF'
  AND e.ed_visit_count_12m >= 2
ORDER BY e.ed_visit_count_12m DESC
LIMIT 50;`,
  },
  {
    name: 'Athena',
    status: 'available',
    description: 'Serverless reads against the same Iceberg gold tables via Glue. Useful for compliance/regulatory ad-hoc that doesn\'t need to pay for warehouse time.',
    sample_query: `SELECT department, COUNT(*) AS encounters_30d
FROM gold.fct_encounters
WHERE encounter_date >= current_date - interval '30' day
GROUP BY department
ORDER BY encounters_30d DESC;`,
  },
  {
    name: 'DuckDB',
    status: 'available',
    description: 'Engineer\'s laptop. Same Iceberg tables, queried directly from S3 with the iceberg extension. Tiny ad-hoc joins without spinning up anything.',
    sample_query: `INSTALL iceberg;
LOAD iceberg;

SELECT *
FROM iceberg_scan('s3://clarity-odi-lake/gold/fct_payor_denied_claims/')
WHERE denial_reason_code IN ('CO-50','CO-97')
LIMIT 100;`,
  },
  {
    name: 'Trino',
    status: 'available',
    description: 'Federated engine that joins the lake to other relational sources (state Medicaid systems, hospital EHR replicas) without copying data first.',
    sample_query: `SELECT e.department, AVG(e.length_of_stay_days) AS avg_los
FROM iceberg.gold.fct_encounters e
JOIN postgres.medicaid.member_eligibility m
  ON m.member_id = e.patient_id
WHERE e.payor_class = 'Medicaid'
GROUP BY e.department;`,
  },
  {
    name: 'Spark',
    status: 'available',
    description: 'Distributed compute for ML training and large cohort joins. Reads the same Iceberg tables via the spark-iceberg runtime.',
    sample_query: `df = spark.read.format("iceberg")\\
  .load("gold.fct_encounters")
df.groupBy("payor_class", "department")\\
  .agg({"length_of_stay_days": "avg"})\\
  .show()`,
  },
];

const ENGINE_COLORS: Record<QueryEngine['name'], string> = {
  Snowflake: '#29b5e8',
  Athena:    '#b8975c',
  DuckDB:    '#0b2545',
  Trino:     '#1d4e89',
  Spark:     '#b45309',
};

// ─── Number formatters (local — Clarity's api/queries doesn't export these) ─

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatBytes(b: number): string {
  if (b >= 1_000_000_000) return `${(b / 1_000_000_000).toFixed(2)} GB`;
  if (b >= 1_000_000)     return `${(b / 1_000_000).toFixed(1)} MB`;
  if (b >= 1_000)         return `${(b / 1_000).toFixed(1)} KB`;
  return `${b} B`;
}

// =============================================================================
// Page
// =============================================================================

export default function ArchitecturePage() {
  const [activeEngine, setActiveEngine] = useState<QueryEngine>(ENGINES[0]);

  const byLayer = (l: 'bronze' | 'silver' | 'gold') => TABLES.filter((t) => t.database === l);
  const layerStats = (l: 'bronze' | 'silver' | 'gold') => {
    const t = byLayer(l);
    return { tables: t.length, rows: t.reduce((s, r) => s + r.rows, 0), bytes: t.reduce((s, r) => s + r.bytes, 0) };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-[var(--hairline)] pb-6">
        <div className="eyebrow mb-1">Open Data Infrastructure</div>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--ink-strong)]">
          One lake. Every engine. The whole patient story.
        </h1>
        <p className="mt-3 text-[var(--ink-muted)] max-w-3xl leading-relaxed">
          Clarity Health treats <em>storage</em>, <em>catalog</em>, and <em>compute</em> as three
          independently swappable layers. Iceberg is the storage spec. Glue is the catalog.
          Snowflake, Athena, DuckDB, Trino, and Spark can all read the same tables &mdash; no copy,
          no extract, no proprietary format between the EHR and the analyst.
        </p>
        <p className="mt-3 font-serif italic text-[15px] text-[var(--ink-strong)] max-w-3xl leading-relaxed">
          Fivetran moves what's new. Great Expectations decides what passes. dbt decides what
          becomes business-ready.
        </p>
      </header>

      {/* ── Live throughput hero (DE: rows in motion, ticking up) ─────────── */}
      <ThroughputHero />

      {/* ── Sync-aware dbt savings teaser — actuals only; full forecast below ── */}
      <DbtStateSavingsTeaser hitPercent={78} hoursSaved={2.38} dollarsSaved={4.76} />

      {/* ── Data Flow diagram ─────────────────────────────────────────────── */}
      <section className="clinical-card p-6 sm:p-8 mb-8" style={cardStyle}>
        <div className="eyebrow mb-1">Data Flow</div>
        <h2 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] mb-2">
          Fivetran → Iceberg (MDLS) → Snowflake · Athena · Trino → dbt
        </h2>
        <p className="text-sm text-[var(--ink-muted)] mb-6 leading-relaxed max-w-3xl">
          Every source lands in open Apache Iceberg format on S3 — the Managed Data Lake. All query
          engines read the same bytes, no copies. Fivetran Transformations triggers the dbt job the
          moment the Epic Clarity sync finishes.
        </p>

        <ProductStageRail accent="#0e7490" />

        <AliveMedallion
          sources={CLARITY_SOURCES}
          bronze={{ ...layerStats('bronze'), trend: [180, 195, 210, 222, 240, 255, 270] }}
          silver={{ ...layerStats('silver'), trend: [120, 130, 142, 155, 168, 180, 192] }}
          gold={{   ...layerStats('gold'),   trend: [80, 88, 95, 104, 112, 124, 138] }}
          engines={CLARITY_ENGINES}
          accent="#0d9488"
        />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--ink-muted)]">
          <LayerDetail layer="bronze" stats={layerStats('bronze')} desc="Raw rows landed by Fivetran. 1:1 with source. CDC kept current within five minutes." />
          <LayerDetail layer="silver" stats={layerStats('silver')} desc="Conformed dims and facts. Cleaned, deduped, joined to a patient + encounter spine." />
          <LayerDetail layer="gold"   stats={layerStats('gold')}   desc="Business-ready marts + the dbt semantic layer. What every clinician-facing surface reads." />
        </div>
      </section>

      {/* ── Schema-evolution ticker (Iceberg's killer feature, surfaced) ──── */}
      <SchemaEvolutionTicker />

      {/* ── Sync-aware dbt incrementals — zero-row builds when Fivetran no-ops ─ */}
      <DbtStatePanel />

      {/* ── Cost panel (the CFO line, surfaced) ──────────────────────────── */}
      <CostPanel />

      {/* ── Failure & recovery (every DE's "what if it breaks?" answered) ── */}
      <FailureRecoveryPanel />

      {/* ── HIPAA data contracts / governance ────────────────────────────── */}
      <DataContractsPanel />

      {/* ── Interactive lineage — click any gold model, see its upstreams ── */}
      <LineagePanel />

      {/* ── Multi-engine showcase ────────────────────────────────────────── */}
      <section className="clinical-card overflow-hidden mb-8" style={cardStyle}>
        <header className="clinical-card-header" style={cardHeaderStyle}>
          <div className="eyebrow">Compute is a choice</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            Same Iceberg tables. Five engines. One query at a time.
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Pick a query engine &mdash; the SQL barely changes, but the operational, cost, and
            governance profile shifts dramatically. That choice belongs to the hospital, not the vendor.
          </p>
        </header>

        <div className="px-5 pt-4 flex flex-wrap gap-2">
          {ENGINES.map((e) => (
            <button
              key={e.name}
              onClick={() => setActiveEngine(e)}
              className="px-3 py-2 rounded-sm text-xs font-semibold uppercase tracking-wider border transition-all"
              style={
                activeEngine.name === e.name
                  ? { background: ENGINE_COLORS[e.name], borderColor: ENGINE_COLORS[e.name], color: '#ffffff' }
                  : { background: '#ffffff', color: 'var(--ink-muted)', borderColor: 'var(--hairline)' }
              }
            >
              {e.name}
              {e.status === 'active' && <span className="ml-1.5 text-[9px] opacity-80">● ACTIVE</span>}
              {e.status === 'demo'   && <span className="ml-1.5 text-[9px] opacity-60">DEMO</span>}
            </button>
          ))}
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold mb-2">Query</div>
            <pre className="rounded-sm p-4 text-[11.5px] leading-relaxed overflow-x-auto font-mono" style={{ background: '#0b2545', color: 'var(--paper,#fefaf3)' }}>
              <code>{activeEngine.sample_query}</code>
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold mb-2">Why this engine</div>
            <p className="text-sm text-[var(--ink)] leading-relaxed">{activeEngine.description}</p>
            <div className="mt-4 pt-4 border-t border-[var(--hairline-soft,#e8e4d8)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold mb-1">Status</div>
              <div className="text-sm font-semibold" style={{ color: activeEngine.status === 'active' ? '#16a34a' : '#6b7280' }}>
                {activeEngine.status === 'active' ? '● Primary engine — powers this site' : 'Compatible and ready to wire in'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Iceberg catalog ──────────────────────────────────────────────── */}
      <section className="clinical-card overflow-hidden mb-8" style={cardStyle}>
        <header className="clinical-card-header" style={cardHeaderStyle}>
          <div className="eyebrow">Iceberg Catalog</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            Every table on the lake, registered in AWS Glue
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1">
            Open metadata. Every engine reads the same schema, the same partition layout, the same
            row counts &mdash; without anyone owning the "source of truth" exclusively.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead className="border-b border-[var(--hairline)]" style={{ background: 'var(--paper-deep,#f4efe2)' }}>
              <tr>
                <Th>Layer</Th>
                <Th>Table</Th>
                <Th>Source</Th>
                <Th align="right">Rows</Th>
                <Th align="right">Size</Th>
                <Th align="right">Columns</Th>
                <Th>Partitions</Th>
                <Th align="right">Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline-soft,#e8e4d8)]">
              {TABLES.map((t) => (
                <tr key={`${t.database}.${t.table}`} className="hover:bg-[var(--paper-deep,#f4efe2)] cursor-default">
                  <td className="px-4 py-2.5"><LayerChip layer={t.database} /></td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--ink-strong)]">{t.table}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)] font-mono">{t.source_system}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[var(--ink-strong)]">{formatNumber(t.rows)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--ink)]">{formatBytes(t.bytes)}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--ink-muted)]">{t.schema_columns}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)] font-mono">
                    {t.partitions.length ? t.partitions.join(', ') : <span className="text-[var(--ink-soft)]">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-[var(--ink-muted)] font-mono">
                    {new Date(t.last_updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Data Quality — dbt Labs ──────────────────────────────────────── */}
      <section className="clinical-card overflow-hidden mb-8" style={cardStyle}>
        <header className="clinical-card-header flex items-start justify-between gap-4" style={cardHeaderStyle}>
          <div>
            <div className="eyebrow" style={{ color: '#FF694A' }}>Data Quality · dbt Labs</div>
            <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
              Every table tested. Every run. Same lake.
            </h2>
            <p className="text-sm text-[var(--ink-muted)] mt-1">
              Tests defined in dbt Labs run on every build, against the same Iceberg tables every
              engine reads. Failures block promotion to the next layer &mdash; bad data never
              reaches the floor. Paired with the Great Expectations checkpoints below: GX runs
              suite-based expectations against raw landings; dbt enforces SQL-native contracts
              across bronze, silver, and gold.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#FF694A' }}>
            dbt Labs
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
          {[
            { layer: 'bronze' as const, tests: 22, passing: 22, monitors: ['freshness', 'volume', 'schema drift'],                                 color: '#b45309' },
            { layer: 'silver' as const, tests: 58, passing: 57, monitors: ['nulls', 'uniqueness', 'referential', 'accepted values'],               color: '#6b7280' },
            { layer: 'gold'   as const, tests: 41, passing: 41, monitors: ['HIPAA-redacted PII', 'cohort cardinality', 'payor reconciliation'],    color: '#b8975c' },
          ].map((q) => {
            const ok = q.passing === q.tests;
            return (
              <div key={q.layer} className="p-5">
                <div className="flex items-center justify-between">
                  <LayerChip layer={q.layer} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ok ? '#16a34a' : '#dc2626' }}>
                    {ok ? '● all passing' : `● ${q.tests - q.passing} warn`}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <div className="font-serif text-3xl font-semibold text-[var(--ink-strong)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {q.passing}<span className="text-[var(--ink-soft)]">/{q.tests}</span>
                  </div>
                  <div className="text-xs text-[var(--ink-muted)]">tests · last run 12m ago</div>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-[var(--ink-muted)]">
                  {q.monitors.map((m) => (
                    <li key={m} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ background: q.color }} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-3 border-t border-[var(--hairline-soft,#e8e4d8)] flex items-center justify-between text-[11px] text-[var(--ink-soft)]" style={{ background: 'var(--paper-deep,#f4efe2)' }}>
          <span className="font-mono">121 tests · 120 passing · 1 warn · 0 errors</span>
          <span className="uppercase tracking-wider font-semibold">dbt Labs · joining Fivetran</span>
        </div>
      </section>

      {/* ── Activations — NewCo native reverse-ETL, right after Transformations ── */}
      <ActivationsPanel />

      {/* ── Data Quality — Great Expectations (Fivetran-stewarded OSS) ──── */}
      <GreatExpectationsPanel />

      {/* ── Before / After — what ODI actually replaces ──────────────────── */}
      <BeforeAfterPanel />
    </div>
  );
}

// =============================================================================
// Helpers — shared styles + sub-components
// =============================================================================

const cardStyle = {
  background: '#ffffff',
  border: '1px solid var(--hairline, #d9d3c4)',
  borderRadius: '4px',
};

const cardHeaderStyle = {
  padding: '20px',
  borderBottom: '1px solid var(--hairline-soft, #e8e4d8)',
};

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)] ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function LayerChip({ layer }: { layer: 'bronze' | 'silver' | 'gold' }) {
  const styles: Record<typeof layer, { bg: string; fg: string; border: string }> = {
    bronze: { bg: '#fef3c7', fg: '#92400e', border: '#b45309' },
    silver: { bg: '#f3f4f6', fg: '#374151', border: '#6b7280' },
    gold:   { bg: '#faf3e1', fg: '#7a5e2d', border: '#b8975c' },
  };
  const s = styles[layer];
  return (
    <span className="inline-block text-[9px] font-bold uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-sm border"
          style={{ background: s.bg, color: s.fg, borderColor: s.border }}>
      {layer}
    </span>
  );
}

function LayerDetail({ layer, stats, desc }: { layer: 'bronze' | 'silver' | 'gold'; stats: { tables: number; rows: number; bytes: number }; desc: string }) {
  return (
    <div className="border border-[var(--hairline,#d9d3c4)] rounded-sm p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <LayerChip layer={layer} />
        <span className="text-[10px] text-[var(--ink-soft)] font-mono">{stats.tables} table{stats.tables === 1 ? '' : 's'}</span>
      </div>
      <div className="text-sm font-bold text-[var(--ink-strong)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatNumber(stats.rows)} rows · {formatBytes(stats.bytes)}
      </div>
      <div className="text-[11px] text-[var(--ink-muted)] mt-1 leading-snug">{desc}</div>
    </div>
  );
}

// =============================================================================
// ThroughputHero — pulsing live counter "rows in motion today"
// =============================================================================
function ThroughputHero() {
  const [rowsToday, setRowsToday] = useState(4_182_017);
  // Tick up by 6–14 rows every 600ms — matches real CDC arrival pace
  useEffect(() => {
    const id = setInterval(() => setRowsToday((n) => n + 6 + Math.floor(Math.random() * 9)), 600);
    return () => clearInterval(id);
  }, []);
  const trend = [3.2, 3.4, 3.6, 3.5, 3.7, 4.0, 4.18]; // 7-day Mrows
  return (
    <section className="mb-8 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 sm:gap-4">
      <div className="clinical-card p-5 sm:p-6 relative overflow-hidden" style={cardStyle}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 100% 0%, rgba(13,148,136,0.12), transparent 60%)' }} />
        <div className="relative">
          <div className="eyebrow" style={{ color: '#0d9488' }}>● Live</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-soft)] font-semibold">
            Rows in motion today
          </div>
          <div className="mt-2 font-serif font-semibold leading-none text-[var(--ink-strong)]"
               style={{ fontSize: 44, fontVariantNumeric: 'tabular-nums' }}>
            {rowsToday.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-[var(--ink-muted)]">across 4 sources · 22 Iceberg tables · CDC + streaming</div>
        </div>
      </div>
      <Kpi label="CDC freshness · p50" value="47s" sub="Epic Clarity source" />
      <Kpi label="Bronze → Gold lag · p99" value="6 min" sub="Within 10-min SLO" />
      <Kpi label="Connector uptime · 90d" value="99.97%" sub={
        <Sparklike values={trend} />
      } />
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="clinical-card p-4 sm:p-5" style={cardStyle}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold">{label}</div>
      <div className="mt-1.5 font-serif font-semibold leading-none text-[var(--ink-strong)]"
           style={{ fontSize: 30, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-muted)]">{sub}</div>
    </div>
  );
}

function Sparklike({ values }: { values: number[] }) {
  const max = Math.max(...values), min = Math.min(...values);
  const rng = max - min || 1;
  const w = 80, h = 18;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / rng) * h).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// =============================================================================
// DbtStateSavingsTeaser — slim band placed beneath ThroughputHero. Shows
// today's *actuals* (not the annual projection — Aaron's warning) with a
// jump-link to the full forecast model inside DbtStatePanel below. Neutral
// slate card + violet left-border so it doesn't fight the teal/sapphire
// ThroughputHero palette (Riley's treatment).
// =============================================================================
function DbtStateSavingsTeaser({
  hitPercent,
  hoursSaved,
  dollarsSaved,
}: {
  hitPercent: number;
  hoursSaved: number;
  dollarsSaved: number;
}) {
  return (
    <section className="mb-8 clinical-card overflow-hidden" style={{ ...cardStyle, borderLeft: '4px solid #7c3aed' }}>
      <div className="p-4 sm:p-5 flex items-center gap-x-6 gap-y-3 flex-wrap">
        <div className="shrink-0">
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#7c3aed' }}>
            Sync-aware dbt · last 24h
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-0.5">Today's actuals · annual model below</div>
        </div>
        <div className="flex items-baseline gap-x-6 gap-y-2 flex-wrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <TeaserStat big={`$${dollarsSaved.toFixed(2)}`} sub="saved today" accent />
          <TeaserStat big={`${hoursSaved.toFixed(1)} h`} sub="compute skipped" />
          <TeaserStat big={`${hitPercent}%`} sub="hit rate" />
        </div>
        <a href="#dbt-state-forecast" className="ml-auto text-[11px] font-semibold whitespace-nowrap hover:underline" style={{ color: '#7c3aed' }}>
          See annual forecast &rarr;
        </a>
      </div>
    </section>
  );
}

function TeaserStat({ big, sub, accent = false }: { big: string; sub: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-serif font-semibold leading-none" style={{ fontSize: 22, color: accent ? '#7c3aed' : 'var(--ink-strong)' }}>
        {big}
      </span>
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">{sub}</span>
    </div>
  );
}

// =============================================================================
// DbtStatePanel — Fivetran skips a sync entirely when source data hasn't
// changed. Hit rate runs in the high-70s on the Clarity connectors; every
// skipped sync is compute we don't pay for AND a fivetran_synced_at
// timestamp that doesn't advance, which means dbt incrementals filtered on
// it process zero rows and complete in seconds.
// =============================================================================
function DbtStatePanel() {
  // Connector-level hit rates over the last 24h. Master tables change rarely
  // (high hit), ledger / transaction tables churn through the day (low hit).
  // The mix lands the aggregate at ~78%.
  const CONNECTORS = [
    { name: 'Epic Clarity EHR · patient',         scheduled: 96, skipped: 92, hit: 0.958 },
    { name: 'Epic Clarity EHR · encounters',      scheduled: 96, skipped: 65, hit: 0.677 },
    { name: 'Epic Clarity EHR · hsp_transaction', scheduled: 96, skipped: 60, hit: 0.625 },
    { name: 'Payor Claims Mart · Oracle CDC',     scheduled: 48, skipped: 44, hit: 0.917 },
    { name: 'CMS NPPES · weekly registry',        scheduled:  7, skipped:  7, hit: 1.000 },
  ];
  const tot = CONNECTORS.reduce((a, c) => ({ s: a.s + c.scheduled, k: a.k + c.skipped }), { s: 0, k: 0 });
  const hit = tot.s ? Math.round((tot.k / tot.s) * 100) : 0;

  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header flex items-start justify-between gap-4" style={cardHeaderStyle}>
        <div>
          <div className="eyebrow" style={{ color: '#7c3aed' }}>Sync-aware dbt incrementals</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            The cheapest dbt build is the one that processes zero rows.
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
            Before each scheduled sync, Fivetran checks the source for changes. When there are
            none, the sync is a no-op and the <code className="font-mono text-[12px]">_fivetran_synced</code> timestamp
            doesn't advance &mdash; so dbt incrementals filtered on it process zero rows on the
            downstream build. Most EHR activity batches into clinic hours; the no-op detection
            earns its keep on the overnight and weekend windows when the encounter feed quiets down.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#7c3aed' }}>
          {hit}% Fivetran no-op · 24h
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <RecoveryTile label="Fivetran no-op sync rate · 24h" big={`${hit}%`}                                  sub={`${tot.k} of ${tot.s} scheduled syncs ended in no-op — source hadn't changed`} color="#7c3aed" />
        <RecoveryTile label="Compute hours saved · 90d"      big="142 h"                                       sub="≈ $284 in warehouse time at XS rate · idle hours bill at zero" color="#16a34a" />
        <RecoveryTile label="Annual savings · stack-wide"    big="$26.4k"                                      sub="Zero-row dbt builds + downstream skip · projected at full Clarity connector mix" color="#16a34a" />
        <RecoveryTile label="No-op-sync check time"          big="~200 ms"                                     sub="p50 control-plane check · no warehouse spin-up · no rows landed" />
      </div>

      <div className="p-5 border-t border-[var(--hairline-soft,#e8e4d8)]">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">No-op sync rate · by connector · last 24h</div>
        <ul className="space-y-2 max-w-4xl">
          {CONNECTORS.map((c) => {
            const pct = Math.round(c.hit * 100);
            const colour = pct >= 80 ? '#16a34a' : pct >= 50 ? '#7c3aed' : '#b45309';
            return (
              <li key={c.name} className="grid grid-cols-[1.6fr_3fr_auto] gap-3 items-center text-[12px]">
                <span className="font-mono text-[11px] text-[var(--ink-strong)] truncate">{c.name}</span>
                <span className="relative h-2.5 rounded-sm overflow-hidden" style={{ background: '#f4f4ef', border: '1px solid var(--hairline-soft,#e8e4d8)' }}>
                  <span className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: colour, transition: 'width 600ms ease' }} />
                </span>
                <span className="font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
                  <strong className="text-[var(--ink-strong)]">{pct}%</strong> · {c.skipped}/{c.scheduled}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 pt-3 border-t border-[var(--hairline-soft,#e8e4d8)] grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2 text-[12px] text-[var(--ink-muted)] leading-snug">
          <div><strong className="text-[var(--ink-strong)]">Filter on <code className="font-mono text-[11px]">_fivetran_synced</code></strong> in every dbt incremental &mdash; that's what propagates Fivetran's no-op decision into the dbt build.</div>
          <div><strong className="text-[var(--ink-strong)]">Honor <code className="font-mono text-[11px]">_fivetran_deleted</code></strong> for soft deletes; the staging layer carries the flag through to gold.</div>
          <div><strong className="text-[var(--ink-strong)]">Never <code className="font-mono text-[11px]">--full-refresh</code></strong> on a schedule &mdash; one rebuild defeats months of saved compute.</div>
        </div>
        <div className="mt-4 rounded-sm border border-[var(--hairline-soft,#e8e4d8)] p-3 flex items-start gap-3 text-[12px]" style={{ background: 'rgba(125,58,237,0.04)' }}>
          <span className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white shrink-0 mt-0.5" style={{ background: '#7c3aed' }}>Related</span>
          <div className="text-[var(--ink-muted)] leading-relaxed">
            <strong className="text-[var(--ink-strong)]">Looking for dbt State the product?</strong> dbt State is a separate dbt Core plugin (<code className="font-mono text-[11px]">pip install dbt-state</code>) that skips, defers, or clones dbt models at the build level — different from this connector-side pattern. See the canonical page at <a className="font-mono text-[11px] underline hover:no-underline" style={{ color: '#7c3aed' }} href="https://fivetran-jasonchletsos.github.io/00-Intro-ODI-Demo/dbt-state/" target="_blank" rel="noopener noreferrer">fivetran-jasonchletsos.github.io/00-Intro-ODI-Demo/dbt-state</a>.
          </div>
        </div>
      </div>

      <DbtStateForecast
        syncsPerDay={tot.s}
        hitRate={tot.k / tot.s}
        secPerSync={32}
        ratePerHour={2.0}
        dbtAmplification={2.4}
        enterpriseScale={6.3}
        connectorCount={CONNECTORS.length}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// DbtStateForecast — transparent savings model attached to the bottom of
// DbtStatePanel. Shows assumptions in, side-by-side without/with comparison
// bars (compute hours + dollars), and a horizon ladder ending at an
// enterprise-scale extrapolation that reconciles with the headline annual
// savings tile above. Labelled clearly as "Model output · not actuals."
// -----------------------------------------------------------------------------
function DbtStateForecast({
  syncsPerDay,
  hitRate,
  secPerSync,
  ratePerHour,
  dbtAmplification,
  enterpriseScale,
  connectorCount,
}: {
  syncsPerDay: number;
  hitRate: number;
  secPerSync: number;
  ratePerHour: number;
  dbtAmplification: number;
  enterpriseScale: number;
  connectorCount: number;
}) {
  const syncsRun = Math.round(syncsPerDay * (1 - hitRate));
  const hoursBaseline = (syncsPerDay * secPerSync) / 3600;
  const hoursCached = (syncsRun * secPerSync) / 3600;
  const hoursSaved = hoursBaseline - hoursCached;
  const dollarsBaselineDay = hoursBaseline * ratePerHour * dbtAmplification;
  const dollarsCachedDay = hoursCached * ratePerHour * dbtAmplification;
  const dollarsSavedDay = dollarsBaselineDay - dollarsCachedDay;
  const cachedPctOfBase = (hoursCached / hoursBaseline) * 100;
  const savedPctOfBase = 100 - cachedPctOfBase;

  const yr = dollarsSavedDay * 365;
  const yrEnterprise = yr * enterpriseScale;
  const hoursYrEnterprise = hoursSaved * 365 * enterpriseScale;

  return (
    <div
      id="dbt-state-forecast"
      className="border-t border-[var(--hairline-soft,#e8e4d8)] p-5 scroll-mt-20"
      style={{ background: 'linear-gradient(180deg, rgba(124,58,237,0.04) 0%, rgba(124,58,237,0) 100%)' }}
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#7c3aed' }}>
            Forecast · projected savings
          </div>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            At today's modeled no-op rate, what skipping the unchanged syncs is worth in time and money.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider"
          style={{ background: '#ffffff', color: '#7c3aed', border: '1px solid #c4b5fd' }}
        >
          Model output · not actuals
        </span>
      </div>

      {/* Assumptions strip */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-5 text-[11px] font-mono text-[var(--ink-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span><strong className="text-[var(--ink-strong)]">{syncsPerDay}</strong> syncs/day</span>
        <span className="opacity-50">·</span>
        <span><strong className="text-[var(--ink-strong)]">{secPerSync}s</strong>/sync uncached</span>
        <span className="opacity-50">·</span>
        <span><strong className="text-[var(--ink-strong)]">{Math.round(hitRate * 100)}%</strong> modeled no-op rate</span>
        <span className="opacity-50">·</span>
        <span><strong className="text-[var(--ink-strong)]">${ratePerHour.toFixed(2)}</strong>/credit-hour XS</span>
        <span className="opacity-50">·</span>
        <span><strong className="text-[var(--ink-strong)]">{dbtAmplification}×</strong> dbt amp <span className="opacity-70">(incremental models only)</span></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {/* Comparison bars — without vs with vs saved */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold">Daily picture</div>

          <div>
            <div className="flex items-baseline justify-between text-[11px] mb-1">
              <span className="font-semibold text-[var(--ink-strong)]">Without no-op detection</span>
              <span className="font-mono text-[var(--ink-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{hoursBaseline.toFixed(2)} h · ${dollarsBaselineDay.toFixed(2)}</span>
            </div>
            <div className="h-3.5 rounded-sm overflow-hidden" style={{ background: '#f4f4ef', border: '1px solid var(--hairline-soft,#e8e4d8)' }}>
              <div className="h-full" style={{ width: '100%', background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)', opacity: 0.85 }} />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[11px] mb-1">
              <span className="font-semibold text-[var(--ink-strong)]">With no-op detection</span>
              <span className="font-mono text-[var(--ink-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{hoursCached.toFixed(2)} h · ${dollarsCachedDay.toFixed(2)}</span>
            </div>
            <div className="h-3.5 rounded-sm overflow-hidden" style={{ background: '#f4f4ef', border: '1px solid var(--hairline-soft,#e8e4d8)' }}>
              <div className="h-full" style={{ width: `${cachedPctOfBase.toFixed(1)}%`, background: 'linear-gradient(90deg, #7c3aed 0%, #6d28d9 100%)', opacity: 0.9, transition: 'width 900ms ease' }} />
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--hairline-soft,#e8e4d8)]">
            <div className="flex items-baseline justify-between text-[11.5px] mb-1">
              <span className="font-semibold" style={{ color: '#15803d' }}>Saved · zero-row dbt + amp</span>
              <span className="font-mono font-bold" style={{ color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>{hoursSaved.toFixed(2)} h · ${dollarsSavedDay.toFixed(2)}</span>
            </div>
            <div className="h-3.5 rounded-sm overflow-hidden" style={{ background: '#f4f4ef', border: '1px solid var(--hairline-soft,#e8e4d8)' }}>
              <div className="h-full" style={{ width: `${savedPctOfBase.toFixed(1)}%`, background: 'linear-gradient(90deg, #16a34a 0%, #15803d 100%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)', transition: 'width 900ms ease' }} />
            </div>
          </div>
        </div>

        {/* Horizon ladder */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">Cumulative savings · horizon</div>
          <div className="space-y-2">
            <HorizonRow label="Today"    big={`$${dollarsSavedDay.toFixed(2)}`}                sub={`${hoursSaved.toFixed(2)} compute-hours saved`} />
            <HorizonRow label="30 days"  big={`$${(dollarsSavedDay * 30).toFixed(0)}`}         sub={`${(hoursSaved * 30).toFixed(0)} hours saved`} />
            <HorizonRow label="Quarter"  big={`$${(dollarsSavedDay * 90).toFixed(0)}`}         sub={`${(hoursSaved * 90).toFixed(0)} hours saved`} />
            <HorizonRow label="Annual"   big={`$${(yr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`} sub={`${(hoursSaved * 365).toFixed(0)} hours saved · this ${connectorCount}-connector mix`} accent />
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--hairline-soft,#e8e4d8)] rounded-sm p-2.5" style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)' }}>
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#15803d' }}>Annual · enterprise scale</div>
                <div className="text-[10.5px] text-[var(--ink-muted)] mt-0.5">≈ {Math.round(enterpriseScale * connectorCount)} connectors at this hit-rate pattern</div>
              </div>
              <div className="text-right">
                <div className="font-serif font-semibold leading-none" style={{ fontSize: 22, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                  ${(yrEnterprise / 1000).toFixed(1)}k
                </div>
                <div className="font-mono text-[10px] text-[var(--ink-muted)] mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {(hoursYrEnterprise).toLocaleString('en-US', { maximumFractionDigits: 0 })} hours/yr
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-[var(--ink-soft)] leading-relaxed mt-5">
        <strong className="text-[var(--ink-strong)]">Validate in your environment.</strong> Demo-mix savings
        scale with sync cadence, warehouse rate, and downstream dbt model count &mdash; the dbt amplification
        multiplier reflects that every no-op-detected sync zero-rows the incrementals downstream of it.
        We size the enterprise extrapolation from your typical connector count and re-fit the assumptions during POC.
      </p>
    </div>
  );
}

function HorizonRow({ label, big, sub, accent = false }: { label: string; big: string; sub: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10.5px] uppercase tracking-wider text-[var(--ink-muted)] font-semibold shrink-0" style={{ width: 72 }}>{label}</span>
      <span className="font-mono font-semibold shrink-0" style={{ color: accent ? '#15803d' : 'var(--ink-strong)', fontVariantNumeric: 'tabular-nums', fontSize: accent ? 14 : 12, minWidth: 70 }}>{big}</span>
      <span className="text-[10.5px] text-[var(--ink-soft)] truncate">{sub}</span>
    </div>
  );
}

// =============================================================================
// SchemaEvolutionTicker — Iceberg's killer feature, displayed as a stock-ticker
// =============================================================================
const EVO_EVENTS = [
  { ts: '2026-05-24 06:14', op: 'ADD COLUMN sdoh_risk_score',          table: 'bronze.clarity__pat_enc',   ms: 38, models: 4 },
  { ts: '2026-05-23 22:01', op: 'RENAME COLUMN dob_str → dob',          table: 'bronze.clarity__patient',   ms: 22, models: 6 },
  { ts: '2026-05-22 14:47', op: 'WIDEN INT → BIGINT account_balance',   table: 'silver.int_financials',     ms: 41, models: 2 },
  { ts: '2026-05-21 09:30', op: 'ADD COLUMN payor_class',                table: 'gold.dim_patients',        ms: 19, models: 8 },
  { ts: '2026-05-20 18:09', op: 'DROP COLUMN deprecated_dx_code',        table: 'bronze.clarity__pat_enc_dx', ms: 28, models: 3 },
];
function SchemaEvolutionTicker() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((n) => (n + 1) % EVO_EVENTS.length), 4200);
    return () => clearInterval(id);
  }, []);
  const e = EVO_EVENTS[idx];
  return (
    <section className="mb-8 clinical-card p-5 overflow-hidden relative" style={{ ...cardStyle, background: 'linear-gradient(90deg, #fff 0%, #f8fafc 100%)' }}>
      <div className="absolute top-0 right-0 bottom-0 w-1.5" style={{ background: 'linear-gradient(180deg, #5fb3a1, #1d4e89)' }} />
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="eyebrow" style={{ color: '#1d4e89' }}>Iceberg · Schema evolution</div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm" style={{ color: '#0d9488', background: '#ecfeff', border: '1px solid #99f6e4' }}>
            ● Live feed
          </span>
        </div>
        <div className="font-mono text-[10px] text-[var(--ink-soft)]">last 5 schema changes</div>
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span className="font-mono text-[11px] text-[var(--ink-soft)]">{e.ts}</span>
        <span className="font-mono text-[13px] font-semibold text-[var(--ink-strong)]">{e.op}</span>
        <span className="font-mono text-[12px] text-[var(--ink-muted)]">on {e.table}</span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-[12px] text-[var(--ink-muted)] flex-wrap">
        <span><strong className="text-[var(--ink-strong)]">{e.ms} ms</strong> · metadata-only operation</span>
        <span>•</span>
        <span>0 data rewritten · 0 downtime</span>
        <span>•</span>
        <span><strong className="text-[var(--ink-strong)]">{e.models}</strong> downstream dbt models auto-revalidated</span>
      </div>
      <div className="mt-3 text-[11px] text-[var(--ink-soft)] leading-relaxed">
        Apache Iceberg treats schema changes as table metadata, not file rewrites. The Modern Data Stack equivalent —
        an Oracle <code className="font-mono">ALTER TABLE ADD COLUMN</code> on a 1.8 M-row Clarity table — locks the
        table for ~6 minutes during the rewrite. Same change in Iceberg: <strong>milliseconds, no lock</strong>.
      </div>
    </section>
  );
}

// =============================================================================
// CostPanel — the CFO line. Storage cheap, compute the lever.
// =============================================================================
function CostPanel() {
  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header" style={cardHeaderStyle}>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow" style={{ color: '#0d9488' }}>FinOps</div>
            <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
              What this costs to run, every day
            </h2>
            <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
              Storage and compute billed separately. Storage is essentially free at this scale; compute scales
              with workload because Snowflake warehouses auto-suspend when no one is reading.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#0d9488' }}>
            −68% vs legacy
          </div>
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <CostTile label="Storage · per day"   value="$0.87"  sub="2.4 TB across bronze/silver/gold · S3 Standard-IA"  color="#16a34a" />
        <CostTile label="Compute · per day"   value="$4.12"  sub="Snowflake XS auto-suspend · dbt · Athena ad-hoc" color="#0d9488" />
        <CostTile label="Zero-row dbt · saved" value="$4.76"  sub="78% of Fivetran syncs no-op today · downstream dbt builds finish in zero rows" color="#7c3aed" />
        <CostTile label="Equivalent MDS"      value="$15.40" sub="Internal benchmark · same data, warehouse-resident" color="#dc2626" />
      </div>
      <div className="px-5 py-3 border-t border-[var(--hairline-soft,#e8e4d8)] flex items-center justify-between text-[11px] text-[var(--ink-soft)] bg-[var(--paper-deep,#f4efe2)]">
        <span>Compute curve: 70% of spend is the 9 AM–11 AM reporting window. Idle hours bill at zero.</span>
        <span className="uppercase tracking-wider font-semibold">Cost-attribution: per-warehouse + per-dbt-model</span>
      </div>
    </section>
  );
}

function CostTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold">{label}</div>
      <div className="mt-2 font-serif font-semibold leading-none" style={{ fontSize: 30, color, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-muted)] leading-snug">{sub}</div>
    </div>
  );
}

// =============================================================================
// FailureRecoveryPanel — the "what happens when it breaks" answer
// =============================================================================
function FailureRecoveryPanel() {
  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header" style={cardHeaderStyle}>
        <div className="eyebrow" style={{ color: '#b45309' }}>Resilience · Recovery</div>
        <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
          What happens when a connector fails
        </h2>
        <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
          Every Fivetran connector has automatic retry with exponential backoff; failed rows land in a
          dead-letter queue for replay; dbt builds gate gold on green silver. Below: the last 30 days.
        </p>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <RecoveryTile label="Retry policy"        big="exp 5×"   sub="2s · 8s · 30s · 2m · 8m, then DLQ" />
        <RecoveryTile label="Dead-letter · current" big="14"     sub="rows held · 11 ADT, 3 NPI dupe-key" color="#b45309" />
        <RecoveryTile label="MTTR · last 30d"     big="6 min"    sub="median · max 23 min during HL7 cert rotation" />
        <RecoveryTile label="Last incident"       big="4 d ago"  sub="Replayed automatically in 3 min, zero data loss" color="#16a34a" />
      </div>
    </section>
  );
}

function RecoveryTile({ label, big, sub, color = 'var(--ink-strong)' }: { label: string; big: string; sub: string; color?: string }) {
  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold">{label}</div>
      <div className="mt-1.5 font-serif font-semibold leading-none" style={{ fontSize: 26, color, fontVariantNumeric: 'tabular-nums' }}>
        {big}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-muted)] leading-snug">{sub}</div>
    </div>
  );
}

// =============================================================================
// DataContractsPanel — HIPAA-specific governance (PII, RLS, masking, audit)
// =============================================================================
function DataContractsPanel() {
  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header flex items-start justify-between gap-4" style={cardHeaderStyle}>
        <div>
          <div className="eyebrow" style={{ color: '#5b21b6' }}>Data Contracts · HIPAA Governance</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            PHI never leaves the lake without a policy
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
            Every column with patient PII or PHI is tagged at ingest. Row-level access scopes by
            provider organisation. Column masking on SSN, DOB, address. Every read goes to an audit log.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#5b21b6' }}>
          🛡 HIPAA
        </div>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">Policy coverage</div>
          <ul className="space-y-2 text-sm">
            <Policy label="PII / PHI columns tagged" value="32 columns across 9 tables" />
            <Policy label="Row-level access policy"  value="provider_organization_id scoped per role" />
            <Policy label="Column masking on read"   value="ssn · dob · address · phone · mrn" />
            <Policy label="Audit log destination"    value="CloudTrail → S3 (90d) → Iceberg audit table" />
            <Policy label="De-identification path"   value="gold.fct_research_cohorts uses HIPAA Safe Harbor de-id" />
          </ul>
        </div>
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">Sample contract · gold.dim_patients</div>
          <pre className="font-mono text-[11.5px] leading-relaxed overflow-x-auto rounded-sm p-3" style={{ background: '#0b2545', color: '#e6e9f0' }}><code>{`columns:
  - name: patient_id
    tests: [unique, not_null]
    meta: { contains_pii: true, mask_policy: "tokenise" }
  - name: ssn
    tests: [not_null]
    meta: { contains_pii: true, mask_policy: "redact_full" }
  - name: dob
    meta: { contains_pii: true, mask_policy: "year_only" }
  - name: provider_organization_id
    tests: [relationships: dim_providers]
    meta: { rls_partition_key: true }`}</code></pre>
        </div>
      </div>
    </section>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#5b21b6' }} />
      <div className="flex-1">
        <span className="text-[var(--ink-strong)] font-semibold">{label}</span>
        <span className="text-[var(--ink-muted)]"> · {value}</span>
      </div>
    </li>
  );
}

// =============================================================================
// GreatExpectationsPanel — GX Core as the validation gate before Silver
// promotion. Fivetran became steward of the Great Expectations community
// and the GX Core project on 2026-05-13; dbt tests sit alongside GX as
// the "trust" pillar of Fivetran's ODI story (move · transform · trust).
// =============================================================================
interface GxSuite {
  suite: string;
  table: string;
  layer: 'bronze' | 'silver' | 'gold';
  expectations: number;
  passing: number;
  last_run: string;
  why: string;
}

const GX_SUITES: GxSuite[] = [
  {
    suite: 'clarity.patient.completeness',
    table: 'bronze.clarity__patient',
    layer: 'bronze',
    expectations: 18,
    passing: 18,
    last_run: '07:14:22',
    why: 'PHI completeness — mrn / dob / ssn populated; no impossible birthdates; age in [0, 120].',
  },
  {
    suite: 'clarity.encounter.referential',
    table: 'bronze.clarity__pat_enc',
    layer: 'bronze',
    expectations: 22,
    passing: 22,
    last_run: '07:14:31',
    why: 'Every encounter resolves to a known patient_id; admit_dt ≤ disch_dt; encounter_type ∈ accepted set.',
  },
  {
    suite: 'clarity.diagnosis.value_set',
    table: 'bronze.clarity__pat_enc_dx',
    layer: 'bronze',
    expectations: 14,
    passing: 13,
    last_run: '07:14:38',
    why: 'ICD-10 codes match the CMS-published value set; one warn this run on 47 codes recently retired.',
  },
  {
    suite: 'payor.claims.ranges',
    table: 'bronze.payor__claims',
    layer: 'bronze',
    expectations: 16,
    passing: 16,
    last_run: '07:11:09',
    why: 'Charge amounts in [$0, $250K]; service_dt within last 18 months; denial_code ∈ X12 standard set.',
  },
  {
    suite: 'hl7.adt.schema',
    table: 'bronze.hl7__adt_events',
    layer: 'bronze',
    expectations: 11,
    passing: 11,
    last_run: '07:12:48',
    why: 'Streaming HL7 v2 ADT messages parse cleanly; required MSH/PID/PV1 segments present.',
  },
  {
    suite: 'silver.encounter_spine.integrity',
    table: 'silver.int_patient_encounter_spine',
    layer: 'silver',
    expectations: 24,
    passing: 24,
    last_run: '07:18:14',
    why: 'Spine joins Clarity + HL7 + claims at 1 row per (patient_id, encounter_id); no orphans.',
  },
  {
    suite: 'gold.dim_patients.contract',
    table: 'gold.dim_patients',
    layer: 'gold',
    expectations: 19,
    passing: 19,
    last_run: '07:22:51',
    why: 'Output contract: PII columns masked per policy; payor_class ∈ {Commercial, Medicare, Medicaid, Self-Pay}; row count within ±2% of yesterday.',
  },
  {
    suite: 'gold.fct_chronic_cohorts.cardinality',
    table: 'gold.fct_chronic_cohorts',
    layer: 'gold',
    expectations: 12,
    passing: 12,
    last_run: '07:22:59',
    why: 'Each chronic-condition cohort has between 50 and 50K members; CHF / COPD / Diabetes never null.',
  },
];

function GreatExpectationsPanel() {
  const totals = GX_SUITES.reduce(
    (a, s) => ({ exp: a.exp + s.expectations, pass: a.pass + s.passing, suites: a.suites + 1 }),
    { exp: 0, pass: 0, suites: 0 },
  );
  const warns = totals.exp - totals.pass;

  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header flex items-start justify-between gap-4" style={cardHeaderStyle}>
        <div>
          <div className="eyebrow" style={{ color: '#9a3412' }}>Data Quality · Great Expectations</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            Validation runs on Bronze before anything reaches Silver.
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
            Expectation suites define what "valid" looks like for each Clarity table &mdash; PHI completeness,
            ICD-10 value-set conformance, payor charge ranges, referential integrity to the patient master.
            A failed expectation blocks promotion. Same lake, same Iceberg snapshots, just gated.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: '#9a3412' }}>
            GX Core · OSS
          </div>
          <div className="text-[10px] text-[var(--ink-soft)] font-mono">Fivetran-stewarded</div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <RecoveryTile label="Expectation suites"  big={String(totals.suites)} sub={`across bronze · silver · gold layers`} />
        <RecoveryTile label="Expectations · today" big={`${totals.pass}/${totals.exp}`} sub={`${warns} warn · 0 errors · gates Silver promotion`} color={warns ? '#b45309' : '#16a34a'} />
        <RecoveryTile label="Checkpoint cadence"  big="every sync" sub="triggered by Fivetran sync-complete · runs before dbt build" />
        <RecoveryTile label="Failed-expectation queue" big="3 rows"  sub="held in dlq.gx_quarantine · auto-retried after suite update" color="#b45309" />
      </div>

      <div className="overflow-x-auto border-t border-[var(--hairline-soft,#e8e4d8)]">
        <table className="min-w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead className="border-b border-[var(--hairline)]" style={{ background: 'var(--paper-deep,#f4efe2)' }}>
            <tr>
              <Th>Layer</Th>
              <Th>Suite</Th>
              <Th>Table under test</Th>
              <Th align="right">Expectations</Th>
              <Th align="right">Last run</Th>
              <Th>What it asserts</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline-soft,#e8e4d8)]">
            {GX_SUITES.map((s) => {
              const ok = s.passing === s.expectations;
              return (
                <tr key={s.suite} className="hover:bg-[var(--paper-deep,#f4efe2)] cursor-default">
                  <td className="px-4 py-2.5"><LayerChip layer={s.layer} /></td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--ink-strong)]">{s.suite}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)] font-mono">{s.table}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: ok ? '#16a34a' : '#b45309' }}>
                    {s.passing}/{s.expectations}
                    {!ok && <span className="ml-1 text-[10px] uppercase tracking-wider">warn</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-[var(--ink-muted)] font-mono">{s.last_run}</td>
                  <td className="px-4 py-2.5 text-xs text-[var(--ink)] leading-snug max-w-md">{s.why}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)] border-t border-[var(--hairline-soft,#e8e4d8)]">
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">Sample expectation suite · clarity.patient.completeness</div>
          <pre className="font-mono text-[11.5px] leading-relaxed overflow-x-auto rounded-sm p-3" style={{ background: '#0b2545', color: '#e6e9f0' }}><code>{`# clarity_patient_completeness.yml
expectation_suite_name: clarity.patient.completeness
data_asset_name: bronze.clarity__patient

expectations:
  - expect_column_values_to_not_be_null:
      column: mrn
  - expect_column_values_to_be_unique:
      column: mrn
  - expect_column_values_to_match_regex:
      column: ssn
      regex: '^[0-9]{3}-[0-9]{2}-[0-9]{4}$'
  - expect_column_values_to_be_between:
      column: age_years
      min_value: 0
      max_value: 120
  - expect_column_values_to_be_in_set:
      column: payor_class
      value_set: [Commercial, Medicare, Medicaid, Self-Pay]
  - expect_table_row_count_to_be_between:
      min_value: 350000
      max_value: 500000`}</code></pre>
        </div>
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-3">How this fits the stack</div>
          <ul className="space-y-2.5 text-sm">
            <Policy label="Fivetran moves" value="CDC + batch + HL7 streams into Bronze (Iceberg)" />
            <Policy label="Great Expectations validates" value="Bronze landings against suites before Silver promotion" />
            <Policy label="dbt transforms" value="Silver + Gold marts; dbt tests assert SQL-level constraints" />
            <Policy label="Failed rows" value="route to dlq.gx_quarantine on the same lake; retried after suite update" />
            <Policy label="Open source" value="GX Core remains community-driven; Fivetran funds maintenance, ecosystem, and engineering investment" />
            <Policy label="Community" value="github.com/great-expectations/great_expectations · thousands of teams use GX outside Fivetran's customer base" />
          </ul>
          <div className="mt-4 pt-3 border-t border-[var(--hairline-soft,#e8e4d8)] text-[11px] text-[var(--ink-soft)] leading-relaxed">
            On May 13, 2026 Fivetran announced it is becoming steward of the Great Expectations open
            source community and the GX Core project, supporting ongoing maintenance, ecosystem
            integrations, and community engagement. Same open project, backed by sustained engineering.
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// ActivationsPanel — NewCo Activations (formerly Census), the native
// reverse-ETL stage that sits directly after Transformations. TRIGGER /
// DESTINATION / OUTCOME below are vertical-specific to Clarity Health's
// SEP-1 sepsis-bundle redraw workflow.
// =============================================================================
function ActivationsPanel() {
  // TRIGGER — the gold-layer condition that fires the sync
  const TRIGGER = "gold.fct_vital flags an ER-admitted patient where lactate was drawn, the 3-hour SEP-1 redraw hasn't been ordered, and fewer than 30 minutes remain before the redraw window closes (lactate_drawn = true AND lactate_redrawn_3h IS NULL AND minutes_since_initial_lactate >= 150)";
  // DESTINATION — the downstream system NewCo Activations pushes into
  const DESTINATION = 'TigerConnect · Care Team Channel alert';
  // OUTCOME — the business payoff the SE narrates
  const OUTCOME = "Closing the 30-minute pre-deadline window lifts cardiology SEP-1 bundle compliance from the crisis-week 79% (11 of 14 fallouts) toward a targeted 96%+ — avoiding an estimated $18k–$34k in excess length-of-stay cost per averted case and keeping SEP-1 out of the CMS Hospital VBP penalty band.";

  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header flex items-start justify-between gap-4" style={cardHeaderStyle}>
        <div>
          <div className="eyebrow" style={{ color: '#0e7490' }}>Activations · NewCo</div>
          <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
            The gold layer doesn't just get queried. It gets acted on.
          </h2>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
            Activations is the fourth native stage in NewCo, immediately after Transformations. It
            reads straight from the same Iceberg gold tables dbt just built and syncs the result to
            an operational system of record &mdash; no separate reverse-ETL vendor, no second copy of the
            data, no second connector to maintain.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#0e7490' }}>
          Activations
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft,#e8e4d8)]">
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-2">Trigger · gold layer</div>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{TRIGGER}</p>
        </div>
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-2">Destination</div>
          <p className="text-sm text-[var(--ink)] leading-relaxed font-mono">{DESTINATION}</p>
        </div>
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)] font-semibold mb-2">Outcome</div>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{OUTCOME}</p>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-[var(--hairline-soft,#e8e4d8)] flex items-center justify-between text-[11px] text-[var(--ink-soft)]" style={{ background: 'var(--paper-deep,#f4efe2)' }}>
        <span>Connections &rarr; Destinations &rarr; Transformations &rarr; <strong style={{ color: '#0e7490' }}>Activations</strong> &middot; one platform, one lineage graph</span>
        <Link to="/activations-live" className="uppercase tracking-wider font-semibold hover:underline" style={{ color: '#0e7490' }}>
          Watch it sync &rarr;
        </Link>
      </div>
    </section>
  );
}

// =============================================================================
// BeforeAfterPanel — replaces the static MDS-vs-ODI two-column comparison.
//                    Visual: 14 hops + 3 copies → 5 hops + 1 copy
// =============================================================================
function BeforeAfterPanel() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="clinical-card p-6 border-l-4" style={{ ...cardStyle, borderLeftColor: '#dc2626' }}>
        <div className="eyebrow" style={{ color: '#dc2626' }}>Before · Modern Data Stack</div>
        <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">14 hops · 3 copies of the bytes</h3>
        <pre className="font-mono text-[10.5px] leading-relaxed mt-4 p-3 rounded-sm overflow-x-auto" style={{ background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca' }}>{`Source → SFTP → Stitch → Snowflake (raw)
       → dbt → Snowflake (silver) → Snowflake (gold)
       → Census reverse-ETL → Hightouch → 3rd-party AI store
       → Looker materialised view → BI extract → analyst laptop`}</pre>
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[var(--ink-soft)] text-xs">Copies of the data</div><div className="font-serif text-2xl font-semibold text-[var(--ink-strong)]">3</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Avg end-to-end latency</div><div className="font-serif text-2xl font-semibold text-[var(--ink-strong)]">14 hr</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Daily run-rate</div><div className="font-serif text-2xl font-semibold text-[var(--ink-strong)]">$15.40</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Schema change</div><div className="font-serif text-lg font-semibold text-[var(--ink-strong)]">6-min lock</div></div>
          </div>
          <div className="col-span-2 pt-3 mt-1 border-t border-[var(--hairline-soft,#e8e4d8)]">
            <div className="text-[var(--ink-soft)] text-xs">Reverse-ETL hop</div>
            <div className="font-serif text-lg font-semibold text-[var(--ink-strong)]">
              Census + Hightouch <span className="text-xs font-sans font-normal text-[var(--ink-soft)]">(3rd-party, one more copy)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="clinical-card p-6 border-l-4" style={{ ...cardStyle, borderLeftColor: '#0d9488' }}>
        <div className="eyebrow" style={{ color: '#0d9488' }}>After · Open Data Infrastructure</div>
        <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">5 hops · 1 copy of the bytes</h3>
        <pre className="font-mono text-[10.5px] leading-relaxed mt-4 p-3 rounded-sm overflow-x-auto" style={{ background: '#ecfdf5', color: '#064e3b', border: '1px solid #a7f3d0' }}>{`Source → Fivetran CDC → Iceberg bronze
       → dbt → Iceberg silver
       → dbt → Iceberg gold
       ↳ Snowflake · Athena · DuckDB · Trino · Spark
         (all reading the same bytes, no copies)
       → NewCo Activations (native) → TigerConnect`}</pre>
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[var(--ink-soft)] text-xs">Copies of the data</div><div className="font-serif text-2xl font-semibold" style={{ color: '#0d9488' }}>1</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Avg end-to-end latency</div><div className="font-serif text-2xl font-semibold" style={{ color: '#0d9488' }}>6 min</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Daily run-rate</div><div className="font-serif text-2xl font-semibold" style={{ color: '#0d9488' }}>$4.99</div></div>
            <div><div className="text-[var(--ink-soft)] text-xs">Schema change</div><div className="font-serif text-lg font-semibold" style={{ color: '#0d9488' }}>milliseconds</div></div>
          </div>
          <div className="col-span-2 pt-3 mt-1 border-t border-[var(--hairline-soft,#e8e4d8)]">
            <div className="text-[var(--ink-soft)] text-xs">Reverse-ETL hop</div>
            <div className="font-serif text-lg font-semibold" style={{ color: '#0d9488' }}>
              NewCo Activations <span className="text-xs font-sans font-normal text-[var(--ink-soft)]">(native, zero extra copies)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// LineagePanel — pick any gold model, see its upstream silver + bronze.
// dbt's killer feature, surfaced as an interactive trace.
// =============================================================================
type LineageEdge = { from: string; to: string; tests?: string[] };

const LINEAGE_MAP: Record<string, { silver: string[]; bronze: string[]; edges: LineageEdge[]; story: string }> = {
  'gold.fct_chronic_cohorts': {
    silver: ['silver.int_chronic_conditions', 'silver.int_patient_encounter_spine', 'silver.int_encounter_diagnoses'],
    bronze: ['bronze.clarity__patient', 'bronze.clarity__pat_enc', 'bronze.clarity__pat_enc_dx'],
    story:  'Cohort definitions join encounter history to ICD-10 diagnoses. Used by population-health reports and the chronic-care registry.',
    edges: [
      { from: 'bronze.clarity__patient',      to: 'silver.int_patient_encounter_spine', tests: ['unique patient_id'] },
      { from: 'bronze.clarity__pat_enc',      to: 'silver.int_patient_encounter_spine', tests: ['not-null encounter_id'] },
      { from: 'bronze.clarity__pat_enc_dx',   to: 'silver.int_encounter_diagnoses' },
      { from: 'silver.int_encounter_diagnoses', to: 'silver.int_chronic_conditions' },
      { from: 'silver.int_chronic_conditions',  to: 'gold.fct_chronic_cohorts' },
      { from: 'silver.int_patient_encounter_spine', to: 'gold.fct_chronic_cohorts' },
    ],
  },
  'gold.fct_encounters': {
    silver: ['silver.int_patient_encounter_spine'],
    bronze: ['bronze.clarity__patient', 'bronze.clarity__pat_enc', 'bronze.hl7__adt_events'],
    story:  'Encounter facts including ED visits, inpatient stays, and HL7 ADT-derived real-time admit/discharge events.',
    edges: [
      { from: 'bronze.clarity__patient',  to: 'silver.int_patient_encounter_spine' },
      { from: 'bronze.clarity__pat_enc',  to: 'silver.int_patient_encounter_spine' },
      { from: 'bronze.hl7__adt_events',   to: 'silver.int_patient_encounter_spine', tests: ['streaming · 12 s p99'] },
      { from: 'silver.int_patient_encounter_spine', to: 'gold.fct_encounters' },
    ],
  },
  'gold.fct_payor_denied_claims': {
    silver: ['silver.int_claims_reconciled', 'silver.int_financials'],
    bronze: ['bronze.payor__claims', 'bronze.clarity__hsp_transaction'],
    story:  'Payor denial signal joined to internal financial transactions. Drives the revenue-cycle dashboard.',
    edges: [
      { from: 'bronze.payor__claims',           to: 'silver.int_claims_reconciled' },
      { from: 'bronze.clarity__hsp_transaction', to: 'silver.int_financials' },
      { from: 'silver.int_claims_reconciled',   to: 'gold.fct_payor_denied_claims' },
      { from: 'silver.int_financials',           to: 'gold.fct_payor_denied_claims' },
    ],
  },
  'gold.dim_patients': {
    silver: ['silver.int_patient_encounter_spine'],
    bronze: ['bronze.clarity__patient'],
    story:  'Master patient dimension. PII-tagged, masked on read by role.',
    edges: [
      { from: 'bronze.clarity__patient', to: 'silver.int_patient_encounter_spine' },
      { from: 'silver.int_patient_encounter_spine', to: 'gold.dim_patients' },
    ],
  },
};

function LineagePanel() {
  const goldOptions = Object.keys(LINEAGE_MAP);
  const [selected, setSelected] = useState<string>(goldOptions[0]);
  const lin = LINEAGE_MAP[selected];

  // Bronze on the left (x=20), Silver middle (x=320), Gold right (x=620).
  // Heights are dynamic per how many tables per layer.
  const BX = 20, MX = 320, RX = 620;
  const COL_W = 280;
  const ROW_H = 38, ROW_GAP = 8;
  const maxRows = Math.max(lin.bronze.length, lin.silver.length, 1);
  const HEIGHT = Math.max(maxRows * (ROW_H + ROW_GAP) + 40, 240);

  const bronzeY = (i: number) => 30 + i * (ROW_H + ROW_GAP);
  const silverY = (i: number) => 30 + i * (ROW_H + ROW_GAP);
  const goldY = (HEIGHT - ROW_H) / 2;

  const nodeOf = (name: string): { x: number; y: number; w: number; h: number } | null => {
    const bi = lin.bronze.indexOf(name);
    if (bi >= 0) return { x: BX, y: bronzeY(bi), w: COL_W, h: ROW_H };
    const si = lin.silver.indexOf(name);
    if (si >= 0) return { x: MX, y: silverY(si), w: COL_W, h: ROW_H };
    if (name === selected) return { x: RX, y: goldY, w: COL_W, h: ROW_H };
    return null;
  };

  return (
    <section className="mb-8 clinical-card overflow-hidden" style={cardStyle}>
      <header className="clinical-card-header" style={cardHeaderStyle}>
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="eyebrow" style={{ color: '#FF694A' }}>dbt · Column-level lineage</div>
            <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
              Pick any gold model. See exactly where its bytes come from.
            </h2>
            <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-3xl">
              dbt emits lineage as a side-effect of build. Every join, every transformation, every test
              is documented automatically. Click a gold model below to trace upstream &mdash; bronze
              landings to silver intermediates to the gold mart.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#FF694A' }}>
            dbt Labs
          </div>
        </div>
      </header>

      {/* Gold model picker */}
      <div className="px-5 pt-4 flex flex-wrap gap-2">
        {goldOptions.map((g) => (
          <button
            key={g}
            onClick={() => setSelected(g)}
            className="px-3 py-2 rounded-sm text-[11.5px] font-mono border transition-all"
            style={
              selected === g
                ? { background: '#b8975c', borderColor: '#b8975c', color: '#fff' }
                : { background: '#fff', borderColor: 'var(--hairline)', color: 'var(--ink-muted)' }
            }
          >
            {g}
          </button>
        ))}
      </div>

      <div className="p-5">
        <p className="text-sm text-[var(--ink)] mb-4 italic">{lin.story}</p>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${RX + COL_W + 20} ${HEIGHT}`} className="w-full" style={{ minWidth: 880, maxHeight: 360 }}>
            <defs>
              <marker id="lin-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#FF694A" />
              </marker>
            </defs>

            {/* Column eyebrows */}
            <text x={BX}        y={18} fontSize="10" fontWeight="700" fill="#826b3f" letterSpacing="1.6">BRONZE · raw</text>
            <text x={MX}        y={18} fontSize="10" fontWeight="700" fill="#374151" letterSpacing="1.6">SILVER · conformed</text>
            <text x={RX}        y={18} fontSize="10" fontWeight="700" fill="#7a5e2d" letterSpacing="1.6">GOLD · selected</text>

            {/* Edges first so cards sit on top */}
            {lin.edges.map((e, i) => {
              const a = nodeOf(e.from);
              const b = nodeOf(e.to);
              if (!a || !b) return null;
              const x1 = a.x + a.w, y1 = a.y + a.h / 2;
              const x2 = b.x,         y2 = b.y + b.h / 2;
              const mid = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="#FF694A" strokeWidth="1.6" strokeLinecap="round" markerEnd="url(#lin-arrow)" opacity="0.75" />
                  {/* Particle traveling along the curve */}
                  <circle r="2.5" fill="#FF694A">
                    <animateMotion dur={`${2.0 + i * 0.18}s`} repeatCount="indefinite" path={d} />
                    <animate attributeName="opacity" values="0;1;1;0" dur={`${2.0 + i * 0.18}s`} repeatCount="indefinite" />
                  </circle>
                  {e.tests && (
                    <g transform={`translate(${mid - 38}, ${(y1 + y2) / 2 - 8})`}>
                      <rect width="76" height="14" rx="3" fill="#FF694A" />
                      <text x="38" y="10" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#fff" letterSpacing="0.4">
                        {e.tests[0]}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Bronze nodes */}
            {lin.bronze.map((t, i) => (
              <g key={t} transform={`translate(${BX}, ${bronzeY(i)})`}>
                <rect width={COL_W} height={ROW_H} rx="4" fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
                <text x="12" y="14" fontSize="9" fontWeight="800" fill="#826b3f" letterSpacing="1.4">BRONZE</text>
                <text x="12" y="28" fontSize="11" fontWeight="700" fill="#0b1220" fontFamily="ui-monospace, monospace">{t}</text>
              </g>
            ))}

            {/* Silver nodes */}
            {lin.silver.map((t, i) => (
              <g key={t} transform={`translate(${MX}, ${silverY(i)})`}>
                <rect width={COL_W} height={ROW_H} rx="4" fill="#f3f4f6" stroke="#6b7280" strokeWidth="1" />
                <text x="12" y="14" fontSize="9" fontWeight="800" fill="#374151" letterSpacing="1.4">SILVER</text>
                <text x="12" y="28" fontSize="11" fontWeight="700" fill="#0b1220" fontFamily="ui-monospace, monospace">{t}</text>
              </g>
            ))}

            {/* Gold node (selected) */}
            <g transform={`translate(${RX}, ${goldY})`}>
              <rect width={COL_W} height={ROW_H} rx="4" fill="#faf3e1" stroke="#b8975c" strokeWidth="2" filter="url(#alive-glow)" />
              <text x="12" y="14" fontSize="9" fontWeight="800" fill="#7a5e2d" letterSpacing="1.4">GOLD</text>
              <text x="12" y="28" fontSize="11" fontWeight="700" fill="#0b1220" fontFamily="ui-monospace, monospace">{selected}</text>
            </g>
          </svg>
        </div>

        <div className="mt-4 flex items-center gap-4 text-[11px] text-[var(--ink-soft)] flex-wrap">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: '#FF694A' }} /> dbt transformation (auto-emitted)</span>
          <span>•</span>
          <span><strong className="text-[var(--ink-strong)]">{lin.edges.length}</strong> column-level edges traced</span>
          <span>•</span>
          <span><strong className="text-[var(--ink-strong)]">{lin.bronze.length + lin.silver.length + 1}</strong> dbt models in the lineage graph</span>
          <span>•</span>
          <span>Lineage runs at every build · zero manual upkeep</span>
        </div>
      </div>
    </section>
  );
}
