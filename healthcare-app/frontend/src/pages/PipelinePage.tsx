// Pipeline — the booth's "how it works" moment.
//
// Replaces the earlier 4-card failure-toggle demo with a Mission-Control style
// observability surface: animated data-flow diagram, KPI strip, connector
// health table with sparklines, dbt model grid, and Snowflake-native callouts
// (Time Travel, zero-copy clones, dbt-wizard). Every minute of pipeline lag is
// framed as denied-claim risk and ED throughput drag — ties the data
// infrastructure to the CEO P&L on the Executive page.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkline } from '../components/Sparkline';
import { DataFlowDiagram, KpiTile, AnimatedCounter, type FlowNode } from '../components/Executive';

// Real Fivetran connector wired to fortitude_fawn (jason_chletsos_mdls_s3).
// Schema: jason_chletsos_epic_clarity, service: epic_clarity, status: connected.
// Deep-link pattern: https://fivetran.com/dashboard/connections/{id}/status
const FIVETRAN_CONNECTOR_ID = 'sanctity_finally';
const FIVETRAN_SCHEMA_NAME  = 'jason_chletsos_epic_clarity';
const FIVETRAN_CONNECTOR_URL = `https://fivetran.com/dashboard/connections/${FIVETRAN_CONNECTOR_ID}/status`;
const FIVETRAN_DASHBOARD_URL = 'https://fivetran.com/dashboard/connections';

interface Connector {
  table: string;
  schema: string;
  rowsCdc: number;
  lagSec: number;
  status: 'healthy' | 'caution' | 'alert';
  lastSyncMin: number;
  throughput: number[];
  fivetranId: string;
}

const CONNECTORS: Connector[] = [
  { table: 'PATIENT',        schema: 'ehr_demo', rowsCdc: 412,   lagSec: 32, status: 'healthy', lastSyncMin: 4, throughput: [22, 18, 26, 31, 28, 24, 30, 34, 29, 27, 33, 38],               fivetranId: 'sanctity_finally' },
  { table: 'PAT_ENC',        schema: 'ehr_demo', rowsCdc: 8214,  lagSec: 41, status: 'healthy', lastSyncMin: 4, throughput: [380, 420, 460, 510, 540, 560, 510, 480, 530, 560, 590, 610],   fivetranId: 'sanctity_finally' },
  { table: 'PAT_ENC_DX',     schema: 'ehr_demo', rowsCdc: 14288, lagSec: 48, status: 'healthy', lastSyncMin: 4, throughput: [620, 680, 710, 760, 820, 880, 840, 800, 860, 920, 980, 1040],  fivetranId: 'sanctity_finally' },
  { table: 'HSP_ACCOUNT',    schema: 'ehr_demo', rowsCdc: 6480,  lagSec: 39, status: 'healthy', lastSyncMin: 4, throughput: [240, 280, 310, 340, 360, 380, 360, 340, 380, 410, 440, 470],   fivetranId: 'sanctity_finally' },
  { table: 'HSP_TRANSACTION', schema: 'ehr_demo', rowsCdc: 22146, lagSec: 52, status: 'healthy', lastSyncMin: 4, throughput: [840, 920, 1010, 1080, 1140, 1200, 1180, 1160, 1220, 1280, 1340, 1410], fivetranId: 'sanctity_finally' },
  { table: 'MEDICATIONS',    schema: 'ehr_demo', rowsCdc: 3024,  lagSec: 36, status: 'healthy', lastSyncMin: 4, throughput: [110, 130, 150, 170, 180, 190, 200, 210, 220, 230, 240, 252],   fivetranId: 'sanctity_finally' },
  { table: 'PROVIDERS',      schema: 'ehr_demo', rowsCdc: 24,    lagSec: 18, status: 'healthy', lastSyncMin: 4, throughput: [1, 2, 1, 0, 3, 1, 2, 1, 2, 1, 0, 2],                           fivetranId: 'sanctity_finally' },
  { table: 'DEPARTMENTS',    schema: 'ehr_demo', rowsCdc: 6,     lagSec: 14, status: 'healthy', lastSyncMin: 4, throughput: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],                           fivetranId: 'sanctity_finally' },
];

const DBT_MODELS = [
  { layer: 'staging', name: 'stg_clarity__patient', rows: 14820, ms: 380, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__pat_enc', rows: 184220, ms: 1240, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__pat_enc_dx', rows: 412380, ms: 1860, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__hsp_account', rows: 184220, ms: 920, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__hsp_transaction', rows: 814220, ms: 2240, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__medications', rows: 86420, ms: 720, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__providers', rows: 1820, ms: 180, status: 'pass' },
  { layer: 'staging', name: 'stg_clarity__departments', rows: 86, ms: 90, status: 'pass' },
  { layer: 'intermediate', name: 'int_patient_encounter_spine', rows: 184220, ms: 2840, status: 'pass' },
  { layer: 'intermediate', name: 'int_chronic_conditions', rows: 41280, ms: 1620, status: 'pass' },
  { layer: 'intermediate', name: 'int_encounter_diagnoses', rows: 412380, ms: 2410, status: 'pass' },
  { layer: 'intermediate', name: 'int_financials', rows: 814220, ms: 3120, status: 'pass' },
  { layer: 'mart',         name: 'dim_patients', rows: 14820, ms: 480, status: 'pass' },
  { layer: 'mart',         name: 'dim_providers', rows: 1820, ms: 210, status: 'pass' },
  { layer: 'mart',         name: 'dim_departments', rows: 86, ms: 110, status: 'pass' },
  { layer: 'mart',         name: 'fct_encounters', rows: 184220, ms: 1840, status: 'pass' },
  { layer: 'mart',         name: 'fct_diagnoses', rows: 412380, ms: 2380, status: 'pass' },
  { layer: 'mart',         name: 'fct_account_summary', rows: 184220, ms: 1620, status: 'pass' },
];

export default function PipelinePage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const flow: FlowNode[] = useMemo(
    () => [
      { id: 'epic', logo: 'epic', label: 'Clarity Health EHR', sub: 'Epic Clarity · CDC source', status: 'healthy', metric: '8 tables · 2.4M rows' },
      { id: 'fivetran', logo: 'fivetran', label: 'Fivetran', sub: 'Epic Clarity connector', status: 'healthy', metric: '5-min cadence · 99.7% SLA' },
      { id: 'iceberg', logo: 'iceberg', label: 'Iceberg (MDLS)', sub: 'Managed Data Lake Service · S3', status: 'healthy', metric: 'ACID · open · multi-engine' },
      { id: 'snowflake', logo: 'snowflake', label: 'Snowflake / Athena / Trino', sub: 'External Iceberg reads', status: 'healthy', metric: 'XS warehouse · auto-suspend' },
      { id: 'dbt', logo: 'dbt', label: 'dbt Labs transforms', sub: 'Triggered by Fivetran · Bronze → Silver → Gold · 21 models', status: 'healthy', metric: '24s avg · 0 failures' },
      { id: 'app', logo: 'app', label: 'Clarity App', sub: 'React · static JSON', status: 'healthy', metric: 'CDN · 12 min deploy' },
    ],
    [],
  );

  const totalRowsCdc = CONNECTORS.reduce((s, c) => s + c.rowsCdc, 0);
  const maxLag = Math.max(...CONNECTORS.map((c) => c.lagSec));
  const healthyCount = CONNECTORS.filter((c) => c.status === 'healthy').length;

  return (
    <>
      <section className="bg-white border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="eyebrow mb-2">Pipeline · Observability</div>
              <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight text-[var(--ink-strong)] tracking-tight">
                EHR → Iceberg → multi-engine, end-to-end
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-muted)] max-w-3xl leading-relaxed">
                Fivetran's Epic Clarity connector captures change-data from the EHR source and lands it in
                Iceberg (MDLS) every 5 minutes. Snowflake, Athena, and Trino all read the same bytes —
                no copies. Fivetran Transformations then trigger dbt Labs the moment the Epic Clarity
                sync finishes, building bronze (staging), silver (intermediate), and gold (clinical +
                financial marts) layers that power the Executive Cockpit, patient registry, and
                population health surfaces. Every minute of lag has a P&L cost — see <Link to="/executive" className="underline text-[var(--clinical-teal)]">Executive</Link>.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <a
                  href={FIVETRAN_CONNECTOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hairline)] bg-white px-2.5 py-1 font-semibold text-[var(--ink-strong)] hover:border-[var(--clinical-teal)] transition-colors"
                >
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold text-white" style={{ background: '#0073FF' }}>F</span>
                  Open Fivetran connector
                </a>
                <a
                  href="https://fivetran.com/dashboard/transformations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hairline)] bg-white px-2.5 py-1 font-semibold text-[var(--ink-strong)] hover:border-[var(--clinical-teal)] transition-colors"
                >
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold text-white" style={{ background: '#0073FF' }}>F</span>
                  Fivetran Transformations
                </a>
                <a
                  href="https://github.com/fivetran-jasonchletsos/Healthcare-EPIC-Snowflake-Demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hairline)] bg-white px-2.5 py-1 font-semibold text-[var(--ink-strong)] hover:border-[var(--clinical-teal)] transition-colors"
                >
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold text-white" style={{ background: '#FF694A' }}>d</span>
                  Open dbt project (GitHub)
                </a>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono tabular text-[var(--ink-soft)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--clinical-green)] animate-pulse" />
              All systems operational · refreshed {(tick * 4) % 60}s ago
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero data-flow */}
        <DataFlowDiagram nodes={flow} />

        {/* KPI strip — pipeline health framed in business terms */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="End-to-end freshness"
              value={<AnimatedCounter to={4.2} format={(n) => `${n.toFixed(1)} min`} />}
              delta={{ value: '99.7% SLA', trend: 'good', vs: 'rolling 30d' }}
              spark={[7.2, 6.8, 6.4, 6.1, 5.8, 5.4, 5.1, 4.9, 4.6, 4.4, 4.3, 4.2]}
              dollarLever="Sub-5-min replication is the operational floor for real-time denial recovery and ED throughput."
              badge="Fivetran CDC"
              badgeTone="info"
              highlight
            />
            <KpiTile
              label="Rows replicated · 24h"
              value="2.42M"
              delta={{ value: '+ 4.1%', trend: 'good', vs: 'vs prior day' }}
              spark={[1.9, 2.0, 2.1, 2.05, 2.15, 2.25, 2.20, 2.18, 2.30, 2.32, 2.38, 2.42]}
              dollarLever="CDC incremental sync transfers only changed rows — ~98% bandwidth savings vs full re-sync."
            />
            <KpiTile
              label="Snowflake compute · 7d"
              value="$1,120"
              subValue="XS warehouse · auto-suspend"
              delta={{ value: '− 96%', trend: 'good', vs: 'vs legacy DW' }}
              spark={[2150, 1980, 1820, 1640, 1500, 1380, 1290, 1220, 1180, 1150, 1130, 1120]}
              dollarLever="Auto-suspend + zero-copy clones eliminate idle spend. Legacy on-prem warehouse: $1.6M/yr fixed."
              badge="Snowflake"
              badgeTone="info"
            />
            <KpiTile
              label="dbt Labs incremental build"
              value="24s"
              subValue="21 models · 0 failures"
              delta={{ value: '21 / 21', trend: 'good', vs: 'tests passing' }}
              spark={[42, 38, 36, 34, 32, 30, 28, 27, 26, 25, 24, 24]}
              dollarLever="Tests catch broken denial logic, double-counted revenue, and orphan patient IDs before they reach the CEO dashboard."
            />
          </div>
        </section>

        {/* Connector health table */}
        <section className="clinical-card overflow-hidden">
          <div className="clinical-card-header flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="eyebrow">Connector Health · last 24h</div>
              <div className="mt-0.5 font-serif text-lg font-semibold text-[var(--ink-strong)]">
                8 EHR source tables · CDC streaming
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
                <span className="connector-id-chip" title={`Fivetran connection ID: ${FIVETRAN_CONNECTOR_ID}`}>{FIVETRAN_SCHEMA_NAME}</span>
                <a
                  href={FIVETRAN_CONNECTOR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fivetran-cta"
                >
                  <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2 7h10M7 2l5 5-5 5" />
                  </svg>
                  Open in Fivetran
                </a>
              </div>
            </div>
            <div className="text-right text-[11px] tabular text-[var(--ink-soft)]">
              <div>
                <span className="text-[var(--clinical-green)] font-semibold">{healthyCount}</span>
                <span> healthy</span>
                <span className="mx-1">·</span>
                <span className="text-[var(--ink-strong)] font-semibold tabular">{(totalRowsCdc).toLocaleString()}</span>
                <span> rows synced</span>
              </div>
              <div className="text-[10px]">Max lag {maxLag}s · all under 60s SLA</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] bg-[var(--paper-deep)] border-b border-[var(--hairline-soft)]">
                <tr>
                  <th className="text-left font-semibold px-5 py-2.5">Source table</th>
                  <th className="text-left font-semibold px-3 py-2.5">Connector ID</th>
                  <th className="text-right font-semibold px-3 py-2.5">Rows · 24h CDC</th>
                  <th className="text-left font-semibold px-3 py-2.5">Throughput</th>
                  <th className="text-right font-semibold px-3 py-2.5">Lag</th>
                  <th className="text-right font-semibold px-3 py-2.5">Last sync</th>
                  <th className="text-right font-semibold px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline-soft)] tabular">
                {CONNECTORS.map((c) => (
                  <tr key={c.table} className="hover:bg-[var(--paper-deep)] transition-colors">
                    <td className="px-5 py-2.5">
                      <div className="font-mono text-[12px] text-[var(--ink-strong)] font-semibold">{c.table}</div>
                      <div className="text-[10px] text-[var(--ink-soft)] tracking-wider uppercase">{c.schema}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <a
                        href={`https://fivetran.com/dashboard/connections/${c.fivetranId}/status`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="connector-id-chip hover:underline"
                        title={`Open Fivetran connection ${c.fivetranId}`}
                      >
                        {FIVETRAN_SCHEMA_NAME}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{c.rowsCdc.toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <Sparkline values={c.throughput} width={100} height={22} stroke="var(--clinical-teal)" fill="var(--clinical-teal)" />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{c.lagSec}s</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[var(--ink-soft)]">{c.lastSyncMin}m ago</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`status-pill ${c.status}`}>{c.status === 'healthy' ? 'live' : c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Snowflake-native callouts — the tight-integration story */}
        <section>
          <div className="mb-4">
            <div className="eyebrow mb-1">Snowflake · why this is different</div>
            <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)]">
              Capabilities that don't exist on a legacy data warehouse
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SnowCard
              tag="Zero-Copy Clone"
              title="Instant dev/test environments"
              body="Clone JASON_CHLETSOS_EPIC in < 1 second with no storage duplication. Analysts test new denial logic against full production data without copying a single byte."
              metric="< 1 s"
              metricLabel="clone time"
            />
            <SnowCard
              tag="Time Travel"
              title="Recover anything, point-in-time"
              body="Query any mart as-of any timestamp inside the retention window (up to 90 days on Enterprise). Restore a dropped table, audit how a CMI calc has drifted, or reconcile a closed period with one SQL clause."
              metric="≤ 90 d"
              metricLabel="retention window"
            />
            <SnowCard
              tag="dbt-wizard"
              title="Missing gold models authored on demand"
              body="When a clinical question has no gold model to answer it, dbt-wizard's four sub-agents author, test, and materialize one in under two minutes — against the same Snowflake account."
              metric="under 2 min"
              metricLabel="model authoring"
            />
            <SnowCard
              tag="Auto-Suspend"
              title="Pay only for query seconds"
              body="The XS transform warehouse runs ~1.4 min per Fivetran load and then suspends. Annualized Snowflake compute under $60K vs $1.6M/yr fixed on the prior on-prem warehouse — a 96% cost reduction."
              metric="96%"
              metricLabel="compute saved"
            />
          </div>
        </section>

        {/* dbt model grid */}
        <section className="clinical-card overflow-hidden">
          <div className="clinical-card-header flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="eyebrow flex items-center gap-2">
                <span>dbt Labs build · last run</span>
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white leading-none"
                  style={{ background: '#FF694A' }}
                >
                  dbt labs
                </span>
              </div>
              <div className="mt-0.5 font-serif text-lg font-semibold text-[var(--ink-strong)]">
                21 models · staging (bronze) → intermediate (silver) → marts (gold)
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] tabular text-[var(--ink-soft)]">
              <span><span className="font-semibold text-[var(--clinical-green)]">100%</span> tests passing</span>
              <span><span className="font-semibold text-[var(--ink-strong)]">24s</span> total runtime</span>
              <span><span className="font-semibold text-[var(--ink-strong)]">{DBT_MODELS.reduce((s, m) => s + m.rows, 0).toLocaleString()}</span> rows built</span>
            </div>
          </div>
          {/* Layer-transition strip — labels the bronze→silver and silver→gold
              transformation edges with the dbt Labs wordmark. */}
          <div className="hidden md:grid grid-cols-3 gap-4 px-4 pt-3 -mb-1">
            <div className="flex items-center justify-end">
              <div className="relative flex items-center pr-1">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mr-2">
                  bronze → silver
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white leading-none shadow-sm"
                  style={{ background: '#FF694A', border: '1px solid #FF694A' }}
                >
                  dbt labs
                </span>
                <svg className="ml-1" width="18" height="10" viewBox="0 0 18 10">
                  <line x1="0" y1="5" x2="14" y2="5" stroke="#FF694A" strokeWidth="1.5" />
                  <polygon points="14,2 18,5 14,8" fill="#FF694A" />
                </svg>
              </div>
            </div>
            <div className="flex items-center justify-end">
              <div className="relative flex items-center pr-1">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mr-2">
                  silver → gold
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white leading-none shadow-sm"
                  style={{ background: '#FF694A', border: '1px solid #FF694A' }}
                >
                  dbt labs
                </span>
                <svg className="ml-1" width="18" height="10" viewBox="0 0 18 10">
                  <line x1="0" y1="5" x2="14" y2="5" stroke="#FF694A" strokeWidth="1.5" />
                  <polygon points="14,2 18,5 14,8" fill="#FF694A" />
                </svg>
              </div>
            </div>
            <div />
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['staging', 'intermediate', 'mart'] as const).map((layer) => {
              const models = DBT_MODELS.filter((m) => m.layer === layer);
              const tone = layer === 'staging' ? 'var(--clinical-teal)' : layer === 'intermediate' ? 'var(--clinical-violet)' : 'var(--color-brand-700)';
              const medallion = layer === 'staging' ? 'Bronze' : layer === 'intermediate' ? 'Silver' : 'Gold';
              return (
                <div key={layer} className="rounded-md border border-[var(--hairline)] bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: tone }}>
                      <span>{layer === 'mart' ? 'Marts (clinical + financial)' : layer}</span>
                      <span className="text-[9px] font-mono opacity-70">· {medallion}</span>
                    </div>
                    <div className="font-mono text-[11px] tabular text-[var(--ink-soft)]">{models.length} models</div>
                  </div>
                  <ul className="space-y-1">
                    {models.map((m) => (
                      <li key={m.name} className="flex items-center justify-between gap-3 text-[12px] py-1 border-b border-[var(--hairline-soft)] last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--clinical-green)' }} />
                          <span className="font-mono truncate text-[var(--ink-strong)]">{m.name}</span>
                        </div>
                        <div className="text-right tabular shrink-0">
                          <div className="font-mono text-[11px] text-[var(--ink-strong)]">{m.rows.toLocaleString()}</div>
                          <div className="font-mono text-[10px] text-[var(--ink-soft)]">{m.ms}ms</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Data Quality — powered by dbt Labs */}
        <section className="clinical-card overflow-hidden">
          <header className="p-5 border-b border-[var(--hairline-soft)] flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow" style={{ color: '#FF694A' }}>Data Quality · dbt Labs</div>
              <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
                Every encounter tested. Every run. Same warehouse.
              </h2>
              <p className="text-sm text-[var(--ink-muted)] mt-1">
                Tests defined in dbt Labs run on every build, against the same Snowflake tables every
                clinical dashboard and dbt-wizard-authored gold mart reads. Failures block promotion to the next layer —
                bad data never reaches denial-prevention workflows or ED capacity boards.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shrink-0" style={{ background: '#FF694A' }}>
              dbt Labs
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--hairline-soft)]">
            {[
              { layer: 'bronze (staging)',     tests: 26, passing: 26, monitors: ['freshness · Clarity CDC (≤ 5m)', 'volume · PAT_ENC nightly', 'schema drift · Epic release'], color: '#b45309' },
              { layer: 'silver (intermediate)', tests: 61, passing: 60, monitors: ['nulls · patient_id, encounter_id', 'uniqueness · hsp_account_id', 'referential · encounter→provider', 'accepted values · DRG, ICD-10'], color: '#0e7490' },
              { layer: 'gold (marts)',          tests: 42, passing: 42, monitors: ['business rules · denial defn', 'AR-day reconciliation', 'sum-to-source · HSP_TRANSACTION ledger'], color: '#047857' },
            ].map((q) => {
              const ok = q.passing === q.tests;
              return (
                <div key={q.layer} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">{q.layer}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ok ? 'var(--clinical-green)' : 'var(--clinical-rose)' }}>
                      {ok ? '● all passing' : `● ${q.tests - q.passing} failing`}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <div className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tabular">{q.passing}<span className="text-[var(--ink-soft)]">/{q.tests}</span></div>
                    <div className="text-xs text-[var(--ink-muted)]">tests · last run 4m ago</div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-[var(--ink-muted)]">
                    {q.monitors.map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: q.color }} />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-[var(--hairline-soft)] flex items-center justify-between text-[11px] text-[var(--ink-soft)] bg-[var(--paper-deep)]">
            <span className="font-mono">129 tests · 128 passing · 1 warn · 0 errors · HIPAA audited</span>
            <span className="uppercase tracking-wider font-semibold">dbt build · merged into Fivetran</span>
          </div>
        </section>

        {/* Lineage — source to consumer */}
        <section className="clinical-card overflow-hidden">
          <header className="p-5 border-b border-[var(--hairline-soft)]">
            <div className="eyebrow" style={{ color: '#FF694A' }}>Lineage · dbt Labs</div>
            <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)] mt-0.5">
              EHR source to gold mart. Audited at every hop.
            </h2>
            <p className="text-sm text-[var(--ink-muted)] mt-1">
              Column-level lineage from EHR source tables through every dbt transformation into
              every downstream consumer — Snowflake views, dbt-wizard-authored gold tables, clinical
              dashboards. PHI markers on every edge that touches patient identifiers.
            </p>
          </header>
          <div className="p-5 overflow-x-auto">
            <svg viewBox="0 0 980 220" className="w-full" style={{ minWidth: 820 }}>
              <defs>
                <marker id="lineageArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#64748b" />
                </marker>
                <marker id="piiArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#b45309" />
                </marker>
              </defs>

              {[
                { x: 10, y: 30,  label: 'Clarity Health · PATIENT', pii: true },
                { x: 10, y: 110, label: 'Clarity Health · PAT_ENC', pii: true },
              ].map((s, i) => (
                <g key={i}>
                  <rect x={s.x} y={s.y} width="180" height="56" rx="4" fill="#ffffff" stroke="#cbd5e1" />
                  <text x={s.x + 12} y={s.y + 18} fontSize="9" fontWeight="800" fill="#0e7490" letterSpacing="1.4">SOURCE</text>
                  <text x={s.x + 12} y={s.y + 36} fontSize="11" fontWeight="700" fill="#0b1220">{s.label}</text>
                  {s.pii && (
                    <g transform={`translate(${s.x + 130}, ${s.y + 8})`}>
                      <rect x="0" y="0" width="36" height="14" rx="2" fill="#fffbeb" stroke="#b45309" />
                      <text x="18" y="10" fontSize="8" fontWeight="800" fill="#b45309" textAnchor="middle" letterSpacing="0.5">PHI</text>
                    </g>
                  )}
                </g>
              ))}

              {[
                { y: 30,  label: 'stg_clarity__patient' },
                { y: 110, label: 'stg_clarity__pat_enc' },
              ].map((b, i) => (
                <g key={i}>
                  <rect x="220" y={b.y} width="160" height="56" rx="4" fill="#fffbeb" stroke="#b45309" />
                  <text x="300" y={b.y + 22} fontSize="9" fontWeight="800" fill="#826b3f" textAnchor="middle" letterSpacing="1.4">BRONZE · STAGING</text>
                  <text x="300" y={b.y + 40} fontSize="11" fontWeight="700" fill="#0b1220" textAnchor="middle">{b.label}</text>
                </g>
              ))}

              <g>
                <rect x="410" y="70" width="170" height="76" rx="4" fill="#ecfeff" stroke="#0e7490" />
                <text x="495" y="92" fontSize="9" fontWeight="800" fill="#0e7490" textAnchor="middle" letterSpacing="1.4">SILVER · INTERMEDIATE</text>
                <text x="495" y="112" fontSize="11" fontWeight="700" fill="#0b1220" textAnchor="middle">int_patient_encounter_spine</text>
                <text x="495" y="128" fontSize="9" fill="#0e7490" textAnchor="middle">de-identified · conformed</text>
              </g>

              <g>
                <rect x="610" y="70" width="170" height="76" rx="4" fill="#ecfdf5" stroke="#047857" />
                <text x="695" y="92" fontSize="9" fontWeight="800" fill="#047857" textAnchor="middle" letterSpacing="1.4">GOLD · MART</text>
                <text x="695" y="112" fontSize="11" fontWeight="700" fill="#0b1220" textAnchor="middle">fct_account_summary</text>
                <text x="695" y="128" fontSize="9" fill="#047857" textAnchor="middle">business-ready · semantic</text>
              </g>

              {[
                { y: 26,  label: 'Snowflake (BI)' },
                { y: 78,  label: 'dbt-wizard Gold Table' },
                { y: 130, label: 'Clarity App' },
                { y: 182, label: 'CMS denial report' },
              ].map((c, i) => (
                <g key={i}>
                  <rect x="810" y={c.y} width="160" height="36" rx="4" fill="#ffffff" stroke="#29B5E8" />
                  <text x="890" y={c.y + 22} fontSize="11" fontWeight="700" fill="#0b1220" textAnchor="middle">{c.label}</text>
                </g>
              ))}

              <line x1="190" y1="58" x2="220" y2="58" stroke="#b45309" strokeWidth="1.8" markerEnd="url(#piiArrow)" />
              <line x1="190" y1="138" x2="220" y2="138" stroke="#b45309" strokeWidth="1.8" markerEnd="url(#piiArrow)" />

              <line x1="380" y1="58" x2="410" y2="100" stroke="#FF694A" strokeWidth="2" markerEnd="url(#lineageArrow)" />
              <line x1="380" y1="138" x2="410" y2="115" stroke="#FF694A" strokeWidth="2" markerEnd="url(#lineageArrow)" />
              <g transform="translate(372, 80)">
                <rect x="0" y="0" width="44" height="13" rx="2" fill="#FF694A" />
                <text x="22" y="10" fontSize="8.5" fontWeight="800" fill="#ffffff" textAnchor="middle" letterSpacing="0.3">dbt labs</text>
              </g>

              <line x1="580" y1="108" x2="610" y2="108" stroke="#FF694A" strokeWidth="2" markerEnd="url(#lineageArrow)" />
              <g transform="translate(580, 96)">
                <rect x="0" y="0" width="44" height="13" rx="2" fill="#FF694A" />
                <text x="22" y="10" fontSize="8.5" fontWeight="800" fill="#ffffff" textAnchor="middle" letterSpacing="0.3">dbt labs</text>
              </g>

              {[44, 96, 148, 200].map((cy, i) => (
                <line key={i} x1="780" y1="108" x2="810" y2={cy} stroke="#b8975c" strokeWidth="1.5" markerEnd="url(#lineageArrow)" />
              ))}
            </svg>
          </div>
          <div className="px-5 py-3 border-t border-[var(--hairline-soft)] flex items-center justify-between text-[11px] text-[var(--ink-soft)] bg-[var(--paper-deep)]">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-3 h-0.5" style={{ background: '#b45309' }} /> PHI edge
              <span className="ml-3 inline-block w-3 h-0.5" style={{ background: '#FF694A' }} /> dbt Labs transformation
              <span className="ml-3 inline-block w-3 h-0.5" style={{ background: '#b8975c' }} /> Snowflake read
            </span>
            <span className="uppercase tracking-wider font-semibold font-mono">column-level · auto-emitted by dbt Labs</span>
          </div>
        </section>

        {/* Open in Fivetran — prominent CTA for the booth */}
        <section className="clinical-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">Fivetran · Connector</div>
            <div className="font-serif text-lg font-semibold text-[var(--ink-strong)]">Inspect this connector live</div>
            <p className="text-sm text-[var(--ink-muted)] mt-0.5">
              View sync history, schema changes, re-sync controls, and column-level observability in Fivetran.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--ink-soft)]">
              <span>Connector ID:</span>
              <span className="connector-id-chip">{FIVETRAN_CONNECTOR_ID}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={FIVETRAN_CONNECTOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="fivetran-cta text-sm py-2.5 px-5"
            >
              <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 7h10M7 2l5 5-5 5" />
              </svg>
              Open in Fivetran
            </a>
            <a
              href={FIVETRAN_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink-strong)] underline underline-offset-4"
            >
              All connectors →
            </a>
          </div>
        </section>

        {/* Business-impact bridge — the line every CEO will recognize */}
        <section className="rounded-lg border p-6 sm:p-8" style={{ borderColor: 'var(--clinical-teal)', background: 'linear-gradient(135deg, #ffffff 0%, var(--clinical-teal-bg) 160%)' }}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7">
              <div className="eyebrow mb-2">Why the pipeline is a CFO line-item</div>
              <h3 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] leading-tight">
                Data freshness <em>is</em> denial recovery.
              </h3>
              <p className="mt-3 text-sm text-[var(--ink-muted)] leading-relaxed max-w-2xl">
                Every minute EHR changes don't reach the marts, denial-prevention workflows
                miss timely-filing windows, ED capacity dashboards run on stale census, and CDM updates
                lag clinician documentation. A 4-minute Fivetran → Snowflake replication SLA isn't an
                infrastructure brag — it's the floor for real-time revenue cycle and capacity decisions.
              </p>
            </div>
            <div className="md:col-span-5 grid grid-cols-2 gap-3">
              <ImpactStat value="$8M" label="Per 1-pt denial reduction" />
              <ImpactStat value="$2.7M" label="Per 1-day AR reduction" />
              <ImpactStat value="$1.8M" label="Per 1-hr ED-board cut" />
              <ImpactStat value="$1.6M" label="Legacy DW retired · annual" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function SnowCard({
  tag, title, body, metric, metricLabel,
}: { tag: string; title: string; body: string; metric: string; metricLabel: string }) {
  return (
    <div className="clinical-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-bold text-white tracking-tight" style={{ background: '#29B5E8' }}>❄</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--clinical-teal)] font-semibold">{tag}</span>
      </div>
      <div className="font-serif text-base font-semibold text-[var(--ink-strong)] leading-snug">{title}</div>
      <p className="mt-2 text-[12px] text-[var(--ink-muted)] leading-relaxed flex-1">{body}</p>
      <div className="mt-4 pt-3 border-t border-[var(--hairline-soft)]">
        <div className="font-serif text-2xl font-semibold text-[var(--ink-strong)] tabular leading-none">{metric}</div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold mt-1">{metricLabel}</div>
      </div>
    </div>
  );
}

function ImpactStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-[var(--hairline)] bg-white p-3">
      <div className="font-serif text-2xl font-semibold text-[var(--clinical-green)] tabular leading-none">{value}</div>
      <div className="text-[11px] text-[var(--ink-muted)] mt-1.5 leading-snug">{label}</div>
    </div>
  );
}
