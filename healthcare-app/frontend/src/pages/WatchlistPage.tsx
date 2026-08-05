import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCurrency, formatNumber } from '../api/queries';
import * as watchlist from '../watchlist';
import type { PatientSearchResult } from '../types';
import { AnimatedCounter, ProvenanceStrip } from '../components/Executive';

export default function WatchlistPage() {
  const [ids, setIds] = useState<string[]>([]);
  const [patients, setPatients] = useState<Record<string, PatientSearchResult>>({});

  useEffect(() => watchlist.subscribe(setIds), []);

  useEffect(() => {
    let cancelled = false;
    api.searchPatients({ limit: 200000 }).then((r) => {
      if (cancelled) return;
      const m: Record<string, PatientSearchResult> = {};
      for (const p of r.results) m[p.pat_id] = p;
      setPatients(m);
    });
    return () => { cancelled = true; };
  }, []);

  const items = ids.map((id) => ({ id, p: patients[id] })).filter((x) => x.p);

  const cohortStats = useMemo(() => {
    const list = items.map((i) => i.p);
    const n = list.length;
    if (n === 0) return { n: 0, avgVisits: 0, totalCharges: 0, highBurdenPct: 0 };
    const totalVisits = list.reduce((s, p) => s + (p.encounter_count ?? 0), 0);
    const totalCharges = list.reduce((s, p) => s + (p.total_charges ?? 0), 0);
    const highBurden = list.filter((p) => (p.active_chronic_count ?? 0) >= 3).length;
    return {
      n,
      avgVisits: totalVisits / n,
      totalCharges,
      highBurdenPct: (highBurden / n) * 100,
    };
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="eyebrow mb-1">Saved</div>
        <h1 className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">Watchlist</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-1">
          {ids.length === 0
            ? "You haven't saved any patients yet."
            : `${ids.length} ${ids.length === 1 ? 'patient' : 'patients'} saved in this browser.`}
        </p>
      </header>

      {ids.length === 0 ? (
        <div className="clinical-card p-10 text-center border-dashed">
          <div className="font-serif text-lg font-semibold text-[var(--ink-strong)]">Nothing here yet.</div>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-md mx-auto leading-relaxed">
            Build a cohort of high-burden patients to monitor. Compare against the{' '}
            <Link to="/executive" className="text-[var(--clinical-teal)] hover:text-[var(--ink-strong)] font-medium">Executive Cockpit</Link>{' '}
            benchmarks. Open any patient and click <strong>"Add to watchlist"</strong> in the header.
          </p>
          <Link
            to="/patients"
            className="mt-4 inline-block rounded-md text-white text-sm font-semibold px-4 py-2"
            style={{ background: 'var(--color-brand-700)' }}
          >
            Browse patients
          </Link>
        </div>
      ) : (
        <>
        <div className="clinical-card px-5 py-3.5 mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div className="eyebrow shrink-0">Cohort</div>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.n}
              format={(n) => formatNumber(Math.round(n))}
              className="font-serif text-xl font-semibold text-[var(--ink-strong)] tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">patients</span>
          </div>
          <span className="text-[var(--hairline)]">│</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.avgVisits}
              format={(n) => n.toFixed(1)}
              className="font-serif text-xl font-semibold text-[var(--ink-strong)] tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">avg visits</span>
          </div>
          <span className="text-[var(--hairline)]">│</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.totalCharges}
              format={(n) => formatCurrency(n)}
              className="font-serif text-xl font-semibold text-[var(--ink-strong)] tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">lifetime</span>
          </div>
          <span className="text-[var(--hairline)]">│</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.highBurdenPct}
              format={(n) => `${n.toFixed(1)}%`}
              className="font-serif text-xl font-semibold tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">high-burden</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(({ id, p }) => {
            const burden = p.active_chronic_count;
            const burdenTone =
              burden >= 3 ? { cls: 'alert', label: 'High burden' } :
              burden >= 1 ? { cls: 'caution', label: `${burden} chronic` } :
              { cls: 'healthy', label: 'Stable' };
            return (
              <Link
                key={id}
                to={`/patients/${encodeURIComponent(id)}`}
                className="block clinical-card hover:border-[var(--clinical-teal)] transition-colors group"
              >
                <div className="px-5 pt-4 pb-3 border-b border-[var(--hairline-soft)] flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-mono text-[var(--ink-soft)] tracking-tight truncate">MRN {p.med_rec_num}</div>
                    <div className="mt-1 font-serif font-semibold text-[var(--ink-strong)] truncate group-hover:underline underline-offset-2">
                      {p.full_name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); watchlist.remove(id); }}
                    className="text-xs text-[var(--ink-soft)] hover:text-[var(--clinical-rose)] shrink-0"
                    aria-label="Remove from watchlist"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="text-xs text-[var(--ink-muted)] tabular">
                    {p.age} y/o · {p.sex} · {p.city ?? '—'}
                  </div>
                  <span className={`status-pill ${burdenTone.cls}`}>{burdenTone.label}</span>
                </div>
                <div className="px-5 pb-4 flex items-baseline justify-between">
                  <span className="font-serif text-xl font-semibold text-[var(--ink-strong)] tabular">
                    {formatNumber(p.encounter_count)}
                    <span className="ml-1 text-xs font-sans font-medium text-[var(--ink-soft)]">visits</span>
                  </span>
                  <span className="text-xs text-[var(--ink-soft)] tabular">{formatCurrency(p.total_charges)} lifetime</span>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="mt-6">
          <ProvenanceStrip
            freshness="4 min ago"
            source="Clarity Health · Watchlist mart"
            rows={`${formatNumber(cohortStats.n)} rows · watchlist`}
          />
        </div>
        </>
      )}
    </div>
  );
}
