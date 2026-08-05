// ============================================================
// API helpers — read static JSON snapshots built by
// scripts/build_snapshot.py from Snowflake marts.
// ============================================================

import type {
  SummaryStats,
  PatientSearchResponse,
  PatientSearchResult,
  PatientDetail,
  EncountersResponse,
  DiagnosesResponse,
  AccountsResponse,
  ComparablesResponse,
} from '../types';

export type DataSource = 'live' | 'demo';

let lastSource: DataSource = 'demo';
let snapshotGeneratedAt: string | null = null;
const listeners = new Set<(s: DataSource) => void>();

function setSource(s: DataSource) {
  if (s === lastSource) return;
  lastSource = s;
  listeners.forEach((l) => l(s));
}

export function subscribeSource(fn: (s: DataSource) => void): () => void {
  listeners.add(fn);
  fn(lastSource);
  return () => listeners.delete(fn);
}

export function getSnapshotTime(): string | null {
  return snapshotGeneratedAt;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return (await res.json()) as T;
}

let summaryCache: SummaryStats | null = null;
let patientsCache: PatientSearchResponse | null = null;

async function loadSummary(): Promise<SummaryStats> {
  if (summaryCache) return summaryCache;
  const data = await fetchJson<SummaryStats>('/data/summary.json');
  if (data.generated_at) snapshotGeneratedAt = data.generated_at;
  if (data.source) setSource(data.source);
  summaryCache = data;
  return data;
}

async function loadPatients(): Promise<PatientSearchResponse> {
  if (patientsCache) return patientsCache;
  const raw = await fetchJson<any>('/data/patients.json');
  let results: PatientSearchResult[];
  if (Array.isArray(raw.rows) && Array.isArray(raw.columns)) {
    const cols: string[] = raw.columns;
    results = raw.rows.map((row: any[]) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i];
      return obj as PatientSearchResult;
    });
  } else {
    results = raw.results ?? [];
  }
  patientsCache = { count: raw.count ?? results.length, results };
  return patientsCache;
}

type DetailBundle = {
  patient: PatientDetail;
  encounters: EncountersResponse;
  diagnoses: DiagnosesResponse;
  accounts: AccountsResponse;
  comparables: ComparablesResponse;
};

const detailCache = new Map<string, Promise<DetailBundle>>();

async function loadDetail(patId: string): Promise<DetailBundle> {
  if (detailCache.has(patId)) return detailCache.get(patId)!;
  const p = (async () => {
    const safe = patId.replace(/\//g, '_');
    try {
      return await fetchJson<DetailBundle>(`/data/patients/${encodeURIComponent(safe)}.json`);
    } catch {
      return synthesizeDetail(patId);
    }
  })();
  // Don't poison the cache with a rejected promise: if the bundle fails to
  // resolve (e.g. an unknown pat_id from a stale link), drop it so a later
  // view can retry instead of replaying the rejection all session.
  p.catch(() => detailCache.delete(patId));
  detailCache.set(patId, p);
  return p;
}

async function synthesizeDetail(patId: string): Promise<DetailBundle> {
  const all = await loadPatients();
  const p = all.results.find((r) => r.pat_id === patId);
  if (!p) throw new Error(`Patient ${patId} not in snapshot.`);
  const patient: PatientDetail = {
    pat_id: p.pat_id,
    med_rec_num: p.med_rec_num,
    full_name: p.full_name,
    birth_date: p.birth_date,
    age: p.age,
    sex: p.sex,
    race: null,
    ethnicity: null,
    mailing_address: null,
    city: p.city,
    state: 'PA',
    zip_code: p.zip_code,
    phone: null,
    primary_care_provider: p.primary_care_provider,
    primary_care_department: null,
    active_chronic_count: p.active_chronic_count,
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  };
  return {
    patient,
    encounters: { pat_id: patId, encounters: [] },
    diagnoses: { pat_id: patId, diagnoses: [] },
    accounts: {
      pat_id: patId,
      summary: {
        total_charges: p.total_charges,
        total_payments: 0,
        outstanding_balance: p.total_charges,
        account_count: 0,
      },
      accounts: [],
    },
    comparables: { pat_id: patId, comparables: [] },
  };
}

export const api = {
  getSummary: () => loadSummary(),

  searchPatients: async (params: { q?: string; city?: string; zip?: string; limit?: number }) => {
    const all = await loadPatients();
    let results = all.results;
    if (params.q) {
      const q = params.q.toLowerCase();
      results = results.filter(
        (p) =>
          (p.full_name ?? '').toLowerCase().includes(q) ||
          (p.pat_id ?? '').toLowerCase().includes(q) ||
          (p.med_rec_num ?? '').toLowerCase().includes(q) ||
          (p.city ?? '').toLowerCase().includes(q),
      );
    }
    if (params.city) {
      const c = params.city.toUpperCase();
      results = results.filter((p) => (p.city ?? '').toUpperCase().includes(c));
    }
    if (params.zip) results = results.filter((p) => p.zip_code === params.zip);
    if (params.limit) results = results.slice(0, params.limit);
    return { count: results.length, results };
  },

  getPatient: async (id: string): Promise<PatientDetail> => (await loadDetail(id)).patient,
  getEncounters: async (id: string): Promise<EncountersResponse> => (await loadDetail(id)).encounters,
  getDiagnoses: async (id: string): Promise<DiagnosesResponse> => (await loadDetail(id)).diagnoses,
  getAccounts: async (id: string): Promise<AccountsResponse> => (await loadDetail(id)).accounts,
  getComparables: async (id: string): Promise<ComparablesResponse> => (await loadDetail(id)).comparables,
};

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatCurrencyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatPercent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}
