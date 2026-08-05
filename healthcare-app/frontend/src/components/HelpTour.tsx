// HelpTour — a floating help button + slide-style overlay that walks first-time
// visitors through the site's capabilities. Auto-opens on first visit (gated
// by localStorage); thereafter only opens on demand.
//
// Each step is a self-contained capability description with: a title, a short
// pitch, a CTA route (where to actually go try it), and an optional inline
// preview rendered with CSS so we don't ship image assets.

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LS_KEY = 'helpTour:dismissed';

interface Step {
  title: string;
  pitch: string;
  cta: { label: string; to: string } | null;
  preview: () => ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Search a million-patient panel in under a second',
    pitch:
      "Find any patient by name, MRN, or city. Results stream from a Snowflake-governed EHR snapshot, refreshed by Fivetran's Epic Clarity connector.",
    cta: { label: 'Open Patients', to: '/patients' },
    preview: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center px-3 text-xs text-slate-500">
          Search by patient name, MRN, or city…
        </div>
        <div className="mt-2 space-y-1.5">
          {['Ramirez, Elena · MRN 0100482 · Pittsburgh', 'Okafor, Daniel · MRN 0100231 · Cleveland', 'Nakamura, Yuki · MRN 0100819 · Erie'].map((r, i) => (
            <div key={i} className="min-h-[22px] rounded bg-slate-50 border border-slate-100 px-2 py-1 text-[11px] flex items-center text-slate-600 truncate">
              {r}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Population health analytics at scale',
    pitch:
      'Cross-filter chronic-condition prevalence, payer mix, encounter volume, and provider panels. Every chart re-aggregates against the same patient cohort in milliseconds.',
    cta: { label: 'Open Population Health', to: '/dashboard' },
    preview: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-3 grid grid-cols-3 gap-2">
        {[60, 80, 45, 95, 70, 30].map((h, i) => (
          <div key={i} className="flex flex-col justify-end h-16">
            <div
              className="rounded-sm"
              style={{ height: `${h}%`, background: 'var(--clinical-teal)' }}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Pipeline observability you can show your CIO',
    pitch:
      "Every layer — Fivetran's Epic Clarity connector, Snowflake destination, dbt Labs transformations, and the static deploy — reports live status. Simulate a failure to walk through incident response.",
    cta: { label: 'Open Pipeline', to: '/pipeline' },
    preview: () => (
      <div className="rounded-lg p-3" style={{ background: '#171717' }}>
        {[
          { name: 'patient_cdc', status: '#22c55e' },
          { name: 'pat_enc_stream', status: '#f59e0b' },
          { name: 'hsp_account', status: '#22c55e' },
        ].map((r) => (
          <div key={r.name} className="flex items-center justify-between py-1 text-xs">
            <span className="text-neutral-200 font-mono">{r.name}</span>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.status }} />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'A unified longitudinal patient record',
    pitch:
      'Open any patient to see encounters, diagnoses, medications, account ledger, and provider panel — joined live from eight EHR source tables into a single chart-style view.',
    cta: { label: 'Browse patients', to: '/patients' },
    preview: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-900">12 encounters · $48,310 lifetime</div>
        <svg viewBox="0 0 120 30" className="w-full h-8">
          <polyline points="2,24 22,20 42,18 62,15 82,11 102,9 118,6" fill="none" stroke="#0e7490" strokeWidth="1.5" />
        </svg>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          {['Encounters', 'Diagnoses', 'Charges'].map((l) => (
            <div key={l} className="rounded bg-slate-50 border border-slate-100 px-1.5 py-1 text-slate-600">{l}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Geographic care-gap map',
    pitch:
      'Switch between encounter density, ED utilization, payer concentration, and chronic-condition prevalence by ZIP. The same pattern works for catchment analysis or value-based-care attribution.',
    cta: { label: 'Open Geographic', to: '/map' },
    preview: () => (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-4 gap-1">
        {[0.2, 0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.4, 0.3, 0.7, 0.6, 0.5].map((v, i) => (
          <div key={i} className="h-5 rounded-sm" style={{ background: `rgba(14,116,144,${v})` }} />
        ))}
      </div>
    ),
  },
  {
    title: 'Ask the clinical record in plain English',
    pitch:
      'Skip the BI tool — type a question. A local rules layer handles common population-health asks for free; opt-in Claude integration handles open-ended ones, with your API key stored only in your browser.',
    cta: { label: 'Try Clinical Insights', to: '/agent' },
    preview: () => (
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        <div className="rounded bg-slate-50 border border-slate-100 px-2 py-1.5 text-[11px] text-slate-600">
          "Which patients have 3+ chronic conditions and no PCP visit in 12 months?"
        </div>
        <div className="rounded px-2 py-1.5 text-[11px]" style={{ background: 'var(--clinical-teal-bg)', color: 'var(--clinical-teal)', border: '1px solid #a5f3fc' }}>
          247 patients · avg 4.2 conditions · 18 ZIPs
        </div>
      </div>
    ),
  },
];

export default function HelpTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  // Auto-open on first visit only. Gate behind sm: width (>=640px) so
  // narrow phones don't get a modal that overflows the viewport.
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(min-width: 640px)').matches) {
        return;
      }
      if (!localStorage.getItem(LS_KEY)) {
        // Small delay so initial-load loading states settle before the modal pops.
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage blocked — silently skip auto-open */
    }
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTour();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function openTour() {
    setStep(0);
    setOpen(true);
  }

  function closeTour() {
    setOpen(false);
    try { localStorage.setItem(LS_KEY, '1'); } catch { /* noop */ }
  }

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function goToCta() {
    const cta = STEPS[step].cta;
    if (!cta) return;
    closeTour();
    navigate(cta.to);
  }

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Floating help launcher — always visible */}
      <button
        onClick={openTour}
        aria-label="Open product tour"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full text-white shadow-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ background: 'var(--clinical-teal)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span className="hidden sm:inline">Take the tour</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeTour(); }}
        >
          <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5 px-6 pt-5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-8' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                  }`}
                  style={i === step ? { background: 'var(--clinical-teal)' } : undefined}
                />
              ))}
              <button
                onClick={closeTour}
                aria-label="Close tour"
                className="ml-auto text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 sm:gap-6 p-4 sm:p-6">
              <div className="sm:col-span-3">
                <div
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider mb-3"
                  style={{ background: 'var(--clinical-teal-bg)', color: 'var(--clinical-teal)' }}
                >
                  Capability {step + 1} of {STEPS.length}
                </div>
                <h2 id="tour-title" className="text-xl font-bold text-slate-900 leading-tight">
                  {s.title}
                </h2>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{s.pitch}</p>
                {s.cta && (
                  <button
                    onClick={goToCta}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
                    style={{ color: 'var(--clinical-teal)' }}
                  >
                    {s.cta.label} →
                  </button>
                )}
              </div>
              <div className="sm:col-span-2 flex items-center">
                <div className="w-full">{s.preview()}</div>
              </div>
            </div>

            {/* Footer controls */}
            <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={prev}
                disabled={step === 0}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <Link
                to="/about"
                onClick={closeTour}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Read the full overview
              </Link>
              <button
                onClick={isLast ? closeTour : next}
                className="rounded-md text-white text-sm font-medium px-4 py-2"
                style={{ background: 'var(--clinical-teal)' }}
              >
                {isLast ? 'Done' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
