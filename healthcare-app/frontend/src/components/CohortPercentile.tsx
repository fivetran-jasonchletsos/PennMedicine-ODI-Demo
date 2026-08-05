import { useEffect, useMemo, useState } from 'react';
import { api, formatCurrency, formatNumber } from '../api/queries';
import type { PatientSearchResult } from '../types';

interface Props {
  patId: string;
  age: number;
  sex: string;
  encounters: number;
  charges: number;
  chronic: number;
}

// "Where does this patient sit vs. peers in their age decade + sex cohort?"
// Mirrors the sheetz Neighborhood Percentile widget. Lives entirely
// client-side over the published snapshot — no Snowflake roundtrip.
export default function CohortPercentile({ patId, age, sex, encounters, charges, chronic }: Props) {
  const [peers, setPeers] = useState<PatientSearchResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.searchPatients({ limit: 200000 }).then((r) => {
      if (cancelled) return;
      const decade = Math.floor(age / 10) * 10;
      const filtered = r.results.filter((p) => p.sex === sex && Math.floor(p.age / 10) * 10 === decade && p.pat_id !== patId);
      setPeers(filtered);
    });
    return () => { cancelled = true; };
  }, [age, sex, patId]);

  const stats = useMemo(() => {
    if (!peers || peers.length === 0) return null;
    // Rank this patient against the PEER distribution only — injecting the
    // patient's own value would count them at/above themselves and overstate
    // every percentile (worst for small cohorts).
    const encs = peers.map((p) => p.encounter_count).sort((a, b) => a - b);
    const chs = peers.map((p) => p.total_charges).sort((a, b) => a - b);
    const chrs = peers.map((p) => p.active_chronic_count).sort((a, b) => a - b);

    const pct = (vals: number[], v: number) => {
      const rank = vals.filter((x) => x <= v).length;
      return (rank / vals.length) * 100;
    };
    const med = (vals: number[]) => vals[Math.floor(vals.length / 2)];

    return {
      n: peers.length,
      encounterPct: pct(encs, encounters),
      chargesPct:   pct(chs, charges),
      chronicPct:   pct(chrs, chronic),
      medianEnc:    med(encs),
      medianCharges: med(chs),
      medianChronic: med(chrs),
    };
  }, [peers, encounters, charges, chronic]);

  if (!stats || stats.n < 5) return null;

  const cohortLabel = `${Math.floor(age / 10) * 10}s · ${sex === 'M' ? 'male' : sex === 'F' ? 'female' : sex}`;

  return (
    <section className="clinical-card overflow-hidden">
      <header className="clinical-card-header">
        <div className="eyebrow">Cohort Percentile</div>
        <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Where this patient ranks</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Among {formatNumber(stats.n)} peers in the same age + sex cohort ({cohortLabel}). Tick is cohort median.
        </p>
      </header>
      <div className="p-5 space-y-4">
        <Row
          label="Encounters"
          mine={encounters}
          median={stats.medianEnc}
          pct={stats.encounterPct}
          fmt={formatNumber}
        />
        <Row
          label="Annual charges"
          mine={charges}
          median={stats.medianCharges}
          pct={stats.chargesPct}
          fmt={formatCurrency}
        />
        <Row
          label="Chronic conditions"
          mine={chronic}
          median={stats.medianChronic}
          pct={stats.chronicPct}
          fmt={formatNumber}
        />
      </div>
    </section>
  );
}

function Row({ label, mine, median, pct, fmt }: { label: string; mine: number; median: number; pct: number; fmt: (n: number) => string }) {
  const above = mine >= median;
  const aboveMuch = pct >= 75;
  // Reserve color for the one thing worth highlighting — being in the upper
  // quartile of utilization or burden vs cohort.
  const valueColor = aboveMuch ? 'text-[var(--clinical-rose)]' : 'text-[var(--ink-strong)]';
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">{label}</span>
        <span className="text-sm tabular">
          <strong className={valueColor}>{fmt(mine)}</strong>
          <span className="text-[var(--ink-soft)]"> · median {fmt(median)}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-sm bg-[var(--paper-deep)]">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--ink-soft)] opacity-60" />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-white"
          style={{
            left: `${Math.max(2, Math.min(98, pct))}%`,
            background: aboveMuch ? 'var(--clinical-rose)' : 'var(--clinical-teal)',
          }}
          title={`${pct.toFixed(0)}th percentile`}
        />
      </div>
      <div className={`text-[10px] mt-1 tabular ${above ? 'text-[var(--ink-muted)]' : 'text-[var(--ink-soft)]'}`}>
        {pct.toFixed(0)}th percentile · {above ? 'above' : 'below'} cohort median
      </div>
    </div>
  );
}
