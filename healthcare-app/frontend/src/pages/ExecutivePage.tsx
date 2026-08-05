// Executive Cockpit — the page a hospital/IDN CEO opens with their coffee.
//
// Every tile on this page is operationally consequential and tied to a $-lever
// on the P&L, a rating-agency input, a CMS reimbursement program, or working
// capital. Benchmarks are sourced from Kaufman Hall Sept 2025 flash report,
// Moody's FY24 NFP hospital medians, NSI 2025 turnover report, HFMA, ACEP,
// and CMS HRRP. See research dossier for citations.

import { useNavigate } from 'react-router-dom';
import {
  AnimatedCounter,
  KpiTile,
  NarrativeCard,
  OpportunityFeed,
  ProvenanceStrip,
  RevenueWaterfall,
  VarianceBar,
} from '../components/Executive';

const spark = (vals: number[]) => vals;

export default function ExecutivePage() {
  const navigate = useNavigate();

  // The 10 tiles a CEO actually opens with coffee. Ranked by what would get
  // a board call if it moved 5 percent.
  const tiles = [
    {
      label: 'Operating EBITDA Margin · YTD',
      value: '4.6%',
      subValue: 'rolling 12-mo',
      delta: { value: '+ 80 bps', trend: 'good' as const, vs: 'vs prior year' },
      spark: spark([2.9, 3.1, 3.3, 3.4, 3.6, 3.8, 4.0, 4.2, 4.3, 4.4, 4.5, 4.6]),
      peer: { position: 62, median: 50, topQuartile: 78 },
      benchmark: 'Median 1.7% · Top Q 7%',
      dollarLever: 'Every 100 bps on $1.4B net revenue = $14M to bottom line. Each rating notch swing ≈ $1.8M/yr in borrowing cost.',
      badge: 'Investment grade',
      badgeTone: 'healthy' as const,
      highlight: true,
    },
    {
      label: 'Days Cash on Hand',
      value: '218',
      delta: { value: '+ 14 days', trend: 'good' as const, vs: 'vs Jan' },
      spark: spark([195, 198, 201, 199, 204, 208, 211, 213, 215, 216, 217, 218]),
      peer: { position: 55, median: 50, topQuartile: 82 },
      benchmark: 'Median 194 · Aa 282',
      dollarLever: 'Each +10 days on $2B expense base = ~$55M unrestricted liquidity. Hard covenant trigger <100.',
    },
    {
      label: 'Initial Denial Rate · 30-day',
      value: '8.4%',
      delta: { value: '− 1.2 pts', trend: 'good' as const, vs: 'vs prior 90d' },
      spark: spark([11.8, 11.4, 11.1, 10.6, 10.2, 9.8, 9.4, 9.1, 8.9, 8.7, 8.6, 8.4]),
      peer: { position: 62, median: 50, topQuartile: 78, invert: true },
      benchmark: 'Median 9–12% · Top Q <5%',
      dollarLever: 'Every 1 pt reduction ≈ $8–10M incremental net patient revenue on $1B base. Clinical denials up 12% YoY industry-wide.',
      badge: 'Top opportunity',
      badgeTone: 'caution' as const,
    },
    {
      label: 'AR Days · Net',
      value: '42.1',
      delta: { value: '− 2.6 days', trend: 'good' as const, vs: 'vs Q1' },
      spark: spark([46.5, 46.0, 45.2, 44.6, 44.1, 43.6, 43.2, 42.9, 42.7, 42.4, 42.3, 42.1]),
      peer: { position: 64, median: 50, topQuartile: 78, invert: true },
      benchmark: 'Median 45 · Top Q <40',
      dollarLever: 'Each −1 day on $1B net revenue = ~$2.7M cash freed. Treasury reviews weekly — feeds the liquidity forecast.',
    },
    {
      label: 'Premium / Contract Labor',
      value: '3.1%',
      subValue: 'of total labor expense',
      delta: { value: '− 0.7 pts', trend: 'good' as const, vs: 'vs Q4' },
      spark: spark([6.4, 6.0, 5.6, 5.2, 4.9, 4.6, 4.3, 4.0, 3.8, 3.5, 3.3, 3.1]),
      peer: { position: 58, median: 50, topQuartile: 80, invert: true },
      benchmark: 'Median 3.5% · Top Q <2.5%',
      dollarLever: 'Each −1 pt on $600M labor base = $6M direct expense save. Biggest single recoverable bucket post-2022.',
    },
    {
      label: 'RN Turnover · Rolling 12',
      value: '14.8%',
      delta: { value: '− 3.0 pts', trend: 'good' as const, vs: 'vs LY' },
      spark: spark([17.8, 17.5, 17.1, 16.7, 16.4, 16.0, 15.7, 15.5, 15.2, 15.1, 14.9, 14.8]),
      peer: { position: 66, median: 50, topQuartile: 82, invert: true },
      benchmark: 'National 17.6% · NSI 2025',
      dollarLever: 'Replacement cost = $60K/RN. On 2,000 RN base, 3-pt drop = ~60 fewer departures = $3.6M/yr saved.',
    },
    {
      label: 'CMI-Adjusted ALOS · O/E',
      value: '0.94',
      subValue: 'obs/expected vs GMLOS',
      delta: { value: '− 0.06', trend: 'good' as const, vs: 'vs target 1.00' },
      spark: spark([1.04, 1.03, 1.02, 1.01, 1.00, 0.99, 0.98, 0.97, 0.96, 0.95, 0.94, 0.94]),
      peer: { position: 70, median: 50, topQuartile: 82, invert: true },
      benchmark: 'Top decile ≤0.90',
      dollarLever: 'Each −0.1 day on 25K discharges = $8–12M variable cost + backfilled throughput revenue.',
    },
    {
      label: 'ED Boarding · median min',
      value: '146',
      delta: { value: '+ 18 min', trend: 'bad' as const, vs: 'vs target 120' },
      spark: spark([122, 126, 128, 131, 134, 136, 138, 140, 141, 143, 145, 146]),
      peer: { position: 28, median: 50, topQuartile: 78, invert: true },
      benchmark: 'CMS public-reported 2025',
      dollarLever: 'Each −1 hr cuts LWBS ~15%. On a 70K-visit ED that\'s 1,500 visits × $1.2K CM = $1.8M.',
      badge: 'Action required',
      badgeTone: 'alert' as const,
    },
    {
      label: '30-day Readmission · HRRP',
      value: '14.2%',
      delta: { value: '− 0.4 pts', trend: 'good' as const, vs: 'vs LY' },
      spark: spark([15.4, 15.2, 15.0, 14.9, 14.8, 14.7, 14.6, 14.5, 14.4, 14.3, 14.2, 14.2]),
      peer: { position: 60, median: 50, topQuartile: 78, invert: true },
      benchmark: 'National 15.5%',
      dollarLever: 'Avoiding 1% IPPS penalty on $300M Medicare base = $3M/yr. 78% of US hospitals carry an HRRP penalty in FY26.',
    },
    {
      label: 'HCAHPS · Summary Star',
      value: '4',
      subValue: 'of 5 · composite',
      delta: { value: '+ 0.3', trend: 'good' as const, vs: 'vs LY composite' },
      spark: spark([3.5, 3.5, 3.6, 3.6, 3.6, 3.7, 3.7, 3.8, 3.8, 3.9, 3.9, 4.0]),
      peer: { position: 72, median: 50, topQuartile: 88 },
      benchmark: 'Median 3 · 5★ ≈ top 10%',
      dollarLever: '4★ vs 3★ on $300M Medicare IPPS ≈ +$1.5–3M in VBP redistribution. HCAHPS = ~25% of VBP score.',
    },
  ];

  const opportunities = [
    {
      rank: 1,
      title: 'Denial-Prevention: Coding Specificity (DRG 470)',
      impact: '$4.2M',
      impactSub: 'annualized net revenue',
      evidence: '847 joint-replacement cases with non-specific principal dx in last 90 days; payer downcode rate 14% (peer 4%).',
      confidence: 87,
      tags: ['Revenue cycle', 'Coding', 'Ortho'],
    },
    {
      rank: 2,
      title: 'Discharge-Before-Noon · Med/Surg',
      impact: '$3.6M',
      impactSub: 'ALOS + ED throughput',
      evidence: 'Current 18% DBN; lifting to 30% on 14K discharges yields 0.18 ALOS reduction → 2,520 backfilled days.',
      confidence: 81,
      tags: ['Throughput', 'Capacity', 'Inpatient'],
    },
    {
      rank: 3,
      title: 'OR Prime-Time Utilization · Block Reallocation',
      impact: '$2.8M',
      impactSub: 'contribution margin',
      evidence: '6 surgeons under-utilizing weekly blocks (<70% used). Reallocating to oversubscribed CV team = +1,400 OR-min/wk.',
      confidence: 92,
      tags: ['OR', 'Capital asset', 'CV'],
    },
    {
      rank: 4,
      title: 'Specialty Referral Keepage · Cardiology',
      impact: '$2.1M',
      impactSub: 'in-network capture',
      evidence: '38% of PCP cardiology referrals leaked out-of-system in last 6 months (vs 22% peer). Routing rules misconfigured.',
      confidence: 76,
      tags: ['Leakage', 'Cardiology', 'Network'],
    },
    {
      rank: 5,
      title: 'POS Self-Pay Collections · Pre-Service',
      impact: '$1.4M',
      impactSub: 'cash earlier + bad-debt avoidance',
      evidence: 'POS collections at 21%; top-quartile peers >35%. Closing a 7-pt gap on $200M patient liability accelerates ~$14M of cash and prevents ~$1.4M of bad-debt write-offs.',
      confidence: 83,
      tags: ['Revenue cycle', 'Self-pay', 'HDHP'],
    },
  ];

  // YTD service-line variance to budget, $M. Negative = under budget.
  const variance = [
    { label: 'Cardiology · CV surgery', variance: 4.2, unit: 'M' },
    { label: 'Orthopedics · joint', variance: 3.1, unit: 'M' },
    { label: 'Oncology · infusion', variance: 1.4, unit: 'M' },
    { label: 'Neurosurgery', variance: 0.8, unit: 'M' },
    { label: 'OB · women\'s health', variance: -0.6, unit: 'M' },
    { label: 'General medicine', variance: -1.9, unit: 'M' },
    { label: 'Behavioral health', variance: -2.4, unit: 'M' },
  ];

  // Revenue waterfall — gross to net, in $M annualized
  const waterfall = [
    { label: 'Gross charges', value: 4180, kind: 'total' as const },
    { label: 'Contractual adj', value: -2520, kind: 'neg' as const },
    { label: 'Denials', value: -148, kind: 'neg' as const },
    { label: 'Bad debt', value: -86, kind: 'neg' as const },
    { label: 'Charity', value: -44, kind: 'neg' as const },
    { label: 'Net patient rev', value: 1382, kind: 'total' as const },
  ];

  return (
    <>
      {/* Hero strip — light, institutional */}
      <section className="bg-white border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div>
              <div className="eyebrow mb-2">Executive Cockpit · CEO View</div>
              <h1 className="font-serif text-3xl sm:text-4xl font-semibold leading-tight text-[var(--ink-strong)] tracking-tight">
                Memorial Health · System Performance
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-muted)] max-w-3xl leading-relaxed">
                The ten measures that drive operating margin, cost of capital, and reimbursement risk —
                with peer percentiles and dollar-impact context. Built on Clarity Health EHR · Fivetran · Snowflake.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="font-mono text-[11px] text-[var(--ink-soft)] tabular">
                FY26 · Q3 · Week ending May 15, 2026
              </div>
              <div className="rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] px-3 py-1.5 text-[11px] tabular text-[var(--ink-muted)] flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--clinical-green)] animate-pulse" />
                <span className="font-semibold text-[var(--ink-strong)]">$1.38B</span>
                <span>net patient revenue · annualized</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Auto-narrative — what changed since last week */}
        <NarrativeCard
          eyebrow="This week · auto-summary"
          highlight={{ label: 'Margin lift', value: '+60 bps' }}
          story={
            <>
              Operating margin lifted{' '}
              <span className="font-semibold text-[var(--clinical-green)]">60 bps to 4.6%</span>{' '}
              this period, led by a{' '}
              <span className="font-semibold">0.7-point drop in agency labor</span>{' '}
              at the Memorial campus and a{' '}
              <span className="font-semibold">1.2-point reduction in initial denial rate</span>.
              ED boarding remains the standout outlier at 146 min vs. 120 min target — see opportunity feed.
            </>
          }
        />

        {/* The 10 CEO tiles */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="eyebrow mb-1">Single pane of glass · 10 metrics</div>
              <h2 className="font-serif text-xl font-semibold text-[var(--ink-strong)]">
                Margin, cash, capacity, workforce, quality
              </h2>
            </div>
            <div className="text-[11px] text-[var(--ink-soft)] tabular hidden sm:block">
              Peer benchmarks: Kaufman Hall · Moody's · NSI · CMS HRRP
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tiles.map((t, i) => (
              <KpiTile key={i} {...t} />
            ))}
            {/* 11th tile — Snowflake compute spend story for the booth narrative */}
            <KpiTile
              label="Snowflake compute · YTD"
              value="$58.4K"
              subValue="elastic · auto-suspend"
              delta={{ value: '− 96%', trend: 'good', vs: 'vs legacy DW $1.6M' }}
              spark={spark([78, 74, 72, 70, 68, 66, 64, 62, 61, 60, 59, 58])}
              peer={{ position: 86, median: 50, topQuartile: 78 }}
              benchmark="Industry $0.8–1.5M / yr"
              dollarLever="Retiring the on-prem Oracle warehouse + Snowflake elastic compute = $1.6M/yr operating expense reduction."
              badge="Cloud finance"
              badgeTone="info"
            />
            <KpiTile
              label="Data freshness · Clarity → marts"
              value={<AnimatedCounter to={4.2} format={(n) => `${n.toFixed(1)} min`} />}
              delta={{ value: '99.7% SLA', trend: 'good', vs: 'rolling 30d' }}
              spark={spark([7.2, 6.8, 6.4, 6.1, 5.8, 5.4, 5.1, 4.9, 4.6, 4.4, 4.3, 4.2])}
              peer={{ position: 92, median: 50, topQuartile: 80 }}
              benchmark="Batch ETL · 4–24 hr"
              dollarLever="Every 30 minutes of pipeline lag delays denial-write-off recovery and ED throughput dashboards. Sub-5-min replication is the operational floor for real-time RCM and capacity decisions."
              badge="Fivetran · live"
              badgeTone="info"
            />
          </div>
        </section>

        {/* Opportunity feed + Variance + Waterfall — bottom band */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <OpportunityFeed items={opportunities} />
          </div>
          <div className="space-y-5">
            <div className="clinical-card overflow-hidden">
              <div className="clinical-card-header">
                <div className="eyebrow">Service-Line Variance · YTD</div>
                <div className="font-serif font-semibold text-[var(--ink-strong)] mt-0.5">Actual vs. budget, $M</div>
              </div>
              <div className="p-5">
                <VarianceBar rows={variance} />
              </div>
              <div className="px-5 py-2.5 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)] text-[11px] text-[var(--ink-muted)] leading-relaxed">
                <span className="font-semibold text-[var(--ink-strong)]">$ Lever ·</span> Behavioral
                health drag is workforce-driven (locum coverage); reclaim half = $1.2M.
              </div>
            </div>

            <div className="clinical-card overflow-hidden">
              <div className="clinical-card-header">
                <div className="eyebrow">Revenue Waterfall · Annualized</div>
                <div className="font-serif font-semibold text-[var(--ink-strong)] mt-0.5">Gross to net, $M</div>
              </div>
              <div className="p-5">
                <RevenueWaterfall steps={waterfall} />
              </div>
              <div className="px-5 py-2.5 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)] text-[11px] text-[var(--ink-muted)] leading-relaxed">
                <span className="font-semibold text-[var(--clinical-rose)]">Denial bucket ·</span>{' '}
                $148M in denied charges = $89M ultimately written off after appeals. Top of the opportunity feed.
              </div>
            </div>
          </div>
        </section>

        {/* Provenance — the Snowflake + Fivetran story underneath */}
        <ProvenanceStrip
          freshness="4.2 min ago"
          source="Clarity Health · Epic Clarity CDC · 8 tables"
          rows="JASON_CHLETSOS_EPIC · 4 mart schemas · 21 dbt Labs models"
          ctaTo={() => navigate('/pipeline')}
          fivetranUrl="https://fivetran.com/dashboard/connections/sanctity_finally/status"
        />

        {/* Method note — booth visitors will read this */}
        <div className="rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] p-4 text-[11px] text-[var(--ink-muted)] leading-relaxed">
          <span className="font-semibold text-[var(--ink-strong)]">Method note ·</span>{' '}
          Benchmarks from Kaufman Hall <em>National Hospital Flash Report</em> (Sep 2025), Moody's
          FY24 NFP hospital medians, NSI Nursing Solutions 2025 retention report, HFMA, ACEP boarding
          guidance, and CMS HRRP FY26 final rule. Dollar levers modeled for a representative ~$1.4B
          net-revenue, ~500-bed acute system. Synthetic patient data; no PHI.
        </div>
      </div>
    </>
  );
}
