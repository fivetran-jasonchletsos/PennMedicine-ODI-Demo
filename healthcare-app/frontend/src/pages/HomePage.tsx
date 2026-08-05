import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, formatCurrency, formatNumber } from '../api/queries';
import type { SummaryStats, PatientSearchResult } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [recent, setRecent] = useState<PatientSearchResult[]>([]);

  useEffect(() => {
    api.getSummary().then(setStats).catch(() => {});
    api
      .searchPatients({ limit: 6 })
      .then((r) => setRecent(r.results.slice(0, 6)))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* SPLIT-SCREEN HERO — two parallel tracks, side by side.
          Left: Evidence Grade (the dashboard you'd hand a CMO today)
          Right: dbt Wizard (the AI build you'd hand them tomorrow) */}
      <section className="bg-white border-b border-[var(--hairline)] fade-in-up" style={{ animationDelay: '0ms' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">

            {/* ━━━━━━━━ LEFT: EVIDENCE GRADE ━━━━━━━━ */}
            <div className="flex flex-col rounded-lg border border-[var(--hairline)] bg-white overflow-hidden">
              <div className="px-6 pt-6 pb-2 border-b border-[var(--hairline-soft)] flex items-center gap-3">
                <span
                  className="status-pill healthy inline-flex items-center gap-1.5"
                  style={{ fontSize: 11, padding: '3px 9px', fontWeight: 700 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--clinical-green)] animate-pulse" />
                  Clinical Dashboard · live
                </span>
                <span className="eyebrow" style={{ color: 'var(--color-brand-700)' }}>Track A</span>
              </div>

              <div className="px-6 pt-5 pb-6 flex-1 flex flex-col">
                <div className="eyebrow mb-2">Clarity Health</div>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold leading-[1.05] text-[var(--ink-strong)] tracking-tight">
                  Evidence-grade insight,<br className="hidden sm:block" /> from chart to cohort.
                </h2>
                <p className="mt-4 text-[15px] text-[var(--ink-muted)] leading-relaxed">
                  A reference clinical-analytics workspace built on EHR-shaped data.
                  Patient records, encounter histories, diagnoses, financials, and
                  population-level signals — modeled, governed, and presented for the
                  people who deliver care.
                </p>

                {/* Population snapshot — compact KPI strip */}
                <div className="mt-6 rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] overflow-hidden">
                  <div className="px-4 py-2 border-b border-[var(--hairline-soft)] flex items-center justify-between bg-white">
                    <div className="eyebrow">Population Snapshot</div>
                    <div className="text-[10px] font-medium text-[var(--ink-soft)] uppercase tracking-wider">Snowflake marts</div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-[var(--hairline-soft)] tabular bg-white">
                    <Vital label="Active panel" value={stats ? formatNumber(stats.total_patients) : '—'} hint="Patients with current data" />
                    <Vital
                      label="Avg visits / patient"
                      value={stats ? (stats.total_encounters / stats.total_patients).toFixed(1) : '—'}
                      hint={stats ? `${formatNumber(stats.total_encounters)} encounters` : 'Utilization intensity'}
                    />
                    <Vital label="Avg charge / encounter" value={stats ? formatCurrency(stats.avg_encounter_cost) : '—'} hint="Revenue per case" />
                    <Vital
                      label="Chronic dx coverage"
                      value={stats ? `${((stats.active_chronic_count / stats.total_patients) * 100).toFixed(0)}%` : '—'}
                      hint={stats ? `${formatNumber(stats.active_chronic_count)} patients · ≥1 chronic dx` : ''}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => navigate('/executive')}
                    className="inline-flex items-center gap-2 rounded-md text-white font-semibold px-5 py-2.5 shadow-sm hover:opacity-95 transition-opacity"
                    style={{ background: 'var(--color-brand-700)' }}
                  >
                    Executive Cockpit <span aria-hidden>→</span>
                  </button>
                  <button
                    onClick={() => navigate('/patients')}
                    className="inline-flex items-center gap-2 rounded-md bg-white border border-[var(--hairline)] text-[var(--ink-strong)] font-semibold px-4 py-2.5 hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    Patient registry
                  </button>
                  <button
                    onClick={() => navigate('/agent')}
                    className="inline-flex items-center gap-2 rounded-md bg-white border border-[var(--hairline)] text-[var(--ink-strong)] font-semibold px-4 py-2.5 hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    Clinical Insights
                  </button>
                </div>
              </div>
            </div>

            {/* ━━━━━━━━ RIGHT: dbt WIZARD ━━━━━━━━ */}
            <div className="flex flex-col rounded-lg border border-[var(--hairline)] bg-white overflow-hidden">
              <div className="px-6 pt-6 pb-2 border-b border-[var(--hairline-soft)] flex items-center gap-3">
                <span
                  className="status-pill healthy inline-flex items-center gap-1.5"
                  style={{ fontSize: 11, padding: '3px 9px', fontWeight: 700 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--clinical-teal)] animate-pulse" />
                  dbt Wizard · live build
                </span>
                <span className="eyebrow" style={{ color: 'var(--clinical-teal)' }}>Track B</span>
                <span className="eyebrow ml-auto">BLD-2026-05-22-0007</span>
              </div>

              <div className="px-6 pt-5 pb-6 flex-1 flex flex-col">
                <div className="eyebrow mb-2" style={{ color: 'var(--clinical-teal)' }}>Agentic data engineering</div>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold leading-[1.05] text-[var(--ink-strong)] tracking-tight">
                  Ask a question.{' '}
                  <span style={{ color: 'var(--clinical-teal)' }}>Watch the model get built.</span>
                </h2>
                <p className="mt-4 text-[15px] text-[var(--ink-muted)] leading-relaxed">
                  The CMO asks why sepsis bundle-compliance dipped for cardiology.
                  No gold table exists. The Quality Committee meets in 14 hours.
                  Manual build: 3 to 5 days. dbt Wizard: <strong className="text-[var(--ink-strong)]">87 seconds</strong>.
                </p>

                {/* 4-step demo flow — compact */}
                <div className="mt-6 grid grid-cols-2 gap-2.5">
                  {DEMO_FLOW.map((tile) => (
                    <div
                      key={tile.step}
                      className="rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] p-3"
                      style={{ borderLeft: `3px solid ${tile.color}` }}
                    >
                      <div className="font-mono text-[9.5px] uppercase tracking-wider mb-1" style={{ color: tile.color }}>
                        {tile.step}
                      </div>
                      <div className="font-serif font-semibold text-[var(--ink-strong)] text-[13px] mb-1 leading-tight">
                        {tile.title}
                      </div>
                      <p className="text-[11px] text-[var(--ink-muted)] leading-snug">{tile.body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6 flex flex-wrap gap-2.5">
                  <Link
                    to="/scenario"
                    className="inline-flex items-center gap-2 rounded-md text-white font-semibold px-5 py-2.5 shadow-sm hover:opacity-95 transition-opacity"
                    style={{ background: 'var(--clinical-teal)' }}
                  >
                    Start the demo
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    to="/wizard-live"
                    className="inline-flex items-center gap-2 rounded-md bg-white border border-[var(--hairline)] text-[var(--ink-strong)] font-semibold px-4 py-2.5 hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    Jump to live build
                  </Link>
                  <Link
                    to="/outcome"
                    className="inline-flex items-center gap-2 rounded-md bg-white border border-[var(--hairline)] text-[var(--ink-strong)] font-semibold px-4 py-2.5 hover:bg-[var(--paper-deep)] transition-colors"
                  >
                    See the outcome
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Left: action tiles (Find + Ask, stacked) · Right: six-step build as 2×3 */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8 fade-in-up" style={{ animationDelay: '80ms' }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* LEFT: stacked action tiles */}
          <div className="flex flex-col gap-5">
            <FindPatientTile onGo={(q) => navigate(q ? `/patients?q=${encodeURIComponent(q)}` : '/patients')} />
            <InsightAgentTile
              onAsk={(q) => navigate(`/agent?q=${encodeURIComponent(q)}`)}
              onOpen={() => navigate('/agent')}
              onAbout={() => navigate('/about-agent')}
            />
          </div>

          {/* RIGHT: six-step build, 2 rows × 3 cols */}
          <div>
            <div className="eyebrow mb-2">The six-step build</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold mb-6 text-[var(--ink-strong)]">
              Discover. Understand. Inspect. Author. Test. Materialize.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FLOW.map((step, i) => (
                <div key={step.title} className="rounded-lg border border-[var(--hairline)] bg-white p-4 relative" style={{ borderLeft: `3px solid ${step.color}` }}>
                  <div className="font-mono text-xs mb-2" style={{ color: step.color }}>
                    {String(i + 1).padStart(2, '0')} · {step.tag}
                  </div>
                  <div className="font-serif text-base font-semibold mb-2 text-[var(--ink-strong)]">{step.title}</div>
                  <p className="text-xs leading-relaxed text-[var(--ink-muted)]">{step.body}</p>
                  <div className="mt-3 font-mono text-[10px] text-[var(--ink-soft)]">{step.who}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent patient cohort */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-6 border-b border-[var(--hairline)] pb-4">
          <div>
            <div className="eyebrow mb-1">Cohort Browser</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--ink-strong)]">Recent patient encounters</h2>
            <p className="text-sm text-[var(--ink-muted)] mt-1">A representative slice of the panel as it lands in the marts layer.</p>
          </div>
          <button onClick={() => navigate('/patients')} className="text-sm font-semibold text-[var(--clinical-teal)] hover:text-[var(--ink-strong)] whitespace-nowrap">
            View all patients →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recent.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-[var(--hairline)] bg-white p-5 animate-pulse h-36" />
              ))
            : recent.map((p) => <PatientCard key={p.pat_id} p={p} onClick={() => navigate(`/patients/${encodeURIComponent(p.pat_id)}`)} />)}
        </div>
      </section>

      {/* Data pipeline — institutional treatment */}
      <section className="bg-white border-t border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="eyebrow mb-2">Provenance</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--ink-strong)]">
              Every figure traces to source.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed">
              Clinical and financial measures shown across this platform are derived from governed,
              version-controlled transformations against the EHR source database — no manual exports,
              no spreadsheet hand-offs.
            </p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { step: '01', name: 'Fivetran CDC', desc: 'Epic Clarity connector mirrors EHR tables from the Clarity reporting database in near real time.' },
              { step: '02', name: 'Iceberg (MDLS)', desc: 'Fivetran lands every CDC row into the Managed Data Lake on S3 in open Apache Iceberg format — one copy, one source of truth.' },
              { step: '03', name: 'Snowflake / Athena / Trino', desc: 'All three engines read the same Iceberg bytes — pick the right compute per workload, no data duplication, no extracts.' },
              { step: '04', name: 'dbt Labs transforms', desc: 'Fivetran Transformations triggers the dbt job the moment Epic Clarity finishes syncing. Bronze → Silver → Gold, 21 tested models.' },
              { step: '05', name: 'React + Recharts', desc: 'Static SPA reads daily JSON exports of the gold marts; no PHI ever touches the browser.' },
            ].map((s) => (
              <li key={s.name} className="relative rounded-lg border border-[var(--hairline)] bg-white p-5 hover:border-[var(--clinical-teal)] transition-colors">
                <div className="text-[10px] font-mono font-semibold text-[var(--clinical-teal)] tracking-wider">{s.step}</div>
                <div className="mt-1 font-serif text-lg font-semibold text-[var(--ink-strong)]">{s.name}</div>
                <p className="mt-2 text-sm text-[var(--ink-muted)] leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Care delivery promise — academic medicine closing note */}
      <section className="bg-[var(--paper-deep)] border-t border-[var(--hairline)]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 text-center">
          <div className="eyebrow mb-3">Design Principles</div>
          <p className="font-serif text-xl sm:text-2xl text-[var(--ink-strong)] leading-relaxed">
            "Make the right thing easy. Make the wrong thing visible. Show your work."
          </p>
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Clinical analytics should be auditable end-to-end. Every chart on this site is one click from the source query.
          </p>
        </div>
      </section>
    </>
  );
}

const DEMO_FLOW = [
  { step: '01 · Scenario', title: 'The CMO asks', body: 'Sepsis bundle-compliance dip in Cardiology. No gold model. Quality Committee in 14 hours.', color: 'var(--clinical-amber)' },
  { step: '02 · Live Build', title: 'Four agents build', body: 'Explorer, Summary, Worker, Verification author the model in 87 seconds on screen.', color: 'var(--clinical-teal)' },
  { step: '03 · Outcome', title: 'Root cause found', body: 'Lactate redraw auto-fire suppressed at shift change. 11 of 14 fallouts share the signature.', color: 'var(--clinical-green)' },
  { step: '04 · Impact', title: '14 hours early', body: 'Committee gets the answer before they meet. NHSN submission goes out clean.', color: 'var(--clinical-violet)' },
];

const FLOW = [
  { tag: 'DISCOVERY',       title: 'Find the signals',   body: 'Explorer runs status and search. Returns gold.fct_encounter, fct_vital, fct_order, dim_patient.', who: 'Explorer · status, search', color: 'var(--clinical-teal)' },
  { tag: 'SCHEMA',          title: 'Confirm the grain',  body: 'Summary runs describe and lineage. Names the gap and the new grain the gold table has to land on.', who: 'Summary · describe, lineage', color: 'var(--clinical-violet)' },
  { tag: 'INSPECTION',      title: 'Validate the slice', body: 'Worker runs dbt_show on a 7-day slice. Confirms the compliance signal aggregates cleanly.', who: 'Worker · warehouse, dbt_show', color: '#be185d' },
  { tag: 'MODEL CREATION',  title: 'Author the SQL',     body: 'Worker writes fct_sepsis_bundle_by_service_line_daily.sql — header, CTEs, joins, and final SELECT.', who: 'Worker · file edits, model generation', color: '#be185d' },
  { tag: 'TEST AUTHORING',  title: 'Lock the contract',  body: 'Verification writes YAML — schema contract, ownership, 6 column tests, 1 combination test.', who: 'Verification · describe, dbt_show', color: 'var(--clinical-green)' },
  { tag: 'MATERIALIZATION', title: 'Land on Iceberg',    body: 'Worker materializes the table. Verification confirms lineage updated and downstream consumers see it.', who: 'Worker + Verification', color: 'var(--clinical-green)' },
];

function Vital({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-[0.1em]">{label}</div>
      <div className="mt-1.5 font-serif text-[28px] font-semibold text-[var(--ink-strong)] leading-none tabular">{value}</div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-soft)] tabular truncate">{hint}</div>
    </div>
  );
}

function PatientCard({ p, onClick }: { p: PatientSearchResult; onClick: () => void }) {
  const burden = p.active_chronic_count;
  const burdenTone =
    burden >= 3 ? { cls: 'alert', label: 'High burden' } : burden >= 1 ? { cls: 'caution', label: `${burden} chronic` } : { cls: 'healthy', label: 'Stable' };
  return (
    <button
      onClick={onClick}
      className="text-left clinical-card clinical-card-lift group"
    >
      <div className="px-5 pt-4 pb-3 border-b border-[var(--hairline-soft)] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-mono text-[var(--ink-soft)] tracking-tight">MRN {p.med_rec_num}</div>
          <div className="mt-1 font-serif font-semibold text-[var(--ink-strong)] truncate group-hover:underline underline-offset-2">
            {p.full_name}
          </div>
        </div>
        <span className={`status-pill ${burdenTone.cls}`}>{burdenTone.label}</span>
      </div>
      <div className="px-5 py-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">Age · Sex</div>
          <div className="mt-0.5 font-semibold text-[var(--ink-strong)] tabular">{p.age} · {p.sex}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">Visits</div>
          <div className="mt-0.5 font-semibold text-[var(--ink-strong)] tabular">{p.encounter_count}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">City</div>
          <div className="mt-0.5 font-semibold text-[var(--ink-strong)] truncate">{p.city ?? '—'}</div>
        </div>
      </div>
      <div className="px-5 pb-4 text-[11px] text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink-muted)]">PCP:</span> {p.primary_care_provider ?? '—'}
      </div>
    </button>
  );
}

function FindPatientTile({ onGo }: { onGo: (q: string) => void }) {
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onGo(q.trim());
  };
  const samples = ['Smith', 'MRN 100042', '15217', 'Pittsburgh', 'Diabetes'];
  return (
    <div className="clinical-card overflow-hidden">
      <div className="clinical-card-header flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Patient Lookup</div>
          <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">Find a patient record</h3>
        </div>
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-[var(--clinical-teal-bg)] text-[var(--clinical-teal)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm text-[var(--ink-muted)] mb-4">
          Search by name, MRN, ZIP code, or city. Returns encounter history, diagnoses, account balance, and
          care-team comparables.
        </p>
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="John Smith · MRN 100042 · 15217"
            className="flex-1 min-w-0 rounded-md border border-[var(--hairline)] bg-white px-4 py-2.5 text-sm focus:border-[var(--clinical-teal)] focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-md text-white px-5 py-2.5 text-sm font-semibold whitespace-nowrap"
            style={{ background: 'var(--color-brand-700)' }}
          >
            Search <span aria-hidden>→</span>
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-[var(--ink-soft)] self-center mr-1">Try:</span>
          {samples.map((s) => (
            <button
              key={s}
              onClick={() => onGo(s)}
              className="text-xs rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] hover:bg-white hover:border-[var(--clinical-teal)] text-[var(--ink-muted)] hover:text-[var(--ink-strong)] px-2.5 py-1 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightAgentTile({ onAsk, onOpen, onAbout }: { onAsk: (q: string) => void; onOpen: () => void; onAbout: () => void }) {
  const samples = [
    'Top diagnoses by encounter count',
    'Patients with 3+ chronic conditions',
    'Average length of stay by department',
    'Outstanding balances over $5K',
  ];
  return (
    <div className="clinical-card overflow-hidden">
      <div className="clinical-card-header flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow" style={{ color: 'var(--clinical-violet)' }}>Clinical Insights</div>
          <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">Ask in plain English</h3>
        </div>
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-[var(--clinical-violet-bg)] text-[var(--clinical-violet)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            <path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M5.6 18.4l2.1-2.1M12 21v-3M18.4 18.4l-2.1-2.1M21 12h-3M18.4 5.6l-2.1 2.1" />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm text-[var(--ink-muted)] mb-4">
          Skip the BI tool — type a question against the snapshot and get a table or chart back.
          Runs locally over the marts, or routes to Claude for richer reasoning.
        </p>
        <div className="space-y-1.5 mb-4">
          {samples.map((s) => (
            <button
              key={s}
              onClick={() => onAsk(s)}
              className="w-full text-left text-sm rounded-md border border-[var(--hairline)] bg-white hover:border-[var(--clinical-violet)] hover:bg-[var(--clinical-violet-bg)] px-3 py-2 transition-colors flex items-center justify-between gap-3 group"
            >
              <span className="text-[var(--ink)]">{s}</span>
              <span aria-hidden className="text-[var(--ink-soft)] group-hover:text-[var(--clinical-violet)] group-hover:translate-x-0.5 transition-all">→</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 rounded-md text-white px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--clinical-violet)' }}
          >
            Open the agent <span aria-hidden>→</span>
          </button>
          <button onClick={onAbout} className="text-sm font-medium text-[var(--ink-muted)] hover:text-[var(--ink-strong)] underline-offset-4 hover:underline">
            How it works
          </button>
        </div>
      </div>
    </div>
  );
}
