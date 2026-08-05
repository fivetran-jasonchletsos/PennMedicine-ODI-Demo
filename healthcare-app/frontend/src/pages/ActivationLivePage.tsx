/*
 * ActivationLivePage — NewCo Activations live-sync playback for Clarity Health.
 *
 * Mirrors WizardLivePage's terminal aesthetic + reveal-state machine, but for
 * a NewCo Activations sync run instead of a dbt-wizard build: Segment
 * Definition → Field Mapping → Sync Preview → API Push → Destination
 * Confirmation. Content lives inline as local consts (no fetch, no
 * public/data JSON) — see spec note in activationTypes.ts.
 *
 * Vertical scenario: the SEP-1 sepsis-bundle 3-hour lactate redraw. The
 * moment gold.fct_vital flags an ER-admitted cardiology encounter with
 * lactate drawn, no redraw ordered, and <30 minutes left on the clock,
 * Activations pushes the alert straight into TigerConnect.
 */

import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ActivationAgent,
  ActivationAgentId,
  ActivationEvent,
  ActivationRecord,
  ActivationScenario,
} from '../components/activationTypes';

// Timing constants — scale by speed control.
const NARR_TYPE_MS = 14;
const CODE_TYPE_MS = 4;
const POST_NARR_DELAY_MS = 550;
const POST_CODE_DELAY_MS = 350;
const SPEEDS = [1, 2, 4] as const;

interface RevealState {
  cursor: number;
  narrTyped: number;
  codeTyped: number;
  sideEffects: string[];
}

const INITIAL: RevealState = {
  cursor: 0,
  narrTyped: 0,
  codeTyped: 0,
  sideEffects: [],
};

const STEP_DEFS = [
  { label: 'Segment Definition',       who: 'Segment', tools: 'gold query',       insight: '1 encounter matched' },
  { label: 'Field Mapping',            who: 'Mapper',  tools: 'schema map',       insight: '5 fields mapped' },
  { label: 'Sync Preview',             who: 'Mapper',  tools: 'diff preview',     insight: '1 insert · 5 unchanged' },
  { label: 'API Push',                 who: 'Sync',    tools: 'REST push',       insight: '1 record sent' },
  { label: 'Destination Confirmation', who: 'Sync',    tools: 'destination read', insight: '1 landed · 0 errors' },
];

// ─── Vertical-specific scenario content (SEP-1 lactate redraw → TigerConnect) ─

const ACTIVATION_SCENARIO: ActivationScenario = {
  company: 'Clarity Health',
  request_id: 'ACT-2291',
  requested_by: 'SEP-1 Bundle Monitor',
  requested_at: '2026-07-09T07:32:00Z',
  timezone_label: 'ET',
  question: 'Alert the cardiology floor before the 3-hour SEP-1 lactate redraw window closes.',
  source_model: 'gold.fct_vital',
  destination_system: 'TigerConnect',
  destination_object: 'Care_Team_Channel',
  sync_mode: 'insert',
  record_count: 6,
  build_room_seconds: 41,
};

const ACTIVATION_AGENTS: ActivationAgent[] = [
  { id: 'segment', name: 'Segment', code: 'SEG', color: '#0e7490', role: 'Defines the gold-layer trigger query', tools: ['gold query', 'threshold watch'] },
  { id: 'mapper',  name: 'Mapper',  code: 'MAP', color: '#b45309', role: 'Maps gold columns to destination fields', tools: ['schema map', 'diff preview'] },
  { id: 'sync',    name: 'Sync',    code: 'SYN', color: '#16a34a', role: 'Pushes the payload and confirms landing', tools: ['REST push', 'destination read'] },
];

const ACTIVATION_SCRIPT: ActivationEvent[] = [
  {
    from: 'segment',
    step: 1,
    step_label: 'Segment Definition',
    body: "Watching gold.fct_vital for one condition: lactate drawn, no 3-hour redraw ordered, and less than 30 minutes left on the SEP-1 clock. Encounter ENC-88213 — Cardiology, ER-admitted — just crossed the 150-minute mark.",
    side_effect: 'gold.fct_vital · threshold crossed · ENC-88213',
    code_target: 'sql',
    code_append:
      "select\n  encounter_id,\n  patient_mrn,\n  service_line,\n  180 - minutes_since_initial_lactate as minutes_to_bundle_deadline,\n  'lactate_redraw_3h' as sepsis_bundle_element_missing\nfrom gold.fct_vital\nwhere lactate_drawn = true\n  and lactate_redrawn_3h is null\n  and minutes_since_initial_lactate >= 150\n  and encounter_admission_source = 'ER';",
  },
  {
    from: 'mapper',
    step: 2,
    step_label: 'Field Mapping',
    body: "Field Mapping translates the governed gold columns straight into TigerConnect's alert schema — no custom API integration, no analyst in the loop.",
    side_effect: 'mapping · 5 fields → Care_Team_Channel',
    code_target: 'json',
    code_append: JSON.stringify(
      {
        destination: 'TigerConnect',
        object: 'Care_Team_Channel',
        field_map: {
          encounter_id: 'Encounter_Reference',
          patient_mrn: 'Patient_MRN',
          service_line: 'Care_Team_Channel',
          minutes_to_bundle_deadline: 'Alert_Priority',
          sepsis_bundle_element_missing: 'Alert_Message_Body',
        },
      },
      null,
      2,
    ),
  },
  {
    from: 'mapper',
    step: 3,
    step_label: 'Sync Preview',
    body: 'Sync Preview diffs against TigerConnect before anything pushes: 1 new alert to insert, 5 already-open cardiology alerts unchanged.',
    side_effect: 'diff · 1 insert · 5 unchanged',
    code_target: 'json',
    code_append: JSON.stringify({ to_insert: 1, unchanged: 5, to_update: 0 }, null, 2),
  },
  {
    from: 'sync',
    step: 4,
    step_label: 'API Push',
    body: "API Push sends the payload straight into the cardiology floor's TigerConnect channel — no nightly batch, no custom integration, zero code.",
    side_effect: 'POST /v1/alerts · TigerConnect · 202 accepted',
    code_target: 'json',
    code_append: JSON.stringify(
      {
        channel: 'Care_Team_Channel · Cardiology 4W',
        Encounter_Reference: 'ENC-88213',
        Patient_MRN: 'MRN-40217',
        Alert_Priority: 22,
        Alert_Message_Body: 'SEP-1: 3-hour lactate redraw due in 22 min — not yet ordered.',
      },
      null,
      2,
    ),
  },
  {
    from: 'sync',
    step: 5,
    step_label: 'Destination Confirmation',
    body: 'Destination Confirmation: the alert landed in TigerConnect in under a minute. The nurse gets it before the deadline closes, not a root-cause report after it. One governed flag, one sync, zero code.',
    side_effect: 'TigerConnect · alert delivered · 0 errors',
  },
];

const ACTIVATION_RECORDS: ActivationRecord[] = [
  {
    key: 'ENC-88213',
    fields: {
      'Encounter Reference': 'ENC-88213',
      'Patient MRN': 'MRN-40217',
      'Care Team Channel': 'Cardiology 4W',
      'Alert Priority': 22,
      'Alert Message Body': '3-hr lactate redraw due in 22 min',
    },
    status: 'created',
  },
  {
    key: 'ENC-88147',
    fields: {
      'Encounter Reference': 'ENC-88147',
      'Patient MRN': 'MRN-40188',
      'Care Team Channel': 'Cardiology 4W',
      'Alert Priority': 41,
      'Alert Message Body': '3-hr lactate redraw due in 41 min',
    },
    status: 'skipped',
  },
  {
    key: 'ENC-88052',
    fields: {
      'Encounter Reference': 'ENC-88052',
      'Patient MRN': 'MRN-40092',
      'Care Team Channel': 'Cardiology 3E',
      'Alert Priority': 58,
      'Alert Message Body': '3-hr lactate redraw due in 58 min',
    },
    status: 'skipped',
  },
  {
    key: 'ENC-87991',
    fields: {
      'Encounter Reference': 'ENC-87991',
      'Patient MRN': 'MRN-39984',
      'Care Team Channel': 'Cardiology 3E',
      'Alert Priority': 74,
      'Alert Message Body': '3-hr lactate redraw due in 74 min',
    },
    status: 'skipped',
  },
  {
    key: 'ENC-87884',
    fields: {
      'Encounter Reference': 'ENC-87884',
      'Patient MRN': 'MRN-39871',
      'Care Team Channel': 'Cardiology 4W',
      'Alert Priority': 96,
      'Alert Message Body': '3-hr lactate redraw due in 96 min',
    },
    status: 'skipped',
  },
  {
    key: 'ENC-87802',
    fields: {
      'Encounter Reference': 'ENC-87802',
      'Patient MRN': 'MRN-39795',
      'Care Team Channel': 'Cardiology 3E',
      'Alert Priority': 112,
      'Alert Message Body': '3-hr lactate redraw due in 112 min',
    },
    status: 'skipped',
  },
];

// ─── Destination confirmation payoff table ──────────────────────────────────

function DestinationConfirmationTable({
  scenario,
  records,
}: {
  scenario: ActivationScenario;
  records: ActivationRecord[];
}) {
  const cols = Object.keys(records[0]?.fields ?? {});
  return (
    <div className="mt-4 clinical-card overflow-hidden" style={{ borderLeft: '4px solid #0e7490' }}>
      <header className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--hairline)' }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 11, color: '#0e7490' }}>Landed in {scenario.destination_system}</div>
          <div className="font-mono text-[12px] text-[var(--ink-muted)] mt-0.5">{scenario.destination_object} · {scenario.sync_mode}</div>
        </div>
        <span className="font-mono text-[12px]" style={{ color: '#0e7490' }}>
          {records.filter((r) => r.status !== 'skipped').length} of {records.length} shown
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[var(--hairline)]" style={{ background: 'var(--paper-deep,#f4efe2)' }}>
            <tr>
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">Key</th>
              {cols.map((c) => (
                <th key={c} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">{c}</th>
              ))}
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline-soft,#e8e4d8)]">
            {records.map((r) => (
              <tr key={r.key}>
                <td className="px-4 py-2 font-mono text-[12px] text-[var(--ink-strong)]">{r.key}</td>
                {cols.map((c) => (
                  <td key={c} className="px-4 py-2 text-[12px] text-[var(--ink)]">{r.fields[c]}</td>
                ))}
                <td className="px-4 py-2 text-right">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: r.status === 'skipped' ? '#b45309' : '#16a34a' }}
                  >
                    {r.status === 'skipped' ? '● unchanged' : `● ${r.status}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Small agent avatar (local — ActivationAgent has no sample_input/responsibilities) ─

function AgentBadge({ agent, active, size = 40 }: { agent?: ActivationAgent; active?: boolean; size?: number }) {
  const color = agent?.color ?? '#0e7490';
  const code = agent?.code ?? '??';
  return (
    <span
      className="wizard-agent-avatar"
      data-active={active ? 'true' : undefined}
      style={{
        color,
        height: size,
        width: size,
        minWidth: size,
        fontSize: Math.max(11, size * 0.36),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        background: 'rgba(11,39,68,0.45)',
        border: `1.5px solid ${active ? color : 'rgba(11,39,68,0.7)'}`,
        fontFamily: '"JetBrains Mono", monospace',
        fontWeight: 700,
        letterSpacing: '0.05em',
        transition: 'all 200ms ease',
        boxShadow: active ? `0 0 0 2px ${color}, 0 0 14px ${color}66` : undefined,
        flexShrink: 0,
      }}
      title={agent?.name ?? 'System'}
    >
      {code}
    </span>
  );
}

// ─── Syntax highlighting (regex-based, dark panel) — SQL + light JSON ───────

const SQL_KEYWORDS = new Set([
  'with', 'as', 'select', 'from', 'where', 'and', 'or', 'on', 'left', 'right',
  'inner', 'outer', 'join', 'group', 'by', 'order', 'desc', 'asc', 'when', 'then',
  'else', 'end', 'case', 'true', 'false', 'null', 'distinct', 'nullif', 'count',
  'sum', 'max', 'min', 'avg', 'dateadd', 'current_date', 'is', 'not',
]);

function tokenizeSqlLine(line: string): React.ReactNode[] {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('--')) {
    return [<span key="c" className="wtok-com">{line}</span>];
  }
  const parts: React.ReactNode[] = [];
  const re = /(\{\{[^}]*\}\})|('[^']*')|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*\b)|(\s+)|([^\s'\w{]+)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  let key = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > idx) parts.push(line.slice(idx, m.index));
    if (m[1]) {
      parts.push(<span key={key++} className="wtok-jinja">{m[1]}</span>);
    } else if (m[2]) {
      parts.push(<span key={key++} className="wtok-str">{m[2]}</span>);
    } else if (m[3]) {
      parts.push(<span key={key++} className="wtok-num">{m[3]}</span>);
    } else if (m[4]) {
      const word = m[4];
      if (SQL_KEYWORDS.has(word.toLowerCase())) {
        parts.push(<span key={key++} className="wtok-kw">{word}</span>);
      } else {
        parts.push(word);
      }
    } else if (m[5]) {
      parts.push(m[5]);
    } else {
      parts.push(m[6] ?? '');
    }
    idx = re.lastIndex;
  }
  if (idx < line.length) parts.push(line.slice(idx));
  return parts;
}

function SyntaxSql({ text, cursor }: { text: string; cursor: boolean }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>{tokenizeSqlLine(line)}{li < lines.length - 1 && '\n'}</span>
      ))}
      {cursor && <span className="wizard-code-cursor" />}
    </>
  );
}

function tokenizeJsonLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(\btrue\b|\bfalse\b|\bnull\b)|(-?\b\d+(?:\.\d+)?\b)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  let key = 0;
  while ((m = re.exec(line)) !== null) {
    if (m.index > idx) parts.push(line.slice(idx, m.index));
    if (m[1]) {
      const isKey = !!m[2];
      parts.push(<span key={key++} className={isKey ? 'wtok-kw' : 'wtok-str'}>{m[1]}</span>);
      if (m[2]) parts.push(m[2]);
    } else if (m[3]) {
      parts.push(<span key={key++} className="wtok-jinja">{m[3]}</span>);
    } else if (m[4]) {
      parts.push(<span key={key++} className="wtok-num">{m[4]}</span>);
    }
    idx = re.lastIndex;
  }
  if (idx < line.length) parts.push(line.slice(idx));
  return parts;
}

function SyntaxJson({ text, cursor }: { text: string; cursor: boolean }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <span key={li}>{tokenizeJsonLine(line)}{li < lines.length - 1 && '\n'}</span>
      ))}
      {cursor && <span className="wizard-code-cursor" />}
    </>
  );
}

// =============================================================================
// Page
// =============================================================================

export default function ActivationLivePage() {
  const [events] = useState<ActivationEvent[]>(ACTIVATION_SCRIPT);
  const scenario = ACTIVATION_SCENARIO;
  const agents = ACTIVATION_AGENTS;

  const [state, setState] = useState<RevealState>(INITIAL);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [complete, setComplete] = useState(false);

  const narrPanelRef = useRef<HTMLDivElement | null>(null);
  const codePanelRef = useRef<HTMLPreElement | null>(null);
  const narrUserScrolled = useRef(false);
  const codeUserScrolled = useRef(false);

  const agentById = useMemo(() => {
    const m: Record<string, ActivationAgent> = {};
    for (const a of agents) m[a.id] = a;
    return m;
  }, [agents]);

  const currentEvent: ActivationEvent | undefined = events[state.cursor];
  const totalSteps = useMemo(() => {
    if (events.length === 0) return 5;
    return Math.max(...events.map((e) => e.step));
  }, [events]);

  // Phase machine: type narration → type code (if any) → advance
  useEffect(() => {
    if (!playing || !currentEvent) {
      if (events.length > 0 && state.cursor >= events.length && !complete) {
        setComplete(true);
      }
      return;
    }
    // Phase 1: type narration
    if (state.narrTyped < currentEvent.body.length) {
      const id = setTimeout(() => {
        setState((s) => ({ ...s, narrTyped: s.narrTyped + 1 }));
      }, Math.max(2, Math.floor(NARR_TYPE_MS / speed)));
      return () => clearTimeout(id);
    }
    // Phase 2: type code if any
    const code = currentEvent.code_append ?? '';
    if (code.length > 0 && state.codeTyped < code.length) {
      const id = setTimeout(() => {
        setState((s) => ({ ...s, codeTyped: s.codeTyped + 1 }));
      }, Math.max(1, Math.floor(CODE_TYPE_MS / speed)));
      return () => clearTimeout(id);
    }
    // Phase 3: commit side effect + advance cursor
    const postDelay = code.length > 0 ? POST_CODE_DELAY_MS : POST_NARR_DELAY_MS;
    const id = setTimeout(() => {
      setState((s) => {
        const next: RevealState = { ...s, cursor: s.cursor + 1, narrTyped: 0, codeTyped: 0 };
        if (currentEvent.side_effect) {
          next.sideEffects = [currentEvent.side_effect, ...s.sideEffects].slice(0, 8);
        }
        return next;
      });
    }, Math.max(80, Math.floor(postDelay / speed)));
    return () => clearTimeout(id);
  }, [playing, speed, currentEvent, state.narrTyped, state.codeTyped, state.cursor, events.length, complete]);

  useEffect(() => {
    const el = narrPanelRef.current;
    if (el && !narrUserScrolled.current) el.scrollTop = el.scrollHeight;
  }, [state.cursor, state.narrTyped]);
  useEffect(() => {
    const el = codePanelRef.current;
    if (el && !codeUserScrolled.current) el.scrollTop = el.scrollHeight;
  }, [state.codeTyped, state.cursor]);

  useEffect(() => {
    const NEAR_BOTTOM_PX = 32;
    const bind = (el: HTMLElement | null, flag: React.MutableRefObject<boolean>) => {
      if (!el) return () => {};
      const handler = () => {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        flag.current = distanceFromBottom > NEAR_BOTTOM_PX;
      };
      el.addEventListener('scroll', handler, { passive: true });
      return () => el.removeEventListener('scroll', handler);
    };
    const offs = [bind(narrPanelRef.current, narrUserScrolled), bind(codePanelRef.current, codeUserScrolled)];
    return () => { offs.forEach((off) => off()); };
  }, []);

  const reset = () => { setState(INITIAL); setComplete(false); setPlaying(true); };
  const cycleSpeed = () => { const i = SPEEDS.indexOf(speed); setSpeed(SPEEDS[(i + 1) % SPEEDS.length]); };

  const currentStep = currentEvent?.step ?? totalSteps;
  const currentStepLabel = currentEvent?.step_label ?? 'Destination Confirmation';
  const activeAgentId: ActivationAgentId | undefined =
    currentEvent && state.narrTyped < currentEvent.body.length ? currentEvent.from : undefined;

  const visibleNarr = events.slice(0, Math.min(state.cursor + 1, events.length)).map((e, idx) => {
    const isCurrent = idx === state.cursor;
    const body = isCurrent ? e.body.slice(0, state.narrTyped) : e.body;
    return { e, body, isCurrent };
  });

  const codeSoFar = currentEvent?.code_append ? currentEvent.code_append.slice(0, state.codeTyped) : '';
  const codeLabel =
    currentEvent?.code_target === 'sql'
      ? 'models/gold/fct_vital.sql'
      : 'activation_mapping.json';

  return (
    <div className="wizard-terminal mx-auto max-w-[1640px] px-4 py-4 sm:px-6 lg:px-8">

      {/* ── Control bar ── */}
      <div
        className="mb-3 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-20 z-20"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--hairline)',
          borderLeft: '4px solid #0e7490',
          borderRadius: '0.25rem',
          boxShadow: '0 2px 8px rgba(11,39,68,0.08)',
        }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="status-pill"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: 12, padding: '4px 10px', fontWeight: 700,
              background: 'rgba(14,116,144,0.1)', color: '#0e7490', border: '1px solid rgba(14,116,144,0.35)',
            }}
          >
            <span
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                background: '#0e7490',
                animation: complete ? 'none' : 'signal-pulse 1.8s ease-in-out infinite',
              }}
            />
            {complete ? 'Sync Complete' : 'Sync Active'}
          </span>
          <span className="eyebrow" style={{ fontSize: 12 }}>{scenario.request_id}</span>
          <span className="font-mono" style={{ color: 'var(--ink-muted)', fontSize: 13 }}>
            Step{' '}
            <span style={{ color: '#0e7490', fontWeight: 700 }}>{currentStep}/{totalSteps}</span>
            <span className="mx-2" style={{ color: 'var(--ink-soft)' }}>·</span>
            <span style={{ color: 'var(--ink)' }}>{currentStepLabel}</span>
          </span>
          <div
            aria-hidden
            style={{ width: 160, height: 6, borderRadius: 999, background: 'var(--paper-deep)', overflow: 'hidden', border: '1px solid var(--hairline)' }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, Math.round(((complete ? events.length : state.cursor) / Math.max(1, events.length)) * 100)))}%`,
                height: '100%',
                background: complete ? 'var(--clinical-green)' : '#0e7490',
                transition: 'width 220ms ease, background 200ms ease',
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold border transition-colors"
            style={{ background: 'var(--paper-deep)', borderColor: 'var(--hairline)', color: 'var(--ink)', padding: '7px 14px', fontSize: 13 }}
            onClick={() => setPlaying((p) => !p)}
            disabled={complete}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold border transition-colors"
            style={{ background: 'var(--paper-deep)', borderColor: 'var(--hairline)', color: 'var(--ink)', padding: '7px 14px', fontSize: 13 }}
            onClick={cycleSpeed}
          >
            {speed}x
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold border transition-colors"
            style={{ background: 'var(--paper-deep)', borderColor: 'var(--hairline)', color: 'var(--ink)', padding: '7px 14px', fontSize: 13 }}
            onClick={reset}
          >
            Restart
          </button>
          <Link
            to="/architecture"
            className="inline-flex items-center gap-1.5 rounded-sm font-semibold border transition-colors"
            style={{ background: 'var(--paper-deep)', borderColor: 'var(--hairline)', color: 'var(--ink)', padding: '7px 14px', fontSize: 13 }}
          >
            Back
          </Link>
        </div>
      </div>

      {/* ── Question + trigger banner (compact single row) ── */}
      <div className="mb-3 px-4 py-2.5 clinical-card border-l-4 flex items-center gap-5 flex-wrap" style={{ borderLeftColor: '#0e7490' }}>
        <div className="min-w-0 flex-shrink" style={{ flex: '1 1 460px' }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2, color: '#0e7490' }}>
            SEP-1 Bundle Compliance · {scenario.timezone_label} · {scenario.requested_by}
          </div>
          <p className="font-serif font-medium text-[var(--ink-strong)] leading-snug truncate" style={{ fontSize: 16 }} title={scenario.question}>
            &ldquo;{scenario.question}&rdquo;
          </p>
        </div>
        <div className="font-mono text-[var(--ink-muted)] shrink-0" style={{ fontSize: 11 }}>
          Source: <span style={{ color: '#0e7490', fontWeight: 700 }}>{scenario.source_model}</span>
          <span className="mx-2" style={{ color: 'var(--ink-soft)' }}>&rarr;</span>
          <span style={{ color: '#0e7490', fontWeight: 700 }}>{scenario.destination_system}</span>
        </div>
      </div>

      {/* ── Step rail (5 columns) ── */}
      <div className="mb-3 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {STEP_DEFS.map((s, idx) => {
          const num = idx + 1;
          const done = currentStep > num || (currentStep === num && complete);
          const active = currentStep === num && !complete;
          const accentColor = active ? '#0e7490' : done ? 'var(--clinical-green)' : 'var(--hairline)';
          return (
            <div
              key={s.label}
              className="clinical-card px-2.5 py-2 flex flex-col gap-0.5"
              style={{
                borderLeft: `4px solid ${accentColor}`,
                background: active ? 'rgba(14,116,144,0.06)' : done ? 'var(--clinical-green-bg, rgba(20,94,54,0.06))' : 'var(--paper-deep)',
              }}
              title={`${s.who} · ${s.tools}`}
            >
              <div
                className="font-mono font-bold flex items-center gap-1.5"
                style={{ fontSize: 10, letterSpacing: '0.04em', color: active ? '#0e7490' : done ? 'var(--clinical-green)' : 'var(--ink-soft)' }}
              >
                <span>STEP {String(num).padStart(2, '0')}</span>
                <span style={{ opacity: 0.6 }}>·</span>
                <span>{done ? 'DONE' : active ? 'NOW' : 'WAIT'}</span>
              </div>
              <div className="font-semibold text-[var(--ink-strong)] truncate" style={{ fontSize: 13, lineHeight: 1.15 }}>
                {s.label}
              </div>
              <div
                className="font-mono truncate"
                style={{ fontSize: 10, lineHeight: 1.25, color: active ? '#0e7490' : done ? 'var(--clinical-green)' : 'var(--ink-soft)', opacity: done || active ? 0.95 : 0.55 }}
                title={s.insight}
              >
                {s.insight}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)' }}>

        {/* ── LEFT: Sub-agent narration ── */}
        <section className="clinical-card flex flex-col min-h-[60vh] lg:min-h-[300px] lg:h-[calc(100dvh-440px)]">
          <header className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--hairline)' }}>
            <div>
              <div className="eyebrow" style={{ fontSize: 11 }}>Sub-agent narration</div>
              <div className="font-mono mt-0.5 text-[var(--ink-muted)]" style={{ fontSize: 12 }}>
                {scenario.company} · Activations live sync
              </div>
            </div>
            <div className="flex items-center gap-2">
              {agents.map((a) => (
                <AgentBadge key={a.id} agent={a} active={activeAgentId === a.id} size={36} />
              ))}
            </div>
          </header>

          <div
            ref={narrPanelRef}
            className="px-5 py-4 overflow-y-auto flex-1"
            style={{ background: 'var(--paper)', overscrollBehavior: 'contain', fontSize: 14, lineHeight: 1.55 }}
          >
            {visibleNarr.map((m, idx) => {
              const a = agentById[m.e.from];
              const color = a?.color ?? '#0e7490';
              const isTyping = m.isCurrent && playing && state.narrTyped < m.e.body.length;
              return (
                <div
                  key={idx}
                  data-wizard-card="narr"
                  style={{
                    borderLeft: `3px solid ${color}`,
                    paddingLeft: 12,
                    borderTopRightRadius: 4,
                    borderBottomRightRadius: 4,
                    marginBottom: 10,
                    border: '1px solid var(--hairline-soft)',
                    borderLeftColor: color,
                    borderLeftWidth: 3,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, padding: '12px 14px 12px 0' }}>
                    <div style={{ paddingTop: 2, flexShrink: 0 }}>
                      <AgentBadge agent={a} active={isTyping} size={40} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-mono font-semibold" style={{ color, fontSize: 13, letterSpacing: '0.02em' }}>
                          {a?.name ?? m.e.from}
                        </span>
                        <span
                          className="status-pill"
                          style={{ fontSize: 10, padding: '2px 7px', fontWeight: 700, background: 'rgba(14,116,144,0.10)', color: '#0e7490', border: '1px solid rgba(14,116,144,0.35)' }}
                        >
                          STEP {m.e.step}
                        </span>
                        <span className="font-mono text-[var(--ink-soft)]" style={{ fontSize: 11 }}>{m.e.step_label}</span>
                      </div>
                      <div className={isTyping ? 'wizard-chat-bubble wizard-chat-cursor' : 'wizard-chat-bubble'} style={{ color: 'var(--ink)', fontSize: 14.5, lineHeight: 1.55 }}>
                        {m.body}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── RIGHT: Single live code panel (SQL or JSON, per step) ── */}
        <section className="flex flex-col gap-3 min-h-[60vh] lg:min-h-[300px] lg:h-[calc(100dvh-440px)]" style={{ minWidth: 0 }}>
          <div className="clinical-card flex flex-col" style={{ flex: '1 1 0', minHeight: 0 }}>
            <header className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--hairline)' }}>
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <div className="eyebrow font-mono" style={{ fontSize: 11, letterSpacing: '0.02em' }}>{codeLabel}</div>
                <span
                  className="layer-chip"
                  style={{ color: '#0e7490', background: 'rgba(14,116,144,0.07)', border: '1px solid rgba(14,116,144,0.3)', fontSize: 10, padding: '3px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  {currentEvent?.from ? `${agentById[currentEvent.from]?.name ?? currentEvent.from} authoring` : 'Awaiting sync'}
                </span>
              </div>
              <span className="font-mono text-[var(--ink-soft)]" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                {codeSoFar.length.toLocaleString()} chars
              </span>
            </header>
            <pre
              ref={codePanelRef}
              className="flex-1"
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 14, lineHeight: 1.6,
                background: '#0b1829', color: '#e8edf8',
                border: 'none', margin: 0, padding: '1.25rem',
                overflowX: 'auto', overflowY: 'auto',
                whiteSpace: 'pre', tabSize: 2,
                overscrollBehavior: 'contain',
                borderBottomLeftRadius: '0.25rem',
                borderBottomRightRadius: '0.25rem',
                minHeight: 0,
              }}
            >
              {codeSoFar.length === 0 ? (
                <span style={{ color: '#5a7099' }}>{'-- waiting for the next stage to author...'}</span>
              ) : currentEvent?.code_target === 'sql' ? (
                <SyntaxSql text={codeSoFar} cursor={state.codeTyped > 0 && state.codeTyped < (currentEvent.code_append?.length ?? 0)} />
              ) : (
                <SyntaxJson text={codeSoFar} cursor={state.codeTyped > 0 && state.codeTyped < (currentEvent?.code_append?.length ?? 0)} />
              )}
            </pre>
          </div>
        </section>
      </div>

      {/* ── Full-width tool side effects ticker (compact) ── */}
      <div className="clinical-card mt-3 px-3 py-2 flex items-center gap-3">
        <div className="eyebrow shrink-0" style={{ fontSize: 10 }}>sync events</div>
        {state.sideEffects.length === 0 ? (
          <div className="font-mono text-[var(--ink-soft)]" style={{ fontSize: 11.5 }}>Awaiting first sync event...</div>
        ) : (
          <ul className="flex items-center gap-x-4 gap-y-1 flex-wrap min-w-0">
            {state.sideEffects.slice(0, 4).map((s, i) => (
              <li key={`${s}-${i}`} className="flex items-center gap-1.5 font-mono text-[var(--ink)] truncate" style={{ fontSize: 11.5, maxWidth: '32ch' }} title={s}>
                <span
                  style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                    background: i === 0 ? '#0e7490' : 'var(--ink-soft)',
                    animation: i === 0 ? 'signal-pulse 1.8s ease-in-out infinite' : 'none',
                  }}
                />
                <span className="truncate">{s}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Sync complete: destination confirmation payoff ── */}
      {complete && (
        <div className="mt-6 clinical-card p-5" style={{ borderLeft: '5px solid var(--clinical-green)', background: 'var(--clinical-green-bg, rgba(20,94,54,0.06))' }}>
          <div className="flex items-baseline justify-between flex-wrap gap-3 mb-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <div
                className="status-pill shrink-0"
                style={{ display: 'inline-flex', fontSize: 12, padding: '4px 10px', fontWeight: 700, background: 'rgba(20,94,54,0.12)', color: 'var(--clinical-green)', border: '1px solid rgba(20,94,54,0.35)' }}
              >
                Sync Complete
              </div>
              <span className="eyebrow" style={{ fontSize: 11 }}>{scenario.request_id} · {scenario.company}</span>
            </div>
            <Link
              to="/architecture"
              className="inline-flex items-center gap-2 rounded-sm font-semibold transition-colors"
              style={{ background: '#0e7490', color: '#fff', padding: '10px 18px', fontSize: 13 }}
            >
              Back to architecture
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <DestinationConfirmationTable scenario={scenario} records={ACTIVATION_RECORDS} />
        </div>
      )}

      {/* Inline styles for wizard-specific primitives (shared aesthetic, per-app terminal title below) */}
      <style>{`
        @keyframes signal-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.28; }
        }

        /* ── Terminal aesthetic ── */
        .wizard-terminal {
          --t-bg:       #0a1424;
          --t-surface:  #0f1f36;
          --t-elev:     #142844;
          --t-line:     #1f3559;
          --t-line-soft:#15294a;
          --t-text:     #e6edf8;
          --t-text-dim: #b6c6dd;
          --t-text-soft:#7a90b3;
          --t-accent:   #2dd4bf;
          --t-accent-2: #a78bfa;
          --t-ok:       #4ade80;
          --t-warn:     #fb923c;
          background: var(--t-bg);
          color: var(--t-text);
          font-family: "JetBrains Mono", ui-monospace, monospace;
          border-radius: 10px;
          border: 1px solid var(--t-line);
          padding-top: 28px;
          position: relative;
          margin-top: 4px;
          margin-bottom: 12px;
          box-shadow: 0 18px 40px -22px rgba(0, 0, 0, 0.55);
        }
        /* Window chrome — traffic lights + filename */
        .wizard-terminal::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 28px;
          background: linear-gradient(180deg, #0d1c33, #0a1424);
          border-bottom: 1px solid var(--t-line);
          border-top-left-radius: 9px;
          border-top-right-radius: 9px;
        }
        .wizard-terminal::after {
          content: 'clarity-health/activations-live · NewCo Activations';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 28px;
          display: flex;
          align-items: center;
          font-size: 11.5px;
          font-family: "JetBrains Mono", monospace;
          background:
            radial-gradient(circle at 14px 14px, #ff5f57 5px, transparent 5.5px),
            radial-gradient(circle at 30px 14px, #febc2e 5px, transparent 5.5px),
            radial-gradient(circle at 46px 14px, #28c940 5px, transparent 5.5px);
          color: var(--t-text-dim);
          text-indent: 64px;
          letter-spacing: 0.02em;
          pointer-events: none;
        }
        .wizard-terminal > * { position: relative; z-index: 1; }

        /* Override the light card base inside the terminal */
        .wizard-terminal .clinical-card {
          background: var(--t-surface) !important;
          border-color: var(--t-line) !important;
          color: var(--t-text);
          box-shadow: none;
        }
        .wizard-terminal .clinical-card header,
        .wizard-terminal .clinical-card > .border-b {
          border-color: var(--t-line) !important;
          background: var(--t-elev);
        }
        /* Inner narration scroll surface */
        .wizard-terminal .clinical-card > div[style*="background: var(--paper)"] {
          background: var(--t-bg) !important;
        }
        /* Narration chat cards */
        .wizard-terminal [data-wizard-card="narr"] {
          background: var(--t-elev) !important;
          border-color: var(--t-line-soft) !important;
          color: var(--t-text) !important;
        }
        .wizard-terminal [data-wizard-card="narr"] .wizard-chat-bubble {
          color: var(--t-text) !important;
        }
        .wizard-terminal [data-wizard-card="narr"] .font-mono {
          color: var(--t-text-dim) !important;
        }
        /* Generic text recolor */
        .wizard-terminal h1,
        .wizard-terminal h2,
        .wizard-terminal h3,
        .wizard-terminal p,
        .wizard-terminal span,
        .wizard-terminal div,
        .wizard-terminal li {
          color: inherit;
        }
        .wizard-terminal .text-\\[var\\(--ink\\)\\],
        .wizard-terminal [style*="color: var(--ink)"] { color: var(--t-text) !important; }
        .wizard-terminal .text-\\[var\\(--ink-strong\\)\\],
        .wizard-terminal [style*="color: var(--ink-strong)"] { color: var(--t-text) !important; }
        .wizard-terminal .text-\\[var\\(--ink-muted\\)\\],
        .wizard-terminal [style*="color: var(--ink-muted)"] { color: var(--t-text-dim) !important; }
        .wizard-terminal .text-\\[var\\(--ink-soft\\)\\],
        .wizard-terminal [style*="color: var(--ink-soft)"] { color: var(--t-text-soft) !important; }
        .wizard-terminal [style*="color: #0e7490"] { color: var(--t-accent) !important; }

        /* Status pills: dim on dark */
        .wizard-terminal .status-pill,
        .wizard-terminal .layer-chip {
          background: rgba(45,212,191,0.12) !important;
          border-color: rgba(45,212,191,0.35) !important;
          color: var(--t-accent) !important;
        }
        /* Buttons on dark */
        .wizard-terminal button,
        .wizard-terminal a[class*="rounded-sm"] {
          background: var(--t-elev) !important;
          color: var(--t-text) !important;
          border-color: var(--t-line) !important;
        }
        .wizard-terminal button:hover,
        .wizard-terminal a[class*="rounded-sm"]:hover {
          background: var(--t-line) !important;
          border-color: var(--t-accent) !important;
        }
        /* Eyebrow */
        .wizard-terminal .eyebrow {
          color: var(--t-accent) !important;
          opacity: 0.85;
        }
        /* Step rail active/done tiles */
        .wizard-terminal .clinical-card[style*="rgba(14,116,144"] {
          background: rgba(45,212,191,0.10) !important;
        }
        .wizard-terminal .clinical-card[style*="var(--clinical-green-bg"] {
          background: rgba(74,222,128,0.10) !important;
        }
        .wizard-terminal .clinical-card[style*="var(--paper-deep)"] {
          background: var(--t-surface) !important;
        }
        /* Code panels */
        .wizard-terminal pre {
          background: var(--t-bg) !important;
          border-top: 1px solid var(--t-line);
          color: #d6e3f6 !important;
        }
        /* Question banner */
        .wizard-terminal .clinical-card.border-l-4 {
          border-left-color: var(--t-accent) !important;
        }
        /* Progress bar background */
        .wizard-terminal div[style*="background: var(--paper-deep)"] {
          background: var(--t-elev) !important;
          border-color: var(--t-line) !important;
        }
        /* Avatar chip */
        .wizard-terminal .wizard-agent-avatar {
          background: rgba(10,20,36,0.6) !important;
          border-color: rgba(120,150,200,0.35) !important;
        }
        .wizard-terminal .wizard-agent-avatar[data-active="true"] {
          background: var(--t-bg) !important;
        }
        .wizard-chat-bubble {
          font-family: "JetBrains Mono", monospace;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
          color: var(--ink);
        }
        .wizard-terminal .wizard-chat-bubble {
          color: var(--t-text) !important;
        }
        .wizard-chat-cursor::after {
          content: '▌';
          display: inline-block;
          margin-left: 2px;
          color: #0e7490;
          animation: cursor-blink 0.9s steps(2, start) infinite;
        }
        .wizard-terminal .wizard-chat-cursor::after {
          color: var(--t-accent) !important;
        }
        @keyframes cursor-blink {
          to { visibility: hidden; }
        }
        .wizard-code-cursor::after {
          content: '▌';
          color: #0e7490;
          animation: cursor-blink 0.9s steps(2, start) infinite;
        }
        .wtok-kw    { color: #79b8ff; font-weight: 600; }
        .wtok-str   { color: #4ade80; }
        .wtok-com   { color: #7a8fa8; font-style: italic; }
        .wtok-num   { color: #f59e0b; }
        .wtok-jinja { color: #e879b8; font-weight: 600; }
      `}</style>
    </div>
  );
}
