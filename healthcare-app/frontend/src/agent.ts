// ============================================================
// Clinical Insight Agent — local rules tier + optional Claude tier.
// Pattern mirrors the sheetz-demo agent.
// ============================================================

import type { PatientSearchResult } from './types';

export interface AgentResponse {
  intent: string;
  summary: string;
  source: 'rules' | 'claude';
  table?: { columns: string[]; rows: (string | number)[][] };
  patIds?: string[];
}

const KEY = 'epic-demo:anthropic-api-key';
export function getApiKey() { try { return localStorage.getItem(KEY); } catch { return null; } }
export function setApiKey(k: string | null) {
  try {
    if (k?.trim()) localStorage.setItem(KEY, k.trim());
    else localStorage.removeItem(KEY);
  } catch {}
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

const intents: Array<{
  name: string;
  pattern: RegExp;
  handler: (m: RegExpMatchArray, patients: PatientSearchResult[]) => AgentResponse;
}> = [
  {
    name: 'three_plus_chronic',
    pattern: /(\d+\s*\+\s*chronic|\d+\s+or\s+more\s+chronic|three\s+or\s+more|multi.*chronic|complex.*patient|chronic\s+condition)/i,
    handler: (_, ps) => {
      const hits = ps.filter((p) => p.active_chronic_count >= 3).slice(0, 25);
      return {
        intent: 'three_plus_chronic',
        source: 'rules',
        summary: `${hits.length} patients carry 3 or more active chronic conditions. These are typically the highest-utilization cohort and best candidates for care management programs.`,
        table: {
          columns: ['MRN', 'Name', 'Age', 'Chronic', 'Visits', 'Charges'],
          rows: hits.map((p) => [p.med_rec_num, p.full_name, p.age, p.active_chronic_count, p.encounter_count, fmtCurrency(p.total_charges)]),
        },
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
  {
    name: 'outstanding_balance',
    pattern: /(outstanding|balance|owe|debt|charge|\$\d+)/i,
    handler: (_, ps) => {
      const hits = [...ps].sort((a, b) => b.total_charges - a.total_charges).slice(0, 25);
      return {
        intent: 'outstanding_balance',
        source: 'rules',
        summary: `Top ${hits.length} patients by total charges in the snapshot.`,
        table: {
          columns: ['MRN', 'Name', 'Visits', 'Chronic', 'Charges'],
          rows: hits.map((p) => [p.med_rec_num, p.full_name, p.encounter_count, p.active_chronic_count, fmtCurrency(p.total_charges)]),
        },
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
  {
    name: 'zip_filter',
    pattern: /\b(\d{5})\b/,
    handler: (m, ps) => {
      const zip = m[1];
      const hits = ps.filter((p) => p.zip_code === zip).slice(0, 25);
      return {
        intent: 'zip_filter',
        source: 'rules',
        summary: hits.length
          ? `${hits.length} patients in ZIP ${zip}.`
          : `No patients in ZIP ${zip} in the current snapshot.`,
        table: hits.length
          ? {
              columns: ['MRN', 'Name', 'Age', 'PCP', 'Chronic', 'Visits'],
              rows: hits.map((p) => [p.med_rec_num, p.full_name, p.age, p.primary_care_provider ?? '—', p.active_chronic_count, p.encounter_count]),
            }
          : undefined,
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
  {
    name: 'top_visits',
    pattern: /\b(highest|top|most)\b.+(visits?|encounters?|utiliz)/i,
    handler: (_, ps) => {
      const hits = [...ps].sort((a, b) => b.encounter_count - a.encounter_count).slice(0, 25);
      return {
        intent: 'top_visits',
        source: 'rules',
        summary: `Top ${hits.length} patients by encounter count — likely candidates for care coordination.`,
        table: {
          columns: ['MRN', 'Name', 'Age', 'Visits', 'Chronic', 'Charges'],
          rows: hits.map((p) => [p.med_rec_num, p.full_name, p.age, p.encounter_count, p.active_chronic_count, fmtCurrency(p.total_charges)]),
        },
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
  {
    name: 'pediatrics',
    pattern: /(pediatric|child|under\s+18|minor)/i,
    handler: (_, ps) => {
      const hits = ps.filter((p) => p.age < 18).slice(0, 25);
      return {
        intent: 'pediatrics',
        source: 'rules',
        summary: `${hits.length} pediatric patients (age < 18).`,
        table: {
          columns: ['MRN', 'Name', 'Age', 'Sex', 'PCP', 'Visits'],
          rows: hits.map((p) => [p.med_rec_num, p.full_name, p.age, p.sex, p.primary_care_provider ?? '—', p.encounter_count]),
        },
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
  {
    name: 'medicare',
    pattern: /(medicare|65|senior|elderly)/i,
    handler: (_, ps) => {
      const hits = ps.filter((p) => p.age >= 65).slice(0, 25);
      return {
        intent: 'medicare',
        source: 'rules',
        summary: `${hits.length} patients age 65+ (Medicare-eligible).`,
        table: {
          columns: ['MRN', 'Name', 'Age', 'PCP', 'Chronic', 'Charges'],
          rows: hits.map((p) => [p.med_rec_num, p.full_name, p.age, p.primary_care_provider ?? '—', p.active_chronic_count, fmtCurrency(p.total_charges)]),
        },
        patIds: hits.map((p) => p.pat_id),
      };
    },
  },
];

export function answer(question: string, patients: PatientSearchResult[]): AgentResponse {
  const q = question.trim();
  if (!q) return { intent: 'empty', source: 'rules', summary: 'Ask me something — try one of the suggestions.' };

  for (const intent of intents) {
    const m = q.match(intent.pattern);
    if (m) return intent.handler(m, patients);
  }

  const lower = q.toLowerCase();
  const hits = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(lower) ||
      p.med_rec_num.toLowerCase().includes(lower) ||
      p.pat_id.toLowerCase().includes(lower) ||
      (p.city ?? '').toLowerCase().includes(lower),
  );
  if (hits.length > 0) {
    return {
      intent: 'substring_match',
      source: 'rules',
      summary: `${hits.length} patients match "${q}".`,
      table: {
        columns: ['MRN', 'Name', 'Age', 'City', 'Visits'],
        rows: hits.slice(0, 25).map((p) => [p.med_rec_num, p.full_name, p.age, p.city ?? '—', p.encounter_count]),
      },
      patIds: hits.slice(0, 25).map((p) => p.pat_id),
    };
  }

  return {
    intent: 'no_match',
    source: 'rules',
    summary: `No local rule matched "${q}". Try one of the suggestions, or enable Claude mode for richer reasoning.`,
  };
}

// ---------------------------------------------------------------------------
// Claude opt-in path

function summarizeForClaude(patients: PatientSearchResult[]) {
  const total = patients.length;
  const totalEnc = patients.reduce((s, p) => s + p.encounter_count, 0);
  const totalCharges = patients.reduce((s, p) => s + p.total_charges, 0);
  const byCity = new Map<string, number>();
  for (const p of patients) byCity.set(p.city ?? 'Unknown', (byCity.get(p.city ?? 'Unknown') ?? 0) + 1);
  const topCities = Array.from(byCity.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const chronicHist: Record<number, number> = {};
  for (const p of patients) {
    const k = Math.min(5, p.active_chronic_count);
    chronicHist[k] = (chronicHist[k] ?? 0) + 1;
  }
  return {
    total_patients: total,
    total_encounters: totalEnc,
    total_charges: totalCharges,
    avg_charges_per_encounter: totalEnc ? Math.round(totalCharges / totalEnc) : 0,
    by_city_top12: topCities.map(([city, count]) => ({ city, count })),
    chronic_histogram: chronicHist,
  };
}

const SYSTEM = `You are a clinical analytics assistant for an Epic Clarity-shaped dataset.
You answer questions about a snapshot of patient-level data exported from Snowflake marts.
Keep responses concise and grounded only in the JSON summary provided.
Format dollars as $12,345 and percentages with one decimal.
If a question can't be answered from the summary, say so — never invent patients or values.`;

export async function askClaude(question: string, patients: PatientSearchResult[]): Promise<AgentResponse> {
  const key = getApiKey();
  if (!key) {
    return { intent: 'claude_no_key', source: 'claude', summary: 'Add your Anthropic API key in Settings to enable Claude mode.' };
  }
  const summary = summarizeForClaude(patients);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Snapshot summary (JSON):\n\`\`\`json\n${JSON.stringify(summary)}\n\`\`\`\n\nQuestion: ${question}` }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Claude ${res.status}: ${detail.slice(0, 200)}`);
  }
  const payload = await res.json();
  const text: string = payload?.content?.find((c: any) => c.type === 'text')?.text ?? '(no response)';
  return { intent: 'claude', source: 'claude', summary: text };
}
