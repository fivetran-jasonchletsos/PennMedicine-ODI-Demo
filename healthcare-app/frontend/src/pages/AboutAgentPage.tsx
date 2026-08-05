import { useNavigate } from 'react-router-dom';

export default function AboutAgentPage() {
  const navigate = useNavigate();
  return (
    <>
      {/* Institutional hero — calm, serif, restrained */}
      <section className="bg-white border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="eyebrow mb-3" style={{ color: 'var(--clinical-violet)' }}>
              Clinical Insights · How it works
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-[1.05] text-[var(--ink-strong)] tracking-tight">
              A natural-language layer <br className="hidden sm:block" />over the governed marts.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[var(--ink-muted)] max-w-2xl leading-relaxed">
              The agent translates plain-English questions into deterministic queries against the same
              Snowflake-derived snapshot the rest of the platform reads. Two execution paths — a local
              rules engine — return tables, charts, and short
              narrative summaries.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/agent')}
                className="inline-flex items-center gap-2 rounded-md text-white font-semibold px-5 py-2.5 shadow-sm hover:opacity-95 transition-opacity"
                style={{ background: 'var(--clinical-violet)' }}
              >
                Open the agent <span aria-hidden>→</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-md bg-white border border-[var(--hairline)] text-[var(--ink-strong)] font-semibold px-5 py-2.5 hover:bg-[var(--paper-deep)] transition-colors"
              >
                Back to overview <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Request lifecycle — four-step flowchart with arrows */}
      <section className="bg-white border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <div className="eyebrow mb-2">Request Lifecycle</div>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--ink-strong)]">
              From question to grounded answer.
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed">
              Every request follows the same four-stage path. The router decides between a deterministic
              local rule path; both terminate in the same shape — a
              table, a chart, and a short summary.
            </p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {[
              {
                step: '01',
                name: 'Question',
                desc: 'Free-text input from the clinician or analyst. No prescribed grammar, no schema knowledge required.',
              },
              {
                step: '02',
                name: 'Intent classifier',
                desc: 'Lightweight router inspects the phrase and matches against the catalog of known clinical and financial intents.',
              },
              {
                step: '03',
                name: 'Local rule',
                desc: 'Recognized intents run as deterministic in-browser aggregations against the dbt-governed gold layer.',
              },
              {
                step: '04',
                name: 'Grounded result',
                desc: 'A table, an optional chart, and a short narrative summary — all derived from the published snapshot.',
              },
            ].map((s, idx, arr) => (
              <li key={s.name} className="relative">
                <div className="rounded-lg border border-[var(--hairline)] bg-white p-5 hover:border-[var(--clinical-violet)] transition-colors h-full">
                  <div className="text-[10px] font-mono font-semibold text-[var(--clinical-violet)] tracking-wider">{s.step}</div>
                  <div className="mt-1 font-serif text-lg font-semibold text-[var(--ink-strong)]">{s.name}</div>
                  <p className="mt-2 text-sm text-[var(--ink-muted)] leading-relaxed">{s.desc}</p>
                </div>
                {idx < arr.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden md:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-white border border-[var(--hairline)] text-[var(--ink-soft)] text-xs font-semibold"
                  >
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Two-mode explainer — local rules vs dbt-wizard */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-10">
          <div className="eyebrow mb-2">Execution Paths</div>
          <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--ink-strong)]">
            Two routes, one shape of answer.
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[var(--ink-muted)] leading-relaxed">
            The same question can be served by a local deterministic rule against the dbt-governed gold
            layer. The contract — table, chart, summary — does not change. When a required gold model
            does not yet exist, dbt-wizard authors it before the answer is returned.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="clinical-card overflow-hidden">
            <div className="clinical-card-header flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow" style={{ color: 'var(--clinical-teal)' }}>Local Rule</div>
                <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">
                  Deterministic in-browser aggregation
                </h3>
              </div>
              <span className="status-pill info">Local rule</span>
            </div>
            <div className="p-5 text-sm text-[var(--ink-muted)] leading-relaxed space-y-3">
              <p>
                Recognized intents — chronic-condition cohorts, charge ranking, ZIP filters, age bands,
                MRN and name lookups — resolve against a daily JSON export of the dbt-wizard-authored
                gold marts. No backend call, no API key, fully reproducible.
              </p>
              <p>
                Suited for routine clinical and operational questions where the aggregation is known
                and the answer must be auditable.
              </p>
            </div>
          </div>

          <div className="clinical-card overflow-hidden">
            <div className="clinical-card-header flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow" style={{ color: 'var(--clinical-violet)' }}>dbt-wizard</div>
                <h3 className="mt-1 font-serif text-xl font-semibold text-[var(--ink-strong)]">
                  Build-time AI over the governed lake
                </h3>
              </div>
              <span
                className="status-pill"
                style={{
                  background: 'var(--clinical-violet-bg)',
                  color: 'var(--clinical-violet)',
                  borderColor: 'var(--clinical-violet-bg)',
                }}
              >
                dbt-wizard
              </span>
            </div>
            <div className="p-5 text-sm text-[var(--ink-muted)] leading-relaxed space-y-3">
              <p>
                When no gold model covers the required grain, dbt-wizard's four sub-agents — Explorer,
                Summary, Worker, and Verification — author the missing model into the dbt project,
                tested and lineage-tracked, before returning a result.
              </p>
              <p>
                The output is a production dbt model that every downstream consumer — Snowflake views,
                clinical dashboards, population health surfaces — can read on its next pass.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Provenance note */}
      <section className="bg-[var(--paper-deep)] border-t border-[var(--hairline)]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="eyebrow mb-3">Provenance</div>
          <p className="font-serif text-xl sm:text-2xl text-[var(--ink-strong)] leading-relaxed">
            Every answer is a query against the published snapshot.
          </p>
          <p className="mt-3 text-sm text-[var(--ink-muted)] max-w-3xl">
            The snapshot is a daily export from{' '}
            <code className="font-mono text-[13px] bg-white border border-[var(--hairline)] px-1.5 py-0.5 rounded">
              JASON_CHLETSOS_EPIC.CLINICAL.*
            </code>{' '}
            and{' '}
            <code className="font-mono text-[13px] bg-white border border-[var(--hairline)] px-1.5 py-0.5 rounded">
              FINANCIAL.*
            </code>
            , produced by{' '}
            <code className="font-mono text-[13px] bg-white border border-[var(--hairline)] px-1.5 py-0.5 rounded">
              scripts/build_snapshot.py
            </code>
            . No PHI ever leaves Snowflake unmediated.
          </p>
        </div>
      </section>
    </>
  );
}
