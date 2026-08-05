// Executive cockpit + pipeline shared components.
// Each metric on this surface has a dollar-lever tie-back to the P&L,
// rating-agency math, CMS reimbursement, or working capital — never vanity.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkline } from './Sparkline';

// ─── Animated counter ───────────────────────────────────────────────────────

export function AnimatedCounter({
  to,
  duration = 1100,
  format = (n) => n.toFixed(1),
  className,
}: {
  to: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [val, setVal] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fromRef.current = val;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(fromRef.current + (to - fromRef.current) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  return <span className={className}>{format(val)}</span>;
}

// ─── Peer-percentile band ───────────────────────────────────────────────────
// Press Ganey / Premier pattern: your value as a needle, with quartile bands
// (bottom / median / top) shaded behind. `position` is 0–100.

export function PeerPercentileBand({
  position,
  median,
  topQuartile,
  height = 8,
}: {
  position: number; // 0..100 — your hospital's percentile, higher = better
  median?: number;
  topQuartile?: number;
  invert?: boolean; // accepted but ignored — convention is always higher-is-better
  height?: number;
}) {
  // Convention: `position` is "we're in the Nth percentile of peers,
  // higher = better." Same for all metrics, inverted or not — the caller
  // converts raw metric values into a "better-than" percentile. The band
  // is therefore always red-on-left (bottom quartile), green-on-right (top
  // quartile), so the needle's lateral position reads consistently.
  const p = Math.max(0, Math.min(100, position));
  return (
    <div className="relative" style={{ height: height + 12 }}>
      <div
        className="absolute left-0 right-0 rounded-full overflow-hidden border border-[var(--hairline)] flex"
        style={{ top: 6, height }}
      >
        <div style={{ flex: 25, background: 'var(--clinical-rose-bg)' }} />
        <div style={{ flex: 50, background: 'var(--clinical-amber-bg)' }} />
        <div style={{ flex: 25, background: 'var(--clinical-green-bg)' }} />
      </div>
      {median !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--ink-soft)] opacity-40"
          style={{ left: `${median}%` }}
          aria-hidden
        />
      )}
      {topQuartile !== undefined && (
        <div
          className="absolute top-0 bottom-0 w-px bg-[var(--ink-soft)] opacity-40"
          style={{ left: `${topQuartile}%` }}
          aria-hidden
        />
      )}
      {/* Your needle */}
      <div
        className="absolute"
        style={{
          left: `calc(${p}% - 6px)`,
          top: 0,
          width: 12,
          height: height + 12,
        }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-sm shadow"
          style={{
            top: 2,
            width: 3,
            height: height + 8,
            background: 'var(--ink-strong)',
          }}
        />
      </div>
    </div>
  );
}

// ─── KPI tile — the workhorse of the cockpit ────────────────────────────────

export type Trend = 'good' | 'bad' | 'flat';

export interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  subValue?: string;
  delta?: { value: string; trend: Trend; vs?: string };
  spark?: number[];
  sparkColor?: string;
  peer?: { position: number; median?: number; topQuartile?: number; invert?: boolean };
  benchmark?: string; // e.g., "Median 1.7% · Top Q 7%"
  dollarLever?: string; // e.g., "Every 1 pt = $8M net revenue"
  badge?: string;
  badgeTone?: 'healthy' | 'caution' | 'alert' | 'info';
  highlight?: boolean;
}

export function KpiTile(props: KpiTileProps) {
  const {
    label,
    value,
    subValue,
    delta,
    spark,
    sparkColor,
    peer,
    benchmark,
    dollarLever,
    badge,
    badgeTone = 'info',
    highlight,
  } = props;

  const deltaColor =
    delta?.trend === 'good'
      ? 'var(--clinical-green)'
      : delta?.trend === 'bad'
      ? 'var(--clinical-rose)'
      : 'var(--ink-soft)';
  const deltaArrow = delta?.trend === 'good' ? '▲' : delta?.trend === 'bad' ? '▼' : '◆';

  return (
    <div
      className={`clinical-card p-4 sm:p-5 relative overflow-hidden transition-shadow ${
        highlight ? 'shadow-md' : ''
      }`}
      style={
        highlight
          ? ({
              borderColor: 'var(--clinical-teal)',
              background:
                'linear-gradient(180deg, #ffffff 0%, var(--clinical-teal-bg) 220%)',
            } as CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-soft)] leading-tight">
          {label}
        </div>
        {badge && <span className={`status-pill ${badgeTone} shrink-0`}>{badge}</span>}
      </div>

      <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
        <div className="font-serif text-[34px] sm:text-[38px] font-semibold leading-none text-[var(--ink-strong)] tabular">
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-[var(--ink-soft)] tabular">{subValue}</div>
        )}
      </div>

      {(delta || spark) && (
        <div className="mt-3 flex items-center justify-between gap-3">
          {delta && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold tabular" style={{ color: deltaColor }}>
                <span className="text-[10px] mr-0.5">{deltaArrow}</span>
                {delta.value}
              </span>
              {delta.vs && (
                <span className="text-[var(--ink-soft)]">{delta.vs}</span>
              )}
            </div>
          )}
          {spark && spark.length > 1 && (
            <Sparkline
              values={spark}
              width={88}
              height={22}
              stroke={sparkColor || (delta?.trend === 'bad' ? 'var(--clinical-rose)' : 'var(--clinical-teal)')}
              fill={sparkColor || (delta?.trend === 'bad' ? 'var(--clinical-rose)' : 'var(--clinical-teal)')}
              strokeWidth={1.5}
            />
          )}
        </div>
      )}

      {peer && (
        <div className="mt-3.5">
          <PeerPercentileBand
            position={peer.position}
            median={peer.median}
            topQuartile={peer.topQuartile}
            invert={peer.invert}
          />
          {benchmark && (
            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ink-soft)] tabular">
              <span>Bottom Q</span>
              <span className="font-mono">{benchmark}</span>
              <span>Top Q</span>
            </div>
          )}
        </div>
      )}

      {dollarLever && (
        <div className="mt-3 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-2.5 border-t border-[var(--hairline-soft)] bg-[var(--paper-deep)] text-[11px] leading-snug text-[var(--ink-muted)]">
          <span className="font-semibold text-[var(--clinical-teal)]">$ Lever ·</span>{' '}
          {dollarLever}
        </div>
      )}
    </div>
  );
}

// ─── Variance bar (Strata-style horizontal red/green vs target) ─────────────

export function VarianceBar({
  rows,
}: {
  rows: { label: string; variance: number; unit?: string; max?: number }[];
}) {
  const absMax = Math.max(...rows.map((r) => r.max ?? Math.abs(r.variance)), 1);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = Math.min(1, Math.abs(r.variance) / absMax);
        const positive = r.variance >= 0;
        const color = positive ? 'var(--clinical-green)' : 'var(--clinical-rose)';
        return (
          <div key={r.label} className="grid grid-cols-12 items-center gap-3 text-xs">
            <div className="col-span-4 text-[var(--ink-muted)] truncate">{r.label}</div>
            <div className="col-span-6 relative h-5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--hairline)]" />
              <div
                className="absolute top-0.5 bottom-0.5 rounded-sm"
                style={{
                  left: positive ? '50%' : `${50 - pct * 50}%`,
                  width: `${pct * 50}%`,
                  background: color,
                  opacity: 0.85,
                }}
              />
            </div>
            <div
              className="col-span-2 text-right font-mono font-semibold tabular"
              style={{ color }}
            >
              {positive ? '+' : ''}
              {r.variance.toFixed(1)}
              {r.unit ?? ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Opportunity card (Health Catalyst Touchstone pattern) ──────────────────

export interface Opportunity {
  rank: number;
  title: string;
  impact: string;          // "$4.2M"
  impactSub: string;       // "annualized net revenue"
  evidence: string;        // one-line root-cause
  confidence: number;      // 0..100
  tags: string[];
}

export function OpportunityFeed({ items }: { items: Opportunity[] }) {
  return (
    <div className="clinical-card overflow-hidden">
      <div className="clinical-card-header flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow" style={{ color: 'var(--clinical-violet)' }}>
            AI · Opportunity Feed
          </div>
          <div className="mt-0.5 font-serif text-lg font-semibold text-[var(--ink-strong)]">
            Ranked $ impact, current period
          </div>
        </div>
        <div className="text-[11px] text-[var(--ink-soft)] tabular text-right">
          <div className="font-semibold">{items.reduce((s, i) => s + parseFloat(i.impact.replace(/[^0-9.]/g, '')), 0).toFixed(1)}M</div>
          <div className="text-[10px] uppercase tracking-wider">Total opportunity</div>
        </div>
      </div>
      <ol className="divide-y divide-[var(--hairline-soft)]">
        {items.map((o) => (
          <li key={o.rank} className="px-5 py-3.5 hover:bg-[var(--paper-deep)] transition-colors">
            <div className="flex items-start gap-4">
              <div className="font-serif text-2xl text-[var(--ink-soft)] tabular leading-none pt-0.5 w-7 text-right shrink-0">
                {o.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <div className="font-semibold text-[var(--ink-strong)]">{o.title}</div>
                  <div className="text-[var(--clinical-green)] font-mono font-semibold tabular">
                    {o.impact}
                  </div>
                  <div className="text-[11px] text-[var(--ink-soft)] tabular">
                    {o.impactSub}
                  </div>
                </div>
                <div className="text-xs text-[var(--ink-muted)] mt-1 leading-relaxed">
                  {o.evidence}
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {o.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--hairline)] text-[var(--ink-soft)] bg-white"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="text-[10px] text-[var(--ink-soft)] ml-auto tabular">
                    confidence {o.confidence}%
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Revenue waterfall (Crowe / FinThrive pattern) ──────────────────────────

export function RevenueWaterfall({
  steps,
}: {
  steps: { label: string; value: number; kind: 'pos' | 'neg' | 'total' }[];
}) {
  const max = Math.max(...steps.map((s) => Math.abs(s.value)));
  const running: { label: string; bottom: number; height: number; kind: string }[] = [];
  let r = 0;
  steps.forEach((s, i) => {
    if (s.kind === 'total' && i === 0) {
      running.push({ label: s.label, bottom: 0, height: s.value, kind: s.kind });
      r = s.value;
    } else if (s.kind === 'neg') {
      running.push({ label: s.label, bottom: r + s.value, height: -s.value, kind: s.kind });
      r = r + s.value;
    } else if (s.kind === 'pos') {
      running.push({ label: s.label, bottom: r, height: s.value, kind: s.kind });
      r = r + s.value;
    } else {
      running.push({ label: s.label, bottom: 0, height: r, kind: s.kind });
    }
  });

  const H = 180;
  return (
    <div>
      <div className="flex items-end gap-2 h-[180px] border-b border-[var(--hairline)]">
        {running.map((s, i) => {
          const color =
            s.kind === 'neg'
              ? 'var(--clinical-rose)'
              : s.kind === 'total'
              ? 'var(--clinical-teal)'
              : 'var(--clinical-green)';
          const px = (Math.abs(s.height) / max) * (H - 10);
          const bottomPx = (s.bottom / max) * (H - 10);
          return (
            <div key={i} className="flex-1 relative min-w-0">
              <div
                className="absolute left-1 right-1 rounded-t-sm"
                style={{
                  bottom: bottomPx,
                  height: Math.max(4, px),
                  background: color,
                  opacity: s.kind === 'neg' ? 0.85 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] truncate">
              {s.label}
            </div>
            <div
              className="font-mono tabular text-xs font-semibold"
              style={{
                color:
                  s.kind === 'neg'
                    ? 'var(--clinical-rose)'
                    : s.kind === 'total'
                    ? 'var(--clinical-teal)'
                    : 'var(--clinical-green)',
              }}
            >
              {s.kind === 'neg' ? '-' : s.kind === 'total' ? '' : '+'}${Math.abs(s.value).toFixed(1)}M
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NL Narrative card (Innovaccer / Touchstone pattern) ────────────────────

export function NarrativeCard({
  eyebrow,
  story,
  highlight,
}: {
  eyebrow: string;
  story: React.ReactNode;
  highlight?: { label: string; value: string };
}) {
  return (
    <div
      className="rounded-lg border p-5 sm:p-6 relative overflow-hidden"
      style={{
        borderColor: 'var(--clinical-teal)',
        background:
          'linear-gradient(135deg, #ffffff 0%, var(--clinical-teal-bg) 180%)',
      }}
    >
      <div className="absolute right-4 top-4 text-[10px] font-mono uppercase tracking-wider text-[var(--clinical-teal)] flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--clinical-teal)] animate-pulse" />
        dbt-wizard narrative · auto
      </div>
      <div className="eyebrow mb-2">{eyebrow}</div>
      <div className="font-serif text-lg sm:text-xl leading-snug text-[var(--ink-strong)] max-w-3xl">
        {story}
      </div>
      {highlight && (
        <div className="mt-4 inline-flex items-baseline gap-2.5 rounded-md border border-[var(--hairline)] bg-white px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] font-semibold">
            {highlight.label}
          </span>
          <span className="font-serif text-2xl font-semibold text-[var(--clinical-green)] tabular">
            {highlight.value}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Data-flow diagram (Pipeline page hero) ─────────────────────────────────
// Animated SVG: Clarity Health EHR → Fivetran → Snowflake → dbt → Apps.
// Each node has a status; the flow lines pulse.

export interface FlowNode {
  id: string;
  label: string;
  sub: string;
  logo?: 'epic' | 'fivetran' | 'iceberg' | 'snowflake' | 'dbt' | 'app';
  status: 'healthy' | 'caution' | 'alert';
  metric?: string;
}

export function DataFlowDiagram({ nodes }: { nodes: FlowNode[] }) {
  return (
    <div className="clinical-card p-6 sm:p-8 overflow-hidden">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="eyebrow mb-1">Live Data Flow</div>
          <div className="font-serif text-xl font-semibold text-[var(--ink-strong)]">
            Clarity Health EHR → Snowflake, every 5 minutes
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-soft)] tabular">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--clinical-green)] animate-pulse" />
          Replication streaming · CDC
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-stretch gap-2">
        {nodes.map((n, i) => {
          const next = nodes[i + 1];
          // Label the two transformation edges (bronze→silver, silver→gold) with
          // the dbt Labs wordmark — Fivetran + dbt Labs are now one company.
          const edgeLabel =
            next && (
              (n.id === 'snowflake' && next.id === 'dbt') ||
              (n.id === 'dbt' && next.id === 'app')
            )
              ? 'dbt labs'
              : undefined;
          return (
            <Fragmented
              key={n.id}
              index={i}
              last={i === nodes.length - 1}
              node={n}
              edgeLabel={edgeLabel}
            />
          );
        })}
      </div>

      <style>{`
        @keyframes flow-dash {
          to { stroke-dashoffset: -24; }
        }
        .flow-pulse { animation: flow-dash 1.6s linear infinite; }
        @keyframes node-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function Fragmented({
  index: _index,
  last,
  node,
  edgeLabel,
}: {
  index: number;
  last: boolean;
  node: FlowNode;
  edgeLabel?: string;
}) {
  const tone =
    node.status === 'healthy'
      ? { border: 'var(--clinical-green)', bg: 'var(--clinical-green-bg)', text: 'var(--clinical-green)' }
      : node.status === 'caution'
      ? { border: 'var(--clinical-amber)', bg: 'var(--clinical-amber-bg)', text: 'var(--clinical-amber)' }
      : { border: 'var(--clinical-rose)', bg: 'var(--clinical-rose-bg)', text: 'var(--clinical-rose)' };

  return (
    <>
      <div className="flex-1 min-w-0 rounded-lg border bg-white p-3 flex flex-col gap-1.5" style={{ borderColor: 'var(--hairline)' }}>
        <div className="flex items-center justify-between gap-2">
          <NodeIcon logo={node.logo} />
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border"
            style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: tone.text, animation: node.status !== 'healthy' ? 'node-pulse 1.6s infinite' : undefined }}
            />
            {node.status === 'healthy' ? 'live' : node.status}
          </span>
        </div>
        <div className="font-serif font-semibold text-[var(--ink-strong)] text-sm leading-tight mt-1">
          {node.label}
        </div>
        <div className="text-[11px] text-[var(--ink-muted)] leading-snug">{node.sub}</div>
        {node.metric && (
          <div className="mt-1 text-[10px] font-mono tabular text-[var(--clinical-teal)]">{node.metric}</div>
        )}
      </div>
      {!last && (
        <div
          className={`hidden md:flex shrink-0 flex-col items-center justify-center ${
            edgeLabel ? 'w-20' : 'w-10'
          }`}
        >
          {edgeLabel && (
            <div
              className="mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 shadow-sm"
              style={{ background: '#FF694A', border: '1px solid #FF694A' }}
              title="Transformation powered by dbt Labs"
            >
              <span className="inline-flex h-3 w-3 items-center justify-center rounded-sm bg-white text-[8px] font-extrabold leading-none" style={{ color: '#FF694A' }}>
                d
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white leading-none">
                {edgeLabel}
              </span>
            </div>
          )}
          <svg viewBox="0 0 60 24" className="w-full h-6" preserveAspectRatio="none">
            <line
              x1="0"
              y1="12"
              x2="60"
              y2="12"
              stroke={edgeLabel ? '#FF694A' : 'var(--clinical-teal)'}
              strokeWidth={edgeLabel ? '2' : '1.5'}
              strokeDasharray="3 4"
              className="flow-pulse"
              opacity={edgeLabel ? '0.95' : '0.7'}
            />
            <polygon
              points="56,8 60,12 56,16"
              fill={edgeLabel ? '#FF694A' : 'var(--clinical-teal)'}
            />
          </svg>
          {edgeLabel && (
            <div className="mt-0.5 text-[8px] font-mono uppercase tracking-wider text-[var(--ink-soft)] leading-none">
              transform
            </div>
          )}
        </div>
      )}
    </>
  );
}

function NodeIcon({ logo }: { logo?: FlowNode['logo'] }) {
  const common = 'h-6 w-6 rounded-md flex items-center justify-center font-bold text-[11px]';
  if (logo === 'epic')
    return <div className={common} style={{ background: '#E13E2E', color: '#fff' }}>E</div>;
  if (logo === 'fivetran')
    return <div className={common} style={{ background: '#0073FF', color: '#fff' }}>5x</div>;
  if (logo === 'iceberg')
    return (
      <div className={common} style={{ background: '#2C7BE5', color: '#fff' }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l4 5-4 13-4-13 4-5z" />
        </svg>
      </div>
    );
  if (logo === 'snowflake')
    return (
      <div className={common} style={{ background: '#29B5E8', color: '#fff' }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  if (logo === 'dbt')
    return <div className={common} style={{ background: '#FF694A', color: '#fff' }}>dbt</div>;
  if (logo === 'app')
    return (
      <div className={common} style={{ background: 'var(--ink-strong)', color: '#fff' }}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="4" width="18" height="14" rx="1.5" />
          <path d="M8 20h8" />
        </svg>
      </div>
    );
  return <div className={common} style={{ background: 'var(--paper-deep)', color: 'var(--ink-soft)' }}>·</div>;
}

// ─── Provenance strip — Fivetran + Snowflake co-brand bar ───────────────────
// Subtle, on every key page. Communicates "this view is live from the stack."

export function ProvenanceStrip({
  freshness = '4 min ago',
  source = 'Clarity Health · Epic Clarity CDC',
  rows = '2.4M rows · 8 tables',
  ctaTo,
  fivetranUrl,
}: {
  freshness?: string;
  source?: string;
  rows?: string;
  ctaTo?: () => void;
  fivetranUrl?: string;
}) {
  return (
    <div className="rounded-md border border-[var(--hairline)] bg-white px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
      <div className="flex items-center gap-2 font-mono tabular">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--clinical-green)] animate-pulse" />
        <span className="text-[var(--ink-soft)]">Snowflake · live</span>
        <span className="text-[var(--ink-strong)] font-semibold">{freshness}</span>
      </div>
      <span className="text-[var(--hairline)]">│</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-bold text-white" style={{ background: '#0073FF' }}>F</span>
        <span className="text-[var(--ink-muted)]">{source}</span>
      </div>
      <span className="text-[var(--hairline)]">│</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-bold text-white" style={{ background: '#29B5E8' }}>❄</span>
        <span className="text-[var(--ink-muted)]">{rows}</span>
      </div>
      {fivetranUrl && (
        <a
          href={fivetranUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fivetran-cta"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2 7h10M7 2l5 5-5 5" />
          </svg>
          Open in Fivetran
        </a>
      )}
      {ctaTo && (
        <button
          onClick={ctaTo}
          className={`font-semibold text-[var(--clinical-teal)] hover:text-[var(--ink-strong)]${fivetranUrl ? '' : ' ml-auto'}`}
        >
          See pipeline →
        </button>
      )}
    </div>
  );
}
