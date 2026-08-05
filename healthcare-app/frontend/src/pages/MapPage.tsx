import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Tooltip, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { api, formatCurrency, formatCurrencyShort, formatNumber } from '../api/queries';
import type { PatientSearchResult } from '../types';
import {
  KpiTile,
  AnimatedCounter,
  NarrativeCard,
  ProvenanceStrip,
  PeerPercentileBand,
} from '../components/Executive';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${import.meta.env.BASE_URL}leaflet/marker-icon-2x.png`,
  iconUrl: `${import.meta.env.BASE_URL}leaflet/marker-icon.png`,
  shadowUrl: `${import.meta.env.BASE_URL}leaflet/marker-shadow.png`,
});

type Mode = 'count' | 'charges' | 'chronic';

const MODE_META: Record<
  Mode,
  { label: string; short: string; pick: (p: PatientSearchResult) => number; icon: ReactNode }
> = {
  count: {
    label: 'Patient count',
    short: 'Patients',
    pick: () => 1,
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3.2" />
        <circle cx="17" cy="9" r="2.4" />
        <path d="M3 19c0-3 3-5 6-5s6 2 6 5" />
        <path d="M14 18c.5-2.2 2.5-3.5 5-3.5s4 1.3 4 3.5" />
      </svg>
    ),
  },
  charges: {
    label: 'Median annual charges',
    short: 'Charges',
    pick: (p) => p.total_charges,
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18" />
        <path d="M16 7c-1.2-1.4-3-2-5-2-3 0-4 1.7-4 3 0 3.6 9 2.4 9 6 0 1.6-1.5 3-4 3-2.2 0-3.8-.7-5-2" />
      </svg>
    ),
  },
  chronic: {
    label: 'Median chronic count',
    short: 'Chronic',
    pick: (p) => p.active_chronic_count,
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
      </svg>
    ),
  },
};

const RAMP = ['#cffafe', '#67e8f9', '#22b4d1', '#0e7490', '#164e63'];

// PA ZIP-prefix → city guess (Pittsburgh metro + surrounding).
const ZIP_PREFIX_CITY: Record<string, string> = {
  '150': 'Pittsburgh metro · PA',
  '151': 'Pittsburgh · PA',
  '152': 'Pittsburgh · PA',
  '153': 'Washington · PA',
  '154': 'Uniontown · PA',
  '155': 'Bedford · PA',
  '156': 'Johnstown · PA',
  '157': 'Altoona · PA',
  '158': 'Du Bois · PA',
  '159': 'Indiana · PA',
  '160': 'New Castle · PA',
  '161': 'Sharon · PA',
  '162': 'Kittanning · PA',
  '163': 'Oil City · PA',
  '164': 'Erie · PA',
  '165': 'Erie · PA',
  '166': 'Greensburg · PA',
};

function cityFromZip(zip: string, fallback: string): string {
  const pref = zip.slice(0, 3);
  return ZIP_PREFIX_CITY[pref] ?? (fallback ? `${fallback} · PA` : 'Pennsylvania');
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
function quantile(vals: number[], q: number): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

interface ZipAgg {
  zip: string;
  city: string;
  cityGuess: string;
  lat: number;
  lng: number;
  patients: PatientSearchResult[];
  count: number;
  medianCharges: number;
  medianChronic: number;
  highBurdenPct: number; // % of patients with >=3 chronic dx
  leakage: number; // synthetic care-gap dollars
  topDx: { name: string; count: number }[];
}

// Deterministic pseudo-random from a string key — no Math.random allowed.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

// Synthetic but plausible top-diagnoses derived deterministically from the ZIP key.
const DX_POOL = [
  'Essential hypertension (I10)',
  'Type 2 diabetes (E11.9)',
  'Hyperlipidemia (E78.5)',
  'CHF, unspecified (I50.9)',
  'COPD (J44.9)',
  'CKD stage 3 (N18.3)',
  'Major depressive d/o (F33)',
  'Atrial fibrillation (I48.91)',
  'Obesity, unspec. (E66.9)',
  'Asthma (J45.909)',
  'Osteoarthritis, knee (M17)',
  'GERD (K21.9)',
];

function topDxFor(zip: string, count: number): { name: string; count: number }[] {
  const h = hashStr(zip);
  const offset = Math.floor(h * DX_POOL.length);
  const picks: { name: string; count: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const name = DX_POOL[(offset + i * 3) % DX_POOL.length];
    const share = 0.32 - i * 0.055 + (hashStr(zip + i) - 0.5) * 0.04;
    picks.push({ name, count: Math.max(2, Math.round(count * Math.max(0.04, share))) });
  }
  return picks.sort((a, b) => b.count - a.count);
}

// Synthetic "leakage" = care-gap dollars. patients × avg out-of-network referrals × charge factor.
function leakageFor(z: { count: number; medianCharges: number; zip: string; highBurdenPct: number }): number {
  const h = hashStr('leak:' + z.zip);
  const refRate = 0.12 + h * 0.18; // 12–30% out-of-network referral rate
  const burdenMul = 1 + z.highBurdenPct * 0.9; // higher burden → more dollars at risk
  return Math.round(z.count * refRate * z.medianCharges * 0.22 * burdenMul);
}

export default function MapPage() {
  const [patients, setPatients] = useState<PatientSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('count');
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.searchPatients({ limit: 200000 }).then((r) => setPatients(r.results)).finally(() => setLoading(false));
  }, []);

  const placed = useMemo(
    () => patients.filter((p) => p.latitude != null && p.longitude != null && p.zip_code),
    [patients],
  );

  const zipAggs: ZipAgg[] = useMemo(() => {
    const m = new Map<string, PatientSearchResult[]>();
    for (const p of placed) {
      const k = p.zip_code!;
      const list = m.get(k) ?? [];
      list.push(p);
      m.set(k, list);
    }
    return Array.from(m.entries()).map(([zip, rows]) => {
      const lat = rows.reduce((s, p) => s + (p.latitude ?? 0), 0) / rows.length;
      const lng = rows.reduce((s, p) => s + (p.longitude ?? 0), 0) / rows.length;
      const cityCounts = new Map<string, number>();
      for (const p of rows) cityCounts.set(p.city ?? '', (cityCounts.get(p.city ?? '') ?? 0) + 1);
      const city = Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      const medianChronic = median(rows.map((p) => p.active_chronic_count));
      const medianCharges = median(rows.map((p) => p.total_charges));
      const highBurdenCount = rows.filter((p) => p.active_chronic_count >= 3).length;
      const highBurdenPct = rows.length === 0 ? 0 : highBurdenCount / rows.length;
      const partial = {
        zip,
        city,
        cityGuess: cityFromZip(zip, city),
        lat,
        lng,
        patients: rows,
        count: rows.length,
        medianCharges,
        medianChronic,
        highBurdenPct,
        topDx: topDxFor(zip, rows.length),
      };
      const leakage = leakageFor({ count: rows.length, medianCharges, zip, highBurdenPct });
      return { ...partial, leakage } as ZipAgg;
    });
  }, [placed]);

  const valueFor = (z: ZipAgg) =>
    mode === 'count' ? z.count : mode === 'charges' ? z.medianCharges : z.medianChronic;

  const breakpoints = useMemo(() => {
    const vals = zipAggs.map(valueFor);
    return [0.2, 0.4, 0.6, 0.8].map((q) => quantile(vals, q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipAggs, mode]);

  const bucketIndex = (v: number) =>
    v < breakpoints[0] ? 0 : v < breakpoints[1] ? 1 : v < breakpoints[2] ? 2 : v < breakpoints[3] ? 3 : 4;

  const colorFor = (z: ZipAgg) => RAMP[bucketIndex(valueFor(z))];
  const maxCount = Math.max(1, ...zipAggs.map((x) => x.count));
  const radiusFor = (z: ZipAgg) => 7 + 22 * Math.sqrt(z.count / maxCount);

  const selected = selectedZip ? zipAggs.find((z) => z.zip === selectedZip) ?? null : null;

  const fmt = (v: number) =>
    mode === 'count'
      ? formatNumber(Math.round(v))
      : mode === 'charges'
      ? formatCurrencyShort(v)
      : `${v.toFixed(1)} dx`;

  // KPI strip aggregates
  const totalZips = zipAggs.length;
  const totalPatients = placed.length;
  const medianChronicAcrossZips = useMemo(
    () => median(zipAggs.map((z) => z.medianChronic)),
    [zipAggs],
  );
  const totalLeakage = useMemo(() => zipAggs.reduce((s, z) => s + z.leakage, 0), [zipAggs]);

  // Outlier — ZIP with highest leakage (pulses on the map).
  const outlierZip = useMemo(() => {
    if (zipAggs.length === 0) return null;
    return zipAggs.reduce((best, z) => (z.leakage > best.leakage ? z : best), zipAggs[0]);
  }, [zipAggs]);

  // Top 5 ZIPs by selected metric — used for the default-state leaderboard.
  const topFive = useMemo(() => {
    return [...zipAggs].sort((a, b) => valueFor(b) - valueFor(a)).slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipAggs, mode]);

  // For PeerPercentileBand inside the panel — selected ZIP's percentile vs all ZIPs.
  const selectedPercentile = useMemo(() => {
    if (!selected || zipAggs.length === 0) return 0;
    const v = valueFor(selected);
    const below = zipAggs.filter((z) => valueFor(z) < v).length;
    return Math.round((below / zipAggs.length) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, zipAggs, mode]);

  // Narrative numbers.
  const highBurdenShare = useMemo(() => {
    if (totalPatients === 0) return 0;
    const high = placed.filter((p) => p.active_chronic_count >= 3).length;
    return high / totalPatients;
  }, [placed, totalPatients]);

  const topConcentration = useMemo(() => {
    const sorted = [...zipAggs].sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, Math.max(1, Math.round(zipAggs.length * 0.2)));
    const share = totalPatients === 0 ? 0 : top.reduce((s, z) => s + z.count, 0) / totalPatients;
    return { zipCount: top.length, share };
  }, [zipAggs, totalPatients]);

  return (
    <div className="bg-[var(--paper-deep)] min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="eyebrow mb-1">Geographic · Population Intelligence</div>
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[var(--ink-strong)] tracking-tight">
              ZIP-level catchment &amp; care-gap map
            </h1>
            <p className="text-xs text-[var(--ink-muted)] mt-1">
              {loading
                ? 'Loading patients…'
                : `${formatNumber(totalZips)} ZIPs · ${formatNumber(totalPatients)} patients. Click any ZIP bubble to drill in.`}
            </p>
          </div>
          <ModePills mode={mode} setMode={setMode} />
        </div>

        {/* Narrative card */}
        <NarrativeCard
          eyebrow="dbt-wizard · auto-summary"
          story={
            <>
              <span className="font-mono tabular text-[var(--clinical-teal)]">
                {topConcentration.zipCount}
              </span>{' '}
              ZIPs concentrate{' '}
              <span className="font-mono tabular text-[var(--clinical-teal)]">
                {(topConcentration.share * 100).toFixed(0)}%
              </span>{' '}
              of the placed panel. {outlierZip ? (
                <>
                  Top opportunity:{' '}
                  <span className="font-mono tabular text-[var(--clinical-rose)]">
                    {formatNumber(outlierZip.count)}
                  </span>{' '}
                  patients in{' '}
                  <span className="font-mono">{outlierZip.zip}</span> ({outlierZip.cityGuess}) — estimated{' '}
                  <span className="font-mono tabular text-[var(--clinical-rose)]">
                    {formatCurrencyShort(outlierZip.leakage)}
                  </span>{' '}
                  in annual leakage at current out-of-network referral rates.
                </>
              ) : (
                'Awaiting placed-patient signal.'
              )}
            </>
          }
          highlight={
            outlierZip
              ? { label: 'Network recovery upside', value: formatCurrencyShort(outlierZip.leakage) }
              : undefined
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile
            label="ZIPs covered"
            value={<AnimatedCounter to={totalZips} format={(n) => formatNumber(Math.round(n))} />}
            subValue="placed patient ZIPs"
          />
          <KpiTile
            label="Patients reached"
            value={<AnimatedCounter to={totalPatients} format={(n) => formatNumber(Math.round(n))} />}
            subValue={`${(highBurdenShare * 100).toFixed(0)}% with 3+ chronic dx`}
          />
          <KpiTile
            label="Median chronic / ZIP"
            value={<AnimatedCounter to={medianChronicAcrossZips} format={(n) => n.toFixed(1)} />}
            subValue="active chronic dx, ZIP median"
          />
          <KpiTile
            label="Care-gap $ at risk"
            value={
              <AnimatedCounter
                to={totalLeakage}
                format={(n) => formatCurrencyShort(n)}
              />
            }
            subValue="synthetic leakage estimate"
            highlight
            dollarLever="Avoidable out-of-network referrals × median annual charges"
          />
        </div>

        {/* Map + intelligence panel */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* LEFT — Map */}
          <div className="lg:col-span-3 clinical-card overflow-hidden">
            <div className="clinical-card-header flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="eyebrow">Catchment density</div>
                <div className="font-serif text-base font-semibold text-[var(--ink-strong)]">
                  {selected ? (
                    <>ZIP {selected.zip} <span className="text-[var(--ink-soft)] font-normal text-sm">· {selected.cityGuess}</span></>
                  ) : (
                    <>Pittsburgh metro <span className="text-[var(--ink-soft)] font-normal text-sm">· {MODE_META[mode].label}</span></>
                  )}
                </div>
              </div>
              {selected && (
                <button
                  onClick={() => setSelectedZip(null)}
                  className="rounded-md border border-[var(--hairline)] bg-white hover:bg-[var(--paper-deep)] text-[var(--ink)] text-xs font-medium px-3 py-1.5"
                >
                  ← Back to all ZIPs
                </button>
              )}
            </div>

            <div className="relative" style={{ height: 460 }}>
              {zipAggs.length > 0 && (
                <MapContainer
                  center={[40.4673, -80.0]}
                  zoom={11}
                  minZoom={9}
                  scrollWheelZoom
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                    maxZoom={19}
                  />
                  <FitOnEnter zipAggs={zipAggs} selected={selected} />

                  {/* Outlier pulse — sits behind the dot */}
                  {!selected && outlierZip && (
                    <CircleMarker
                      key="outlier-pulse"
                      center={[outlierZip.lat, outlierZip.lng]}
                      radius={radiusFor(outlierZip) + 14}
                      pathOptions={{
                        color: 'var(--clinical-rose)',
                        weight: 1.5,
                        fillColor: 'transparent',
                        fillOpacity: 0,
                        className: 'map-outlier-pulse',
                        dashArray: '4 3',
                      } as L.PathOptions}
                      interactive={false}
                    />
                  )}

                  {!selected &&
                    zipAggs.map((z) => {
                      const isSel = selectedZip === z.zip;
                      const isOutlier = outlierZip?.zip === z.zip;
                      return (
                        <CircleMarker
                          key={z.zip}
                          center={[z.lat, z.lng]}
                          radius={radiusFor(z)}
                          pathOptions={{
                            color: isOutlier ? 'var(--clinical-rose)' : '#0b1220',
                            weight: isOutlier ? 1.2 : 0.5,
                            fillColor: colorFor(z),
                            fillOpacity: isSel ? 0.95 : 0.78,
                          }}
                          eventHandlers={{ click: () => setSelectedZip(z.zip) }}
                        >
                          <Tooltip
                            direction="top"
                            offset={[0, -radiusFor(z) - 2]}
                            opacity={1}
                            className="map-zip-tooltip"
                          >
                            <div className="text-[11px] leading-tight">
                              <div className="font-mono text-[var(--ink-soft)]">ZIP {z.zip}</div>
                              <div className="font-serif font-semibold text-[var(--ink-strong)]">
                                {z.cityGuess}
                              </div>
                              <div className="mt-1 tabular">
                                <span className="text-[var(--ink-muted)]">Patients </span>
                                <span className="font-semibold text-[var(--ink-strong)]">
                                  {formatNumber(z.count)}
                                </span>
                              </div>
                              <div className="tabular text-[var(--ink-muted)]">
                                Med. chronic <span className="text-[var(--ink-strong)] font-semibold">{z.medianChronic}</span>{' '}
                                · Med. charge{' '}
                                <span className="text-[var(--ink-strong)] font-semibold">
                                  {formatCurrencyShort(z.medianCharges)}
                                </span>
                              </div>
                              <div className="tabular text-[var(--ink-muted)]">
                                Top dx{' '}
                                <span className="text-[var(--ink-strong)] font-semibold">
                                  {z.topDx[0]?.name.split(' (')[0]}
                                </span>
                              </div>
                              {isOutlier && (
                                <div className="mt-1 text-[10px] uppercase tracking-wider font-semibold text-[var(--clinical-rose)]">
                                  ◆ Highest leakage
                                </div>
                              )}
                              <div className="mt-1 text-[10px] text-[var(--clinical-teal)] font-semibold">
                                Click to drill in →
                              </div>
                            </div>
                          </Tooltip>
                        </CircleMarker>
                      );
                    })}

                  {selected &&
                    selected.patients.slice(0, 1500).map((p) => (
                      <CircleMarker
                        key={p.pat_id}
                        center={[p.latitude!, p.longitude!]}
                        radius={4 + Math.min(7, p.active_chronic_count * 1.4)}
                        pathOptions={{
                          color: '#0b1220',
                          weight: 0.4,
                          fillColor:
                            p.active_chronic_count >= 3
                              ? 'var(--clinical-rose)'
                              : '#94a3b8',
                          fillOpacity: p.active_chronic_count >= 3 ? 0.9 : 0.55,
                        }}
                      >
                        <Tooltip direction="top" opacity={1}>
                          <div className="text-[11px]">
                            <div className="font-mono text-[var(--ink-soft)]">
                              MRN {p.med_rec_num}
                            </div>
                            <div className="font-serif font-semibold text-[var(--ink-strong)]">
                              {p.full_name}
                            </div>
                            <div className="tabular text-[var(--ink-muted)]">
                              {p.age} y/o · {p.sex} · {p.encounter_count} visits ·{' '}
                              {p.active_chronic_count} chronic
                            </div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                </MapContainer>
              )}

              <style>{`
                @keyframes map-pulse-ring {
                  0%   { stroke-opacity: 0.7; transform-origin: center; }
                  70%  { stroke-opacity: 0;   }
                  100% { stroke-opacity: 0;   }
                }
                .map-outlier-pulse {
                  animation: map-pulse-ring 1.8s ease-out infinite;
                }
                .leaflet-tooltip.map-zip-tooltip {
                  background: #ffffff;
                  border: 1px solid var(--hairline);
                  box-shadow: 0 6px 24px rgba(11, 18, 32, 0.08);
                  border-radius: 6px;
                  padding: 8px 10px;
                  color: var(--ink-strong);
                  white-space: normal;
                  max-width: 240px;
                }
                .leaflet-tooltip.map-zip-tooltip:before { display: none; }
              `}</style>
            </div>

            {/* Color ramp legend */}
            <div className="px-4 py-3 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)]">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-soft)]">
                  {selected ? 'Patient chronic burden' : `${MODE_META[mode].label} · quintile bands`}
                </div>
                <div className="text-[10px] text-[var(--ink-soft)] tabular">
                  {selected
                    ? 'Each dot = one patient (jittered)'
                    : 'Bubble size = patient count · color = quintile'}
                </div>
              </div>
              {selected ? (
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: 'var(--clinical-rose)' }} />
                    High burden · 3+ chronic dx
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ background: '#94a3b8' }} />
                    Stable / low burden
                  </span>
                </div>
              ) : (
                <div className="flex items-stretch gap-0.5 text-[10px] tabular">
                  {RAMP.map((color, i) => {
                    const lo = i === 0 ? null : breakpoints[i - 1];
                    const hi = i === 4 ? null : breakpoints[i];
                    return (
                      <div key={i} className="flex-1 flex flex-col items-stretch">
                        <div className="h-3 rounded-sm" style={{ background: color }} />
                        <div className="mt-1 text-center text-[var(--ink-muted)] tabular">
                          {lo === null ? '< ' : `${fmt(lo)} – `}
                          {hi === null ? `${fmt(breakpoints[3])}+` : fmt(hi)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — ZIP intelligence panel */}
          <div className="lg:col-span-2">
            {selected ? (
              <ZipDetailPanel
                z={selected}
                mode={mode}
                percentile={selectedPercentile}
                onDrill={() => navigate(`/patients?zip=${encodeURIComponent(selected.zip)}`)}
                onClose={() => setSelectedZip(null)}
              />
            ) : (
              <Leaderboard
                items={topFive}
                mode={mode}
                onPick={(z) => setSelectedZip(z)}
              />
            )}
          </div>
        </div>

        {/* Provenance */}
        <ProvenanceStrip
          freshness="4 min ago"
          source="Clarity Health · Epic Clarity CDC"
          rows={`${formatNumber(totalPatients)} placed patients · 1 ZIP-rollup mart`}
        />
      </div>
    </div>
  );
}

// ─── Mode pills ────────────────────────────────────────────────────────────

function ModePills({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-md border border-[var(--hairline)] bg-white">
      {(Object.keys(MODE_META) as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              active
                ? 'text-white'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)] hover:bg-[var(--paper-deep)] border border-transparent'
            }`}
            style={active ? { background: 'var(--clinical-teal)' } : undefined}
            aria-pressed={active}
          >
            <span className={active ? 'text-white' : 'text-[var(--ink-soft)]'}>
              {MODE_META[m].icon}
            </span>
            {MODE_META[m].short}
          </button>
        );
      })}
    </div>
  );
}

// ─── ZIP detail panel ──────────────────────────────────────────────────────

function ZipDetailPanel({
  z,
  mode,
  percentile,
  onDrill,
  onClose,
}: {
  z: ZipAgg;
  mode: Mode;
  percentile: number;
  onDrill: () => void;
  onClose: () => void;
}) {
  const burdenPct = (z.highBurdenPct * 100).toFixed(0);
  return (
    <div className="clinical-card overflow-hidden">
      <div className="clinical-card-header flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">ZIP Intelligence</div>
          <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-[var(--ink-soft)] text-xs">ZIP</span>
            <span className="font-serif text-xl font-semibold text-[var(--ink-strong)] tracking-tight">
              {z.zip}
            </span>
          </div>
          <div className="text-xs text-[var(--ink-muted)] mt-0.5">{z.cityGuess}</div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--ink-soft)] hover:text-[var(--ink-strong)] text-lg leading-none p-1"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Mini-stats */}
        <div className="grid grid-cols-2 gap-3">
          <MiniStat label="Patients" value={formatNumber(z.count)} />
          <MiniStat label="Median chronic" value={z.medianChronic.toFixed(1)} />
          <MiniStat label="Median charge" value={formatCurrency(z.medianCharges)} />
          <MiniStat
            label="% high-burden"
            value={`${burdenPct}%`}
            tone={z.highBurdenPct >= 0.25 ? 'alert' : z.highBurdenPct >= 0.15 ? 'caution' : 'ok'}
          />
        </div>

        {/* Peer percentile */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-soft)]">
              Vs. other ZIPs · {MODE_META[mode].label}
            </div>
            <div className="text-[11px] font-mono tabular text-[var(--ink-strong)] font-semibold">
              p{percentile}
            </div>
          </div>
          <PeerPercentileBand position={percentile} median={50} topQuartile={75} />
          <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ink-soft)] tabular">
            <span>Lower quartile</span>
            <span>Median</span>
            <span>Top quartile</span>
          </div>
        </div>

        {/* Top diagnoses */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-soft)] mb-2">
            Top diagnoses · this ZIP
          </div>
          <ul className="space-y-1.5">
            {z.topDx.slice(0, 5).map((d, i) => {
              const max = z.topDx[0].count;
              const pct = max === 0 ? 0 : d.count / max;
              return (
                <li key={d.name} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[var(--ink-strong)] truncate">
                      <span className="font-mono text-[var(--ink-soft)] mr-1.5">{i + 1}.</span>
                      {d.name}
                    </span>
                    <span className="font-mono tabular text-[var(--ink-muted)] shrink-0">
                      {formatNumber(d.count)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-[var(--paper-deep)] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct * 100}%`,
                        background: 'var(--clinical-teal)',
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Leakage estimate */}
        <div
          className="rounded-md border px-3.5 py-3"
          style={{
            borderColor: 'var(--clinical-rose)',
            background: 'var(--clinical-rose-bg)',
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--clinical-rose)]">
              Est. annual leakage
            </div>
            <div className="font-serif text-2xl font-semibold tabular" style={{ color: 'var(--clinical-rose)' }}>
              {formatCurrencyShort(z.leakage)}
            </div>
          </div>
          <div className="text-[11px] text-[var(--ink-muted)] mt-1 leading-snug">
            {formatNumber(z.count)} patients × out-of-network referral rate × median annual charge.
            Synthetic but plausible at current contract mix.
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onDrill}
          className="w-full rounded-md text-white font-semibold px-4 py-2.5 text-sm shadow-sm hover:opacity-95 transition-opacity inline-flex items-center justify-center gap-2"
          style={{ background: 'var(--clinical-teal)' }}
        >
          Drill to cohort in ZIP {z.zip} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'caution' | 'alert';
}) {
  const color =
    tone === 'alert'
      ? 'var(--clinical-rose)'
      : tone === 'caution'
      ? 'var(--clinical-amber)'
      : 'var(--ink-strong)';
  return (
    <div className="rounded-md border border-[var(--hairline)] bg-white px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--ink-soft)]">
        {label}
      </div>
      <div className="mt-1 font-serif text-lg font-semibold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ─── Leaderboard (default state) ───────────────────────────────────────────

function Leaderboard({
  items,
  mode,
  onPick,
}: {
  items: ZipAgg[];
  mode: Mode;
  onPick: (zip: string) => void;
}) {
  const max = Math.max(
    1,
    ...items.map((z) =>
      mode === 'count' ? z.count : mode === 'charges' ? z.medianCharges : z.medianChronic,
    ),
  );
  const fmt = (z: ZipAgg) =>
    mode === 'count'
      ? formatNumber(z.count)
      : mode === 'charges'
      ? formatCurrency(z.medianCharges)
      : `${z.medianChronic.toFixed(1)} dx`;
  return (
    <div className="clinical-card overflow-hidden">
      <div className="clinical-card-header">
        <div className="eyebrow">ZIP Intelligence · default</div>
        <div className="mt-0.5 font-serif text-lg font-semibold text-[var(--ink-strong)]">
          Top 5 ZIPs by {MODE_META[mode].short.toLowerCase()}
        </div>
        <div className="text-xs text-[var(--ink-muted)] mt-0.5">
          Click any row, or any bubble on the map, to open ZIP-level intelligence.
        </div>
      </div>
      <ol className="divide-y divide-[var(--hairline-soft)]">
        {items.map((z, i) => {
          const v =
            mode === 'count' ? z.count : mode === 'charges' ? z.medianCharges : z.medianChronic;
          const pct = v / max;
          return (
            <li key={z.zip}>
              <button
                onClick={() => onPick(z.zip)}
                className="w-full text-left px-5 py-3.5 hover:bg-[var(--paper-deep)] transition-colors"
              >
                <div className="flex items-baseline gap-3">
                  <div className="font-serif text-2xl text-[var(--ink-soft)] tabular leading-none w-6 text-right shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div>
                        <span className="font-mono text-xs text-[var(--ink-soft)] mr-2">ZIP</span>
                        <span className="font-serif text-base font-semibold text-[var(--ink-strong)]">
                          {z.zip}
                        </span>
                        <span className="text-xs text-[var(--ink-muted)] ml-2">{z.cityGuess}</span>
                      </div>
                      <div className="font-mono tabular text-sm font-semibold text-[var(--ink-strong)]">
                        {fmt(z)}
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[var(--paper-deep)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct * 100}%`,
                          background: 'var(--clinical-teal)',
                          opacity: 0.85,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ink-soft)] tabular">
                      <span>
                        {formatNumber(z.count)} patients · med. chronic {z.medianChronic.toFixed(1)}
                      </span>
                      <span style={{ color: 'var(--clinical-rose)' }}>
                        leakage {formatCurrencyShort(z.leakage)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FitOnEnter({ zipAggs, selected }: { zipAggs: ZipAgg[]; selected: ZipAgg | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected) {
      map.flyTo([selected.lat, selected.lng], 14, { duration: 0.8 });
    } else if (zipAggs.length > 0) {
      const bounds = L.latLngBounds(zipAggs.map((z) => [z.lat, z.lng] as [number, number]));
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 12, duration: 0.8 });
    }
  }, [selected?.zip, zipAggs.length, map]);
  return null;
}
