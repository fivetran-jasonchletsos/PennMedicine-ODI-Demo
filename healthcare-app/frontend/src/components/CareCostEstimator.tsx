import { useMemo, useState } from 'react';
import { formatCurrency } from '../api/queries';

interface Props {
  totalCharges: number;
  encounters: number;
  payerHint?: string | null;
}

// Healthcare equivalent of the sheetz "tax estimator." Projects out-of-pocket
// cost for the next year based on encounter frequency, plan type, and copay
// estimates. All numbers are illustrative — production would pull them from
// the patient's coverage records.
const PLAN_DEFAULTS: Record<string, { coverage: number; copay: number; deductible: number }> = {
  'UPMC Health Plan': { coverage: 0.82, copay: 30, deductible: 1500 },
  'Highmark BCBS':    { coverage: 0.80, copay: 35, deductible: 2000 },
  'Aetna':            { coverage: 0.78, copay: 40, deductible: 2500 },
  'Cigna':            { coverage: 0.79, copay: 35, deductible: 2200 },
  'Medicare':         { coverage: 0.80, copay: 20, deductible: 1632 },
  'Medicaid':         { coverage: 0.95, copay: 4,  deductible: 0 },
  'Self-pay':         { coverage: 0.00, copay: 0,  deductible: 0 },
};

export default function CareCostEstimator({ totalCharges, encounters, payerHint }: Props) {
  const initialPlan = payerHint && PLAN_DEFAULTS[payerHint] ? payerHint : 'UPMC Health Plan';
  const [plan, setPlan] = useState(initialPlan);
  const [advanced, setAdvanced] = useState(false);
  const [coverage, setCoverage] = useState(PLAN_DEFAULTS[initialPlan].coverage);
  const [copay, setCopay] = useState(PLAN_DEFAULTS[initialPlan].copay);
  const [deductible, setDeductible] = useState(PLAN_DEFAULTS[initialPlan].deductible);
  const [futureVisits, setFutureVisits] = useState(Math.max(encounters, 6));

  const onPlanChange = (p: string) => {
    setPlan(p);
    const d = PLAN_DEFAULTS[p];
    setCoverage(d.coverage);
    setCopay(d.copay);
    setDeductible(d.deductible);
  };

  const projection = useMemo(() => {
    const avgPerVisit = encounters > 0 ? totalCharges / encounters : 350;
    const billed = avgPerVisit * futureVisits;
    // Deductible only applies up to what's actually billed — you can't pay a
    // $2,500 deductible against $1,800 of care.
    const deductibleApplied = Math.min(deductible, billed);
    const afterDeductible = billed - deductibleApplied;
    const insurance = afterDeductible * coverage;
    const coinsurance = afterDeductible - insurance;
    const copayTotal = futureVisits * copay;
    const oop = deductibleApplied + coinsurance + copayTotal;
    return { avgPerVisit, billed, insurance, oop, copayTotal, deductibleApplied, coinsurance };
  }, [totalCharges, encounters, futureVisits, deductible, coverage, copay]);

  // Stacked composition of the OOP — the same parts that sum to projection.oop,
  // so the bar always agrees with the headline figure.
  const totalOop = Math.max(1, projection.oop);
  const seg = [
    { key: 'Deductible', value: projection.deductibleApplied, color: '#0e7490' },
    { key: 'Coinsurance', value: projection.coinsurance, color: '#94a3b8' },
    { key: 'Copays', value: projection.copayTotal, color: '#cbd5e1' },
  ];

  return (
    <section className="clinical-card overflow-hidden">
      <header className="clinical-card-header flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Care Cost Projection</div>
          <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Annual out-of-pocket estimate</h2>
          <p className="text-xs text-[var(--ink-muted)] mt-0.5">
            Patient's projected 12-month OOP at current utilization and plan coverage. Defaults from primary payer on file.
          </p>
        </div>
        <button onClick={() => setAdvanced((v) => !v)} className="text-xs text-[var(--clinical-teal)] hover:text-[var(--ink-strong)] font-medium shrink-0">
          {advanced ? 'Hide assumptions' : 'Adjust assumptions'}
        </button>
      </header>

      <div className="p-5">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)]">Estimated OOP / year</div>
            <div className="mt-1 font-serif text-4xl font-semibold text-[var(--ink-strong)] tabular leading-none">{formatCurrency(projection.oop)}</div>
            <div className="mt-1.5 text-[11px] text-[var(--ink-soft)] tabular">
              {formatCurrency(projection.billed)} billed · {formatCurrency(projection.insurance)} covered by plan ({plan})
            </div>
          </div>
        </div>

        {/* Single composition bar, direct-labeled. Replaces three colored tiles. */}
        <div>
          <div className="h-2 w-full rounded-sm overflow-hidden flex bg-[var(--paper-deep)]">
            {seg.map((s) => (
              <div key={s.key} style={{ width: `${(s.value / totalOop) * 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-[11px]">
            {seg.map((s) => (
              <div key={s.key} className="flex items-baseline gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="text-[var(--ink-soft)] uppercase tracking-wider text-[10px] font-semibold">{s.key}</span>
                <span className="ml-auto tabular text-[var(--ink-strong)] font-medium">{formatCurrency(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {advanced && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-[var(--hairline-soft)]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">Plan</span>
              <select
                value={plan}
                onChange={(e) => onPlanChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--hairline)] px-3 py-2 text-sm"
              >
                {Object.keys(PLAN_DEFAULTS).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <NumInput label="Projected visits / yr" value={futureVisits} onChange={setFutureVisits} step={1} />
            <NumInput label="Coverage %" value={Math.round(coverage * 100)} onChange={(n) => setCoverage(n / 100)} step={1} />
            <NumInput label="Copay / visit ($)" value={copay} onChange={setCopay} step={5} />
            <NumInput label="Deductible ($)" value={deductible} onChange={setDeductible} step={100} />
          </div>
        )}

        <p className="mt-4 text-[11px] text-[var(--ink-soft)] leading-snug">
          Estimate only — actual costs depend on the patient's exact benefit design, network utilization, and any supplemental coverage.
        </p>
      </div>
    </section>
  );
}

function NumInput({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full rounded-md border border-[var(--hairline)] px-3 py-2 text-sm tabular"
      />
    </label>
  );
}
