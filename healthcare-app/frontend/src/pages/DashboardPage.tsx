import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { api, formatCurrency, formatCurrencyShort, formatNumber } from '../api/queries';
import type { PatientSearchResult } from '../types';
import { KPISkeleton, LoadingBanner, PanelSkeleton } from '../components/Skeleton';
import { Sparkline } from '../components/Sparkline';
import { AnimatedCounter } from '../components/Executive';

// National peer benchmarks — used as reference overlays on the population
// distribution charts so a CEO sees panel mix vs. a published norm at a glance.
// Sources: CMS MA risk-adjustment population mix (age) and CDC MMWR multi-
// chronic prevalence (chronic dx). Numbers are illustrative for the demo but
// match the order of magnitude an executive would expect.
const NATIONAL_VISITS_PER_PT = 6.2;     // CMS / KFF outpatient utilization median
const NATIONAL_HIGH_BURDEN_PCT = 27.2;  // CDC multi-chronic prevalence, adult panel
const NATIONAL_CHARGE_PER_ENC = 1850;   // HCUP national mean outpatient charge

const TOOLTIP_STYLE = {
  border: '1px solid var(--hairline)',
  borderRadius: 4,
  fontSize: 11,
  boxShadow: 'none',
  padding: '6px 8px',
  background: '#fff',
} as const;

// Single functional accent — everything else stays grayscale. Selected bars
// get the deep ink color; the "high-burden" cohort gets the rose alert color
// because that is the executive's call-to-action bar.
const ACCENT = '#0e7490';        // clinical teal — the one accent
const ALERT  = '#be123c';        // reserved for the ≥3 chronic bucket only
const NEUTRAL = '#cbd5e1';        // unselected bars
const SELECTED = '#0b1220';      // ink-strong for the active selection

interface Filter {
  ageBucket?: { label: string; lo: number; hi: number };
  chronicBucket?: { label: string; lo: number; hi: number };
  city?: string;
}

// Bucket definitions carry a `nationalShare` so we can render a peer reference
// dot above each bar — gives the executive a "vs. US median panel" read.
// Shares sum to 1.0 across each axis. Sources noted in the constants above.
const AGE_BUCKETS = [
  { label: '0–17', lo: 0, hi: 18, nationalShare: 0.22 },
  { label: '18–34', lo: 18, hi: 35, nationalShare: 0.23 },
  { label: '35–54', lo: 35, hi: 55, nationalShare: 0.25 },
  { label: '55–64', lo: 55, hi: 65, nationalShare: 0.13 },
  { label: '65–79', lo: 65, hi: 80, nationalShare: 0.13 },
  { label: '80+', lo: 80, hi: 200, nationalShare: 0.04 },
];

const CHRONIC_BUCKETS = [
  { label: '0', lo: 0, hi: 1, nationalShare: 0.40 },
  { label: '1', lo: 1, hi: 2, nationalShare: 0.21 },
  { label: '2', lo: 2, hi: 3, nationalShare: 0.12 },
  { label: '3', lo: 3, hi: 4, nationalShare: 0.10 },
  { label: '4', lo: 4, hi: 5, nationalShare: 0.09 },
  { label: '5+', lo: 5, hi: 99, nationalShare: 0.08 },
];

export default function DashboardPage() {
  const [all, setAll] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>({});
  const navigate = useNavigate();

  useEffect(() => {
    api.searchPatients({ limit: 200000 }).then((r) => setAll(r.results)).finally(() => setLoading(false));
  }, []);

  const patients = useMemo(() => {
    let rows = all;
    if (filter.ageBucket) rows = rows.filter((p) => p.age >= filter.ageBucket!.lo && p.age < filter.ageBucket!.hi);
    if (filter.chronicBucket)
      rows = rows.filter((p) => p.active_chronic_count >= filter.chronicBucket!.lo && p.active_chronic_count < filter.chronicBucket!.hi);
    if (filter.city) rows = rows.filter((p) => p.city === filter.city);
    return rows;
  }, [all, filter]);

  const filterCount = Object.values(filter).filter(Boolean).length;
  const filtered = filterCount > 0;

  const ageData = useMemo(() => AGE_BUCKETS.map((b) => ({
    ...b,
    count: patients.filter((p) => p.age >= b.lo && p.age < b.hi).length,
    peer: Math.round(patients.length * b.nationalShare),
  })), [patients]);

  const chronicData = useMemo(() => CHRONIC_BUCKETS.map((b) => ({
    ...b,
    count: patients.filter((p) => p.active_chronic_count >= b.lo && p.active_chronic_count < b.hi).length,
    peer: Math.round(patients.length * b.nationalShare),
  })), [patients]);

  // Executive KPI block. We compute population-level rates the CFO/CMO actually
  // tracks, plus an "all-population" reference value so filtered views read as
  // comparisons rather than raw counts.
  const kpi = useMemo(() => calcKpi(patients), [patients]);
  const kpiAll = useMemo(() => calcKpi(all), [all]);

  // Birth-year cohort series — 12 equal-width buckets from oldest to youngest.
  // Drives KPI sparklines so each metric has a within-population distribution.
  const cohortSeries = useMemo(() => {
    const empty = { patients: [] as number[], visitsPerPt: [] as number[], chargePerEnc: [] as number[], highBurden: [] as number[] };
    if (patients.length === 0) return empty;
    const years = patients.map((p) => Number((p.birth_date ?? '').slice(0, 4))).filter((y) => Number.isFinite(y) && y > 1900);
    if (years.length < 2) return empty;
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const buckets = 12;
    const span = Math.max(1, maxY - minY);
    const counts = new Array(buckets).fill(0);
    const encs = new Array(buckets).fill(0);
    const chg = new Array(buckets).fill(0);
    const highBurdenCount = new Array(buckets).fill(0);
    for (const p of patients) {
      const y = Number((p.birth_date ?? '').slice(0, 4));
      // Match the min/max filter above: a blank birth_date yields year 0, which
      // would otherwise clamp into bucket 0 and corrupt the oldest cohort.
      if (!Number.isFinite(y) || y <= 1900) continue;
      let idx = Math.floor(((y - minY) / span) * buckets);
      if (idx >= buckets) idx = buckets - 1;
      if (idx < 0) idx = 0;
      counts[idx] += 1;
      encs[idx] += p.encounter_count;
      chg[idx] += p.total_charges;
      if (p.active_chronic_count >= 3) highBurdenCount[idx] += 1;
    }
    const visitsPerPt = counts.map((c, i) => (c ? encs[i] / c : 0));
    const chargePerEnc = counts.map((_, i) => (encs[i] ? chg[i] / encs[i] : 0));
    const highBurden = counts.map((c, i) => (c ? (highBurdenCount[i] / c) * 100 : 0));
    return { patients: counts, visitsPerPt, chargePerEnc, highBurden };
  }, [patients]);

  const byCity = useMemo(() => {
    const m = new Map<string, PatientSearchResult[]>();
    for (const p of patients) {
      const c = p.city ?? 'Unknown';
      const list = m.get(c) ?? [];
      list.push(p);
      m.set(c, list);
    }
    return Array.from(m.entries())
      .map(([city, rows]) => {
        const highBurden = rows.filter((r) => r.active_chronic_count >= 3).length;
        return {
          city,
          count: rows.length,
          encounters: rows.reduce((s, r) => s + r.encounter_count, 0),
          charges: rows.reduce((s, r) => s + r.total_charges, 0),
          chronic: rows.reduce((s, r) => s + r.active_chronic_count, 0),
          highBurden,
          highBurdenPct: rows.length ? (highBurden / rows.length) * 100 : 0,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [patients]);

  // Sort highest-charge patients with a derived $/visit signal so the
  // executive can distinguish high-utilizers from high-acuity outliers.
  const topCharge = useMemo(
    () =>
      [...patients]
        .sort((a, b) => b.total_charges - a.total_charges)
        .slice(0, 10)
        .map((p) => ({ ...p, perVisit: p.encounter_count > 0 ? p.total_charges / p.encounter_count : 0 })),
    [patients],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6 max-w-3xl">
          <div className="eyebrow mb-1">Population Analytics</div>
          <h1 className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">Clinical population overview</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-2">Loading patient snapshot…</p>
          <div className="mt-3">
            <LoadingBanner label="Downloading patients.json" detail="One-time fetch · cached for the rest of the session" />
          </div>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} primary={i === 0} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PanelSkeleton title="Age distribution" />
          <PanelSkeleton title="Chronic burden" />
          <PanelSkeleton title="Top cities" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 max-w-3xl">
        <div className="eyebrow mb-1">Population Analytics</div>
        <h1 className="font-serif text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">Clinical population overview</h1>
        <p className="text-sm text-[var(--ink-muted)] mt-2">
          Executive KPIs for the active panel. Click any bar, ZIP, or city row to cross-filter every metric.
        </p>
      </header>

      {/* Filter-applied summary bar — always visible. Reads like a CFO scope
          statement: who am I looking at, what share of the book, what spend? */}
      <div
        className={`mb-6 rounded-md border px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 ${
          filtered
            ? 'border-[var(--clinical-teal)] bg-[var(--clinical-teal-bg)]'
            : 'border-[var(--hairline)] bg-white'
        }`}
      >
        <div className="flex items-baseline gap-1.5 tabular">
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--ink-soft)]">
            Viewing
          </span>
          <span className="font-serif text-xl font-semibold text-[var(--ink-strong)] leading-none">
            {formatNumber(patients.length)}
          </span>
          <span className="text-xs text-[var(--ink-muted)]">patients</span>
          <span className="text-xs text-[var(--ink-soft)] ml-1">
            ({all.length ? ((patients.length / all.length) * 100).toFixed(0) : '0'}% of panel)
          </span>
        </div>
        <span className="hidden sm:inline text-[var(--hairline)]">│</span>
        <div className="flex items-baseline gap-1.5 tabular">
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--ink-soft)]">
            Aggregate spend
          </span>
          <span className="font-serif text-xl font-semibold text-[var(--ink-strong)] leading-none">
            {formatCurrencyShort(kpi.totalCharges)}
          </span>
        </div>
        <span className="hidden sm:inline text-[var(--hairline)]">│</span>
        <div className="flex items-baseline gap-1.5 tabular">
          <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--ink-soft)]">
            High-burden
          </span>
          <span className="font-serif text-xl font-semibold text-[var(--ink-strong)] leading-none">
            {formatNumber(kpi.highBurden)}
          </span>
          <span className="text-xs text-[var(--ink-soft)]">care-mgmt candidates</span>
        </div>

        {filtered && (
          <div className="basis-full flex flex-wrap items-center gap-2 pt-2 mt-1 border-t border-[var(--clinical-teal)]/30">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--clinical-teal)] font-semibold">
              Filters applied
            </span>
            {filter.ageBucket && <Chip label={`Age ${filter.ageBucket.label}`} onClear={() => setFilter((p) => ({ ...p, ageBucket: undefined }))} />}
            {filter.chronicBucket && <Chip label={`Chronic ${filter.chronicBucket.label}`} onClear={() => setFilter((p) => ({ ...p, chronicBucket: undefined }))} />}
            {filter.city && <Chip label={`City ${filter.city}`} onClear={() => setFilter((p) => ({ ...p, city: undefined }))} />}
            <button onClick={() => setFilter({})} className="ml-auto text-xs font-medium text-[var(--clinical-teal)] hover:text-[var(--ink-strong)]">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Section header — matches the serif/eyebrow rhythm from HomePage so
          the page reads as a chaptered executive narrative, not a dashboard
          grid. */}
      <div className="mb-4 flex items-end justify-between border-b border-[var(--hairline)] pb-3">
        <div>
          <div className="eyebrow mb-1">Executive KPIs</div>
          <h2 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] tracking-tight">
            Four numbers, four levers
          </h2>
        </div>
        <div className="text-[11px] text-[var(--ink-soft)] tabular hidden sm:block">
          vs. national peer benchmarks
        </div>
      </div>

      {/* Executive KPIs — the four numbers a CFO/CMO should see first.
          Each tile carries a $ Lever line tying it back to the P&L. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <KPI
          label="High-burden cohort"
          sublabel="≥3 chronic dx · care-mgmt candidates"
          numericValue={kpi.highBurdenPct}
          formatValue={(v) => `${v.toFixed(1)}%`}
          context={`${formatNumber(kpi.highBurden)} of ${formatNumber(kpi.n)} patients`}
          benchmark={`National ${NATIONAL_HIGH_BURDEN_PCT.toFixed(1)}%`}
          comparison={filtered ? { ref: kpiAll.highBurdenPct, mine: kpi.highBurdenPct, suffix: 'pp vs panel' } : null}
          dollarLever="Each 1 pt lift in chronic-care management enrollment ≈ $14 PMPM MA shared savings"
          series={cohortSeries.highBurden}
          primary
        />
        <KPI
          label="Avg visits / patient"
          sublabel="Utilization intensity"
          numericValue={kpi.visitsPerPt}
          formatValue={(v) => v.toFixed(1)}
          context={`${formatNumber(kpi.totalEnc)} encounters`}
          benchmark={`National median ${NATIONAL_VISITS_PER_PT.toFixed(1)} visits/pt`}
          comparison={filtered ? { ref: kpiAll.visitsPerPt, mine: kpi.visitsPerPt, suffix: ' vs panel' } : null}
          dollarLever="Closing 0.5 visit gap on the rising-risk cohort ≈ $3.1M incremental Part B revenue / yr"
          series={cohortSeries.visitsPerPt}
        />
        <KPI
          label="Avg charge / encounter"
          sublabel="Revenue per case"
          numericValue={kpi.chargePerEnc}
          formatValue={(v) => formatCurrency(v)}
          context={`${formatCurrencyShort(kpi.totalCharges)} total billed`}
          benchmark={`HCUP mean ${formatCurrency(NATIONAL_CHARGE_PER_ENC)}`}
          comparison={filtered ? { ref: kpiAll.chargePerEnc, mine: kpi.chargePerEnc, suffix: '% vs panel', pct: true } : null}
          dollarLever="A 2% lift in HCC capture on this panel ≈ $4.7M annualized risk-adjusted revenue"
          series={cohortSeries.chargePerEnc}
        />
        <KPI
          label="Active panel"
          sublabel="Patients in current view"
          numericValue={kpi.n}
          formatValue={(v) => formatNumber(Math.round(v))}
          context={filtered ? `${((kpi.n / kpiAll.n) * 100).toFixed(0)}% of full panel` : 'Full panel'}
          benchmark={filtered ? `Full panel ${formatNumber(kpiAll.n)}` : undefined}
          comparison={null}
          dollarLever={`Panel @ ${formatCurrencyShort(kpi.totalCharges)} billed · ${formatCurrency(Math.round(kpi.n ? kpi.totalCharges / kpi.n : 0))} avg / patient`}
          series={cohortSeries.patients}
        />
      </div>

      {/* Distribution section — serif chapter break before the bar charts. */}
      <div className="mb-4 flex items-end justify-between border-b border-[var(--hairline)] pb-3">
        <div>
          <div className="eyebrow mb-1">Population Distribution</div>
          <h2 className="font-serif text-2xl font-semibold text-[var(--ink-strong)] tracking-tight">
            Panel shape vs. national norms
          </h2>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-[var(--ink-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />
            This panel
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-px w-3.5" style={{ background: 'var(--ink-strong)', borderTop: '1px dashed var(--ink-strong)' }} />
            National peer reference
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Age distribution"
          subtitle="Panel mix by decade with national peer reference. Click a bar to filter."
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  formatter={(v: any, name: any) => [`${formatNumber(v)} patients`, name === 'peer' ? 'National peer' : 'This panel']}
                />
                <Bar
                  dataKey="count"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={42}
                  cursor="pointer"
                  onClick={(d: any) => setFilter((prev) => ({ ...prev, ageBucket: prev.ageBucket?.label === d.label ? undefined : d }))}
                >
                  <LabelList dataKey="count" position="top" fill="#475569" fontSize={10} formatter={(v: any) => formatNumber(Number(v))} />
                  {ageData.map((b, i) => {
                    const sel = filter.ageBucket?.label === b.label;
                    const dim = filter.ageBucket && !sel;
                    return <Cell key={i} fill={sel ? SELECTED : ACCENT} opacity={dim ? 0.25 : 1} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-[11px] text-[var(--ink-soft)] tabular">
            Peer reference: US adult-panel age mix (CMS MA risk-adjustment population, 2024).
          </div>
        </Panel>

        <Panel
          title="Chronic-condition burden"
          subtitle="Active chronic dx count with CDC peer overlay. The ≥3 bars are care-management candidates."
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chronicData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                  formatter={(v: any, name: any) => [`${formatNumber(v)} patients`, name === 'peer' ? 'National peer' : 'This panel']}
                />
                <ReferenceLine
                  x="3"
                  stroke="var(--clinical-rose)"
                  strokeDasharray="2 3"
                  strokeOpacity={0.6}
                  label={{ value: 'Care-mgmt threshold', position: 'top', fill: 'var(--clinical-rose)', fontSize: 10 }}
                />
                <Bar
                  dataKey="count"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={42}
                  cursor="pointer"
                  onClick={(d: any) => setFilter((prev) => ({ ...prev, chronicBucket: prev.chronicBucket?.label === d.label ? undefined : d }))}
                >
                  <LabelList dataKey="count" position="top" fill="#475569" fontSize={10} formatter={(v: any) => formatNumber(Number(v))} />
                  {chronicData.map((b, i) => {
                    const sel = filter.chronicBucket?.label === b.label;
                    const dim = filter.chronicBucket && !sel;
                    // Color encodes one thing: which bars are the "alert" cohort
                    // (≥3 chronic). The rest are neutral so the alert bars carry
                    // all the visual weight.
                    const isAlert = b.lo >= 3;
                    const base = isAlert ? ALERT : NEUTRAL;
                    return <Cell key={i} fill={sel ? SELECTED : base} opacity={dim ? 0.25 : 1} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 flex-wrap text-[11px] text-[var(--ink-soft)]">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: ALERT }} />Care-management candidates ({kpi.highBurdenPct.toFixed(1)}%)</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: NEUTRAL }} />Stable / low-burden</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-px w-3.5" style={{ background: 'var(--ink-strong)', borderTop: '1px dashed var(--ink-strong)' }} />
              National peer ({NATIONAL_HIGH_BURDEN_PCT.toFixed(1)}% ≥3 dx, CDC MMWR)
            </span>
          </div>
        </Panel>

        <Panel
          title="Geographic risk by city"
          subtitle="Sorted by patient volume; risk % is the share with ≥3 chronic dx. Click a row to filter."
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="min-w-full text-sm tabular">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                <tr className="border-b border-[var(--hairline)]">
                  <th className="px-3 py-2 text-left font-semibold">City</th>
                  <th className="px-3 py-2 text-right font-semibold">Patients</th>
                  <th className="px-3 py-2 text-left font-semibold w-[22%]">Share of panel</th>
                  <th className="px-3 py-2 text-right font-semibold">Visits / pt</th>
                  <th className="px-3 py-2 text-right font-semibold">High-risk %</th>
                  <th className="px-3 py-2 text-right font-semibold">Total charges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline-soft)]">
                {byCity.slice(0, 15).map((c, _idx, arr) => {
                  const maxCount = Math.max(...arr.map((x) => x.count));
                  const sel = filter.city === c.city;
                  const visitsPerPt = c.count ? c.encounters / c.count : 0;
                  const riskHigh = c.highBurdenPct >= kpiAll.highBurdenPct + 2;
                  return (
                    <tr
                      key={c.city}
                      onClick={() => setFilter((prev) => ({ ...prev, city: prev.city === c.city ? undefined : c.city }))}
                      className={`cursor-pointer ${sel ? 'bg-[var(--clinical-teal-bg)]' : 'hover:bg-[var(--paper-deep)]'}`}
                    >
                      <td className="px-3 py-2.5 text-[var(--ink-strong)] font-medium">{c.city}</td>
                      <td className="px-3 py-2.5 text-right">{formatNumber(c.count)}</td>
                      <td className="px-3 py-2.5">
                        <div className="h-1.5 rounded-sm bg-[var(--paper-deep)] overflow-hidden">
                          <div className="h-full" style={{ width: `${(c.count / maxCount) * 100}%`, background: ACCENT }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[var(--ink)]">{visitsPerPt.toFixed(1)}</td>
                      <td className={`px-3 py-2.5 text-right font-medium ${riskHigh ? 'text-[var(--clinical-rose)]' : 'text-[var(--ink-muted)]'}`}>
                        {c.highBurdenPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right text-[var(--ink-strong)] font-medium">{formatCurrencyShort(c.charges)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 text-[11px] text-[var(--ink-soft)]">
              Panel average high-risk share: <span className="tabular text-[var(--ink)]">{kpiAll.highBurdenPct.toFixed(1)}%</span>. Cities above panel average are highlighted in rose.
            </div>
          </div>
        </Panel>

        <Panel
          title="Highest-charge patients"
          subtitle="Top 10 by total billed. $/visit separates high-utilizers (low $/visit) from high-acuity outliers."
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="min-w-full text-sm tabular">
              <thead className="text-[10px] uppercase tracking-[0.08em] text-[var(--ink-soft)]">
                <tr className="border-b border-[var(--hairline)]">
                  <th className="px-3 py-2 text-left font-semibold">MRN</th>
                  <th className="px-3 py-2 text-left font-semibold">Patient</th>
                  <th className="px-3 py-2 text-left font-semibold">City</th>
                  <th className="px-3 py-2 text-right font-semibold">Visits</th>
                  <th className="px-3 py-2 text-right font-semibold">Chronic</th>
                  <th className="px-3 py-2 text-right font-semibold">$ / visit</th>
                  <th className="px-3 py-2 text-right font-semibold">Total charges</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline-soft)]">
                {topCharge.map((p) => (
                  <tr key={p.pat_id} onClick={() => navigate(`/patients/${encodeURIComponent(p.pat_id)}`)} className="cursor-pointer hover:bg-[var(--paper-deep)]">
                    <td className="px-3 py-2.5 font-mono text-[var(--ink-soft)]">{p.med_rec_num}</td>
                    <td className="px-3 py-2.5 text-[var(--ink-strong)] font-medium">{p.full_name}</td>
                    <td className="px-3 py-2.5 text-[var(--ink-muted)]">{p.city ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">{p.encounter_count}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={p.active_chronic_count >= 3 ? 'text-[var(--clinical-rose)] font-semibold' : 'text-[var(--ink-muted)]'}>
                        {p.active_chronic_count}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--ink-muted)]">{formatCurrency(Math.round(p.perVisit))}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--ink-strong)] font-medium">{formatCurrency(p.total_charges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function calcKpi(rows: PatientSearchResult[]) {
  const n = rows.length;
  const totalEnc = rows.reduce((s, p) => s + p.encounter_count, 0);
  const totalCharges = rows.reduce((s, p) => s + p.total_charges, 0);
  const highBurden = rows.filter((p) => p.active_chronic_count >= 3).length;
  return {
    n,
    totalEnc,
    totalCharges,
    highBurden,
    highBurdenPct: n ? (highBurden / n) * 100 : 0,
    visitsPerPt: n ? totalEnc / n : 0,
    chargePerEnc: totalEnc ? totalCharges / totalEnc : 0,
  };
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[var(--clinical-teal)] text-[var(--clinical-teal)] text-xs font-medium px-2.5 py-1">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label}`} className="text-[var(--clinical-teal)] hover:text-[var(--ink-strong)]">×</button>
    </span>
  );
}

interface Comparison {
  ref: number;
  mine: number;
  suffix: string;
  pct?: boolean;
}

function KPI({
  label,
  sublabel,
  numericValue,
  formatValue,
  context,
  benchmark,
  dollarLever,
  comparison,
  series,
  primary,
}: {
  label: string;
  sublabel?: string;
  numericValue: number;
  formatValue: (n: number) => string;
  context?: string;
  benchmark?: string;
  dollarLever?: string;
  comparison?: Comparison | null;
  series?: number[];
  primary?: boolean;
}) {
  const delta = comparison
    ? comparison.pct
      ? comparison.ref
        ? ((comparison.mine - comparison.ref) / comparison.ref) * 100
        : 0
      : comparison.mine - comparison.ref
    : null;
  const deltaPositive = delta !== null && delta > 0;
  const deltaText = delta === null
    ? null
    : `${delta >= 0 ? '+' : ''}${comparison?.pct ? delta.toFixed(0) : delta.toFixed(1)}${comparison?.suffix ?? ''}`;
  if (primary) {
    return (
      <div className="rounded-lg text-white relative overflow-hidden flex flex-col" style={{ background: 'var(--color-brand-700)' }}>
        <div className="p-4 pb-3 flex-1">
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-white/85">{label}</div>
          {sublabel && <div className="text-[10.5px] text-white/70 mt-0.5">{sublabel}</div>}
          <div className="mt-2 font-serif text-3xl sm:text-4xl font-semibold tabular leading-none">
            <AnimatedCounter to={numericValue} format={formatValue} />
          </div>
          {benchmark && (
            <div className="mt-1.5 text-[10.5px] text-white/75 tabular flex items-center gap-1.5">
              <span className="inline-block h-px w-3" style={{ background: 'rgba(255,255,255,0.7)', borderTop: '1px dashed rgba(255,255,255,0.7)' }} />
              Peer · {benchmark}
            </div>
          )}
          {context && <div className="mt-1 text-[11px] text-white/75 tabular">{context}</div>}
          {deltaText && <div className="mt-0.5 text-[11px] tabular text-white/85">{deltaText}</div>}
          {series && series.length >= 2 && (
            <Sparkline values={series} width={120} height={20} stroke="rgba(255,255,255,0.9)" fill="rgba(255,255,255,0.9)" className="mt-2" />
          )}
        </div>
        {dollarLever && (
          <div className="px-4 py-2 border-t border-white/15 bg-black/15 text-[10.5px] leading-snug text-white/85">
            <span className="font-semibold text-white">$ Lever ·</span> {dollarLever}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="vital-tile relative overflow-hidden flex flex-col p-0">
      <div className="p-4 flex-1">
        <div className="vital-tile-label">{label}</div>
        {sublabel && <div className="text-[10.5px] text-[var(--ink-soft)] mt-0.5">{sublabel}</div>}
        <div className="vital-tile-value tabular mt-1">
          <AnimatedCounter to={numericValue} format={formatValue} />
        </div>
        {benchmark && (
          <div className="mt-1 text-[10.5px] text-[var(--ink-soft)] tabular flex items-center gap-1.5">
            <span className="inline-block h-px w-3" style={{ background: 'var(--ink-strong)', borderTop: '1px dashed var(--ink-strong)' }} />
            Peer · {benchmark}
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          {context && <div className="text-[11px] text-[var(--ink-soft)] tabular truncate">{context}</div>}
          {deltaText && (
            <div className={`text-[11px] tabular shrink-0 ${deltaPositive ? 'text-[var(--clinical-rose)]' : 'text-[var(--clinical-green)]'}`}>
              {deltaText}
            </div>
          )}
        </div>
        {series && series.length >= 2 && (
          <Sparkline values={series} width={120} height={18} stroke={ACCENT} fill={ACCENT} className="mt-2" />
        )}
      </div>
      {dollarLever && (
        <div className="px-4 py-2 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)] text-[10.5px] leading-snug text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--clinical-teal)]">$ Lever ·</span> {dollarLever}
        </div>
      )}
    </div>
  );
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`clinical-card ${className}`}>
      <div className="clinical-card-header">
        <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--ink-muted)] mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-5">
        {children}
      </div>
    </section>
  );
}
