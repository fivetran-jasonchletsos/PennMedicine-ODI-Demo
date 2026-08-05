import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatCurrency, formatNumber } from '../api/queries';
import type {
  PatientDetail,
  EncountersResponse,
  DiagnosesResponse,
  AccountsResponse,
  ComparablesResponse,
} from '../types';
import CareCostEstimator from '../components/CareCostEstimator';
import CohortPercentile from '../components/CohortPercentile';
import WatchlistButton from '../components/WatchlistButton';

export default function PatientDetailPage() {
  const { patId = '' } = useParams();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [encounters, setEncounters] = useState<EncountersResponse | null>(null);
  const [diagnoses, setDiagnoses] = useState<DiagnosesResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [comparables, setComparables] = useState<ComparablesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      api.getPatient(patId),
      api.getEncounters(patId),
      api.getDiagnoses(patId),
      api.getAccounts(patId),
      api.getComparables(patId),
    ])
      .then(([p, e, d, a, c]) => {
        if (cancelled) return;
        setPatient(p);
        setEncounters(e);
        setDiagnoses(d);
        setAccounts(a);
        setComparables(c);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patId]);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-center text-[var(--ink-soft)]">Loading chart…</div>;
  }
  if (error || !patient) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-[var(--ink-soft)]">
        <p className="font-serif text-lg text-[var(--ink-strong)]">Patient chart unavailable</p>
        <p className="mt-1 text-sm">This patient isn’t in the current snapshot.</p>
        <Link to="/patients" className="mt-4 inline-block text-sm text-[var(--clinical-teal)] hover:underline">← Back to patients</Link>
      </div>
    );
  }

  const balance = accounts?.summary?.outstanding_balance ?? 0;
  const burden = patient.active_chronic_count;
  const burdenTone =
    burden >= 3 ? { cls: 'alert', label: 'High chronic burden' } : burden >= 1 ? { cls: 'caution', label: `${burden} chronic` } : { cls: 'healthy', label: 'Stable' };

  // Next Best Action — simple rule-based recommendation
  const lastEncounterDate = encounters?.encounters
    .map((e) => e.contact_date)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  const lastEncounterTime = lastEncounterDate ? new Date(lastEncounterDate).getTime() : NaN;
  const daysSinceLast = Number.isFinite(lastEncounterTime)
    ? Math.floor((Date.now() - lastEncounterTime) / (1000 * 60 * 60 * 24))
    : null;

  let nextAction: { tone: string; label: string; title: string; rationale: string } | null = null;
  if (burden >= 3) {
    nextAction = {
      tone: 'alert',
      label: 'Care management',
      title: 'Enroll in care management',
      rationale: `${burden} active chronic conditions — longitudinal care plan reduces utilization variance.`,
    };
  } else if (balance > 500) {
    nextAction = {
      tone: 'caution',
      label: 'AR outreach',
      title: 'Outreach for AR balance',
      rationale: `Outstanding balance ${formatCurrency(balance)} — propensity-to-pay workflow recommended.`,
    };
  } else if (daysSinceLast === null || daysSinceLast > 90) {
    nextAction = {
      tone: 'info',
      label: 'Wellness',
      title: 'Schedule wellness visit',
      rationale:
        daysSinceLast === null
          ? 'No encounters on record — initiate primary-care outreach.'
          : `Last encounter ${daysSinceLast} days ago — preventive visit overdue.`,
    };
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb — clinical chart navigation feel */}
      <nav className="text-xs text-[var(--ink-soft)] mb-4 flex items-center gap-1.5">
        <Link to="/" className="hover:text-[var(--ink-strong)]">Home</Link>
        <span aria-hidden>/</span>
        <Link to="/patients" className="hover:text-[var(--ink-strong)]">Patients</Link>
        <span aria-hidden>/</span>
        <span className="font-mono text-[var(--ink-muted)]">{patient.med_rec_num}</span>
      </nav>

      {/* EHR-style patient banner — sits at top of "chart" */}
      <header className="patient-banner rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[10px] font-mono font-semibold text-[var(--clinical-teal)] tracking-[0.12em]">
                MRN · {patient.med_rec_num}
              </div>
              <span className="text-[10px] font-mono text-[var(--ink-soft)] tracking-tight">
                pat_id {patient.pat_id}
              </span>
              <span className={`status-pill ${burdenTone.cls}`}>{burdenTone.label}</span>
            </div>
            <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[var(--ink-strong)] tracking-tight">
              {patient.full_name}
            </h1>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <BannerField label="Age · Sex" value={`${patient.age} · ${patient.sex}`} />
              <BannerField label="DOB" value={patient.birth_date} />
              <BannerField label="Address" value={patient.city ? `${patient.city}${patient.zip_code ? `, ${patient.zip_code}` : ''}` : '—'} />
              <BannerField label="Race / Ethnicity" value={[patient.race, patient.ethnicity].filter(Boolean).join(' · ') || '—'} />
              <BannerField label="PCP" value={patient.primary_care_provider ?? '—'} />
              <BannerField label="Department" value={patient.primary_care_department ?? '—'} />
              <BannerField label="Phone" value={patient.phone ?? '—'} mono />
              <BannerField label="State" value={patient.state ?? '—'} />
            </div>
          </div>

          <div className="shrink-0 w-full lg:w-auto">
            <div className="grid grid-cols-3 gap-3 lg:gap-2">
              <BannerStat label="Encounters" value={formatNumber(encounters?.encounters.length ?? 0)} />
              <BannerStat label="Active Dx" value={formatNumber(diagnoses?.diagnoses.length ?? 0)} />
              <BannerStat label="Balance" value={formatCurrency(balance)} tone={balance > 5000 ? 'caution' : 'default'} />
            </div>
            <div className="mt-3 flex items-center justify-end">
              <WatchlistButton patId={patient.pat_id} />
            </div>
          </div>
        </div>

        {/* Allergy/alert strip — EHR convention */}
        {burden >= 3 && (
          <div className="px-6 py-2.5 bg-[var(--clinical-amber-bg)] border-t border-amber-200 text-xs flex items-center gap-2 text-[var(--clinical-amber)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <span className="font-semibold uppercase tracking-wider">Care management candidate</span>
            <span className="text-[var(--ink-muted)]">— 3 or more active chronic conditions; consider longitudinal care plan review.</span>
          </div>
        )}
      </header>

      {/* Next Best Action — rule-based, derived from patient data already loaded */}
      {nextAction && (
        <div className="mt-4 clinical-card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center font-serif font-semibold shrink-0"
              style={{ background: 'var(--clinical-teal-bg)', color: 'var(--clinical-teal)' }}
              aria-hidden
            >
              →
            </div>
            <div>
              <div className="eyebrow">Next Best Action</div>
              <div className="font-serif text-base font-semibold text-[var(--ink-strong)] leading-tight mt-0.5">
                {nextAction.title}
              </div>
            </div>
          </div>
          <div className="text-xs text-[var(--ink-muted)] sm:flex-1 sm:border-l sm:border-[var(--hairline-soft)] sm:pl-5 leading-relaxed">
            {nextAction.rationale}
          </div>
          <span className={`status-pill ${nextAction.tone} shrink-0`}>{nextAction.label}</span>
        </div>
      )}

      {/* Section: Encounters + Diagnoses side-by-side */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="clinical-card overflow-hidden">
          <header className="clinical-card-header flex items-center justify-between">
            <div>
              <div className="eyebrow">Section A</div>
              <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Recent encounters</h2>
            </div>
            <span className="text-xs text-[var(--ink-soft)] tabular">
              {encounters?.encounters.length ?? 0} total
            </span>
          </header>
          {encounters && encounters.encounters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm tabular">
                <thead className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] bg-[var(--paper-deep)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Department</th>
                    <th className="px-4 py-2 text-left font-semibold">Provider</th>
                    <th className="px-4 py-2 text-right font-semibold">Charges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline-soft)]">
                  {encounters.encounters.map((e) => (
                    <tr key={e.pat_enc_csn_id} className="hover:bg-[var(--paper-deep)]">
                      <td className="px-4 py-2 text-[var(--ink)] font-medium">{e.contact_date}</td>
                      <td className="px-4 py-2 text-[var(--ink)]">{e.encounter_type}</td>
                      <td className="px-4 py-2 text-[var(--ink-muted)]">{e.department_name}</td>
                      <td className="px-4 py-2 text-[var(--ink-muted)]">{e.provider_name}</td>
                      <td className="px-4 py-2 text-right text-[var(--ink-strong)] font-semibold">{formatCurrency(e.total_charges)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-[var(--ink-soft)]">No encounters recorded.</p>
          )}
        </section>

        <section className="clinical-card overflow-hidden">
          <header className="clinical-card-header flex items-center justify-between">
            <div>
              <div className="eyebrow">Section B</div>
              <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Active problem list</h2>
            </div>
            <span className="text-xs text-[var(--ink-soft)] tabular">
              {diagnoses?.diagnoses.length ?? 0} active
            </span>
          </header>
          {diagnoses && diagnoses.diagnoses.length > 0 ? (
            <ul className="divide-y divide-[var(--hairline-soft)]">
              {diagnoses.diagnoses.map((d) => (
                <li key={d.dx_id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-[var(--paper-deep)]">
                  <div className="min-w-0">
                    <div className="text-[var(--ink-strong)] font-medium">{d.diagnosis_name}</div>
                    <div className="text-[11px] font-mono text-[var(--ink-soft)] mt-0.5">
                      {d.icd10_code} <span className="text-[var(--ink-soft)]">· first noted {d.first_recorded}</span>
                    </div>
                  </div>
                  {d.chronic && <span className="status-pill alert shrink-0">chronic</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-5 text-sm text-[var(--ink-soft)]">No active diagnoses.</p>
          )}
        </section>

        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CohortPercentile
            patId={patient.pat_id}
            age={patient.age}
            sex={patient.sex}
            encounters={encounters?.encounters.length ?? 0}
            charges={accounts?.summary.total_charges ?? 0}
            chronic={patient.active_chronic_count}
          />
          <CareCostEstimator
            totalCharges={accounts?.summary.total_charges ?? 0}
            encounters={encounters?.encounters.length ?? 0}
            payerHint={accounts?.accounts[0]?.primary_payer ?? null}
          />
        </div>

        <section className="clinical-card overflow-hidden lg:col-span-2">
          <header className="clinical-card-header flex items-center justify-between">
            <div>
              <div className="eyebrow">Section C</div>
              <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Hospital accounts</h2>
            </div>
            <div className="text-xs text-[var(--ink-soft)] tabular flex gap-4">
              <span>Charges <span className="text-[var(--ink-strong)] font-semibold ml-1">{formatCurrency(accounts?.summary.total_charges ?? 0)}</span></span>
              <span>Paid <span className="text-[var(--ink-strong)] font-semibold ml-1">{formatCurrency(accounts?.summary.total_payments ?? 0)}</span></span>
              <span>Outstanding <span className={`font-semibold ml-1 ${balance > 0 ? 'text-[var(--clinical-rose)]' : 'text-[var(--clinical-green)]'}`}>{formatCurrency(balance)}</span></span>
            </div>
          </header>
          {accounts && accounts.accounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm tabular">
                <thead className="text-[10px] uppercase tracking-wider text-[var(--ink-soft)] bg-[var(--paper-deep)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Account</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                    <th className="px-4 py-2 text-left font-semibold">Payer</th>
                    <th className="px-4 py-2 text-right font-semibold">Charges</th>
                    <th className="px-4 py-2 text-right font-semibold">Payments</th>
                    <th className="px-4 py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline-soft)]">
                  {accounts.accounts.map((a) => (
                    <tr key={a.hsp_account_id} className="hover:bg-[var(--paper-deep)]">
                      <td className="px-4 py-2 font-mono text-[11px] text-[var(--ink-soft)]">{a.hsp_account_id}</td>
                      <td className="px-4 py-2 text-[var(--ink)]">{a.account_type}</td>
                      <td className="px-4 py-2"><AccountStatus status={a.status} /></td>
                      <td className="px-4 py-2 text-[var(--ink-muted)]">{a.primary_payer ?? '—'}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(a.total_charges)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(a.total_payments)}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${a.current_balance > 0 ? 'text-[var(--clinical-rose)]' : 'text-[var(--ink-strong)]'}`}>
                        {formatCurrency(a.current_balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-5 text-sm text-[var(--ink-soft)]">No accounts on file.</p>
          )}
        </section>

        {comparables && comparables.comparables.length > 0 && (
          <section className="clinical-card overflow-hidden lg:col-span-2">
            <header className="clinical-card-header">
              <div className="eyebrow">Section D</div>
              <h2 className="font-serif text-lg font-semibold text-[var(--ink-strong)] mt-0.5">Comparable patients</h2>
              <p className="text-xs text-[var(--ink-muted)] mt-1">
                Patients with overlapping chronic conditions and comparable demographics, ranked by clinical similarity.
              </p>
            </header>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {comparables.comparables.map((c) => (
                <Link
                  key={c.pat_id}
                  to={`/patients/${encodeURIComponent(c.pat_id)}`}
                  className="text-left rounded-md border border-[var(--hairline)] bg-white p-3.5 hover:border-[var(--clinical-teal)] transition-colors"
                >
                  <div className="font-serif font-semibold text-[var(--ink-strong)] truncate">{c.full_name}</div>
                  <div className="text-xs text-[var(--ink-soft)]">{c.age} · {c.sex}</div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] tabular">
                    <span className="text-[var(--clinical-teal)] font-semibold">{c.encounter_count} visits</span>
                    <span className="text-[var(--clinical-rose)]">{c.chronic_overlap_count} overlap</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function BannerField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-[var(--ink-soft)] uppercase tracking-[0.08em]">{label}</div>
      <div className={`text-sm text-[var(--ink-strong)] font-medium ${mono ? 'font-mono text-[12px]' : ''} truncate`}>{value}</div>
    </div>
  );
}

function BannerStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'caution' }) {
  return (
    <div className={`rounded-md border ${tone === 'caution' ? 'border-amber-200 bg-[var(--clinical-amber-bg)]' : 'border-[var(--hairline)] bg-white'} px-3 py-2 min-w-[6.5rem]`}>
      <div className="text-[9.5px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider">{label}</div>
      <div className={`mt-0.5 font-serif text-xl font-semibold tabular leading-none ${tone === 'caution' ? 'text-[var(--clinical-amber)]' : 'text-[var(--ink-strong)]'}`}>
        {value}
      </div>
    </div>
  );
}

function AccountStatus({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s.includes('closed') || s.includes('paid') ? 'healthy' :
    s.includes('open') || s.includes('active') ? 'info' :
    s.includes('collect') || s.includes('overdue') || s.includes('past') ? 'alert' : 'caution';
  return <span className={`status-pill ${tone}`}>{status}</span>;
}
