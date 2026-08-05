import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, formatCurrency, formatNumber } from '../api/queries';
import type { PatientSearchResult } from '../types';
import { AnimatedCounter, ProvenanceStrip } from '../components/Executive';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [zip, setZip] = useState(params.get('zip') ?? '');
  const [results, setResults] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'visits' | 'chronic' | 'charges'>('visits');

  useEffect(() => {
    setLoading(true);
    api
      .searchPatients({
        q: params.get('q') ?? undefined,
        city: params.get('city') ?? undefined,
        zip: params.get('zip') ?? undefined,
        limit: 500,
      })
      .then((r) => setResults(r.results))
      .finally(() => setLoading(false));
  }, [params]);

  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      if (sort === 'visits') return b.encounter_count - a.encounter_count;
      if (sort === 'chronic') return b.active_chronic_count - a.active_chronic_count;
      return b.total_charges - a.total_charges;
    });
    return copy;
  }, [results, sort]);

  const cohortStats = useMemo(() => {
    const n = results.length;
    if (n === 0) return { n: 0, avgVisits: 0, totalCharges: 0, highBurdenPct: 0 };
    const totalVisits = results.reduce((s, p) => s + (p.encounter_count ?? 0), 0);
    const totalCharges = results.reduce((s, p) => s + (p.total_charges ?? 0), 0);
    const highBurden = results.filter((p) => (p.active_chronic_count ?? 0) >= 3).length;
    return {
      n,
      avgVisits: totalVisits / n,
      totalCharges,
      highBurdenPct: (highBurden / n) * 100,
    };
  }, [results]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (q.trim()) next.q = q.trim();
    if (city.trim()) next.city = city.trim();
    if (zip.trim()) next.zip = zip.trim();
    setParams(next);
  };

  const clearFilters = () => {
    setQ('');
    setCity('');
    setZip('');
    setParams({});
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between mb-6 border-b border-[var(--hairline)] pb-4">
        <div>
          <div className="eyebrow mb-1">Patient Registry</div>
          <h1 className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">
            Patient lookup
          </h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1 max-w-2xl">
            Search the patient registry mart joined with the encounters mart for visit and chronic-condition counts.
          </p>
        </div>
        <div className="text-sm text-[var(--ink-soft)] tabular shrink-0">
          {loading ? 'Searching…' : <><span className="font-serif font-semibold text-xl text-[var(--ink-strong)]">{sorted.length}</span> {sorted.length === 1 ? 'patient' : 'patients'}</>}
        </div>
      </div>

      <form onSubmit={applyFilters} className="clinical-card p-4 grid grid-cols-1 md:grid-cols-12 gap-3 mb-6">
        <div className="md:col-span-5">
          <label className="block text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-1">Name · MRN · ID</label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. Smith"
            className="w-full rounded-md border border-[var(--hairline)] bg-white px-3 py-2 text-sm focus:border-[var(--clinical-teal)] focus:outline-none"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-1">City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Pittsburgh"
            className="w-full rounded-md border border-[var(--hairline)] bg-white px-3 py-2 text-sm focus:border-[var(--clinical-teal)] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider mb-1">ZIP</label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="15217"
            className="w-full rounded-md border border-[var(--hairline)] bg-white px-3 py-2 text-sm focus:border-[var(--clinical-teal)] focus:outline-none"
          />
        </div>
        <div className="md:col-span-2 flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md text-white text-sm font-semibold px-4 py-2"
            style={{ background: 'var(--color-brand-700)' }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-[var(--hairline)] hover:bg-[var(--paper-deep)] text-[var(--ink-muted)] text-sm px-3 py-2"
          >
            Clear
          </button>
        </div>
      </form>

      {!loading && cohortStats.n > 0 && (
        <div className="clinical-card px-5 py-3.5 mb-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div className="eyebrow shrink-0">Cohort</div>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.n}
              format={(n) => formatNumber(Math.round(n))}
              className="font-serif text-xl font-semibold text-[var(--ink-strong)] tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">patients matched</span>
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
            <span className="text-xs text-[var(--ink-soft)]">lifetime charges</span>
          </div>
          <span className="text-[var(--hairline)]">│</span>
          <div className="flex items-baseline gap-1.5">
            <AnimatedCounter
              to={cohortStats.highBurdenPct}
              format={(n) => `${n.toFixed(1)}%`}
              className="font-serif text-xl font-semibold tabular leading-none"
            />
            <span className="text-xs text-[var(--ink-soft)]">high-burden (≥3 chronic)</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider">Sort by</div>
        <div className="inline-flex gap-0.5 rounded-md border border-[var(--hairline)] bg-white p-0.5 text-xs">
          {[
            ['visits', 'Visits ↓'],
            ['chronic', 'Chronic ↓'],
            ['charges', 'Charges ↓'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key as typeof sort)}
              className={`px-3 py-1.5 rounded font-medium ${sort === key ? 'bg-[var(--paper-deep)] text-[var(--ink-strong)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="clinical-card p-12 text-center text-[var(--ink-soft)]">Loading…</div>
      ) : sorted.length === 0 ? (
        <div className="clinical-card p-12 text-center">
          <div className="text-[var(--ink-strong)] font-medium">No patients matched your filters.</div>
          <button onClick={clearFilters} className="mt-3 text-sm text-[var(--clinical-teal)] hover:text-[var(--ink-strong)] font-medium">
            Clear filters →
          </button>
        </div>
      ) : (
        <div className="clinical-card overflow-x-auto">
          <table className="min-w-full text-sm tabular">
            <thead className="bg-[var(--paper-deep)] border-b border-[var(--hairline)]">
              <tr>
                <Th>MRN</Th>
                <Th>Patient</Th>
                <Th>Age · Sex</Th>
                <Th>Location</Th>
                <Th>PCP</Th>
                <Th align="right">Visits</Th>
                <Th align="right">Chronic</Th>
                <Th align="right">Charges</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline-soft)]">
              {sorted.map((p) => (
                <tr
                  key={p.pat_id}
                  onClick={() => navigate(`/patients/${encodeURIComponent(p.pat_id)}`)}
                  className="cursor-pointer hover:bg-[var(--paper-deep)] transition-colors"
                >
                  <td className="px-4 py-2.5 text-[11px] font-mono text-[var(--ink-soft)]">{p.med_rec_num}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-serif font-semibold text-[var(--ink-strong)]">{p.full_name}</div>
                    <div className="text-[10px] text-[var(--ink-soft)] font-mono">{p.pat_id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink)]">{p.age} · {p.sex}</td>
                  <td className="px-4 py-2.5 text-[var(--ink-muted)]">
                    {p.city ?? '—'}{p.zip_code ? ` · ${p.zip_code}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)]">{p.primary_care_provider ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[var(--ink-strong)]">{formatNumber(p.encounter_count)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.active_chronic_count >= 3 ? (
                      <span className="status-pill alert">{p.active_chronic_count}</span>
                    ) : p.active_chronic_count > 0 ? (
                      <span className="status-pill caution">{p.active_chronic_count}</span>
                    ) : (
                      <span className="text-xs text-[var(--ink-soft)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[var(--ink)]">{formatCurrency(p.total_charges)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <ProvenanceStrip
          freshness="4 min ago"
          source="Clarity Health · Patient Registry mart"
          rows={`${formatNumber(results.length)} rows · 2 marts`}
        />
      </div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)] ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}
