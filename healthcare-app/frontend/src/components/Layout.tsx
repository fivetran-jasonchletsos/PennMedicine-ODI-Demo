import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { api, getSnapshotTime, subscribeSource, type DataSource } from '../api/queries';
import * as watchlist from '../watchlist';
import PacSync from './PacSync';
import HelpTour from './HelpTour';

// Konami code: ↑ ↑ ↓ ↓ ← → ← → B A — unlocks the SpaceSync easter egg.
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

// Canonical nav across Clarity / Verity / Altavest. Three groups collapsed
// from 12 flat items to 7 top-level entries (5 links + 2 dropdowns):
//   1. Home
//   2-5. Persona pages (industry-specific)
//   6. dbt-Wizard ▾ — narrative dropdown (Scenario / Live / Outcome)
//   7. ODI ▾ — plumbing dropdown (Architecture / Pipeline / About)
type NavEntry =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'group'; label: string; rootTo: string; matchPrefixes: string[]; children: { to: string; label: string }[] };

const NAV: NavEntry[] = [
  { kind: 'link', to: '/',          label: 'Home' },
  { kind: 'link', to: '/executive', label: 'Executive' },
  { kind: 'link', to: '/patients',  label: 'Patients' },
  { kind: 'link', to: '/dashboard', label: 'Population Health' },
  { kind: 'link', to: '/agent',     label: 'Clinical Insights' },
  {
    kind: 'group',
    label: 'dbt-Wizard',
    rootTo: '/dbt-wizard',
    matchPrefixes: ['/dbt-wizard', '/scenario', '/wizard-live', '/outcome'],
    children: [
      { to: '/dbt-wizard',  label: 'Overview' },
      { to: '/scenario',    label: 'Scenario' },
      { to: '/wizard-live', label: 'Live build' },
      { to: '/outcome',     label: 'Outcome' },
    ],
  },
  {
    kind: 'group',
    label: 'ODI',
    rootTo: '/architecture',
    matchPrefixes: ['/architecture', '/pipeline', '/about', '/activations-live'],
    children: [
      { to: '/architecture',     label: 'Architecture' },
      { to: '/pipeline',         label: 'Pipeline' },
      { to: '/about',            label: 'About' },
      { to: '/activations-live', label: 'Activations' },
    ],
  },
];

const DEMOS = [
  { key: 'tax-assessment', name: 'Allegheny County Tax', industry: 'Public sector · Property assessment', url: 'https://fivetran-jasonchletsos.github.io/tax-assessment-databricks-demo/', accent: '#dc2626' },
  { key: 'healthcare',     name: 'Clarity Health',        industry: 'Healthcare · Clinical analytics',     url: 'https://fivetran-jasonchletsos.github.io/Healthcare-EPIC-Snowflake-Demo/', accent: '#0d9488' },
  { key: 'finserv',        name: 'Altavest Capital',     industry: 'Financial Services · Wealth & banking', url: 'https://fivetran-jasonchletsos.github.io/FinServ-ODI-Demo/', accent: '#1d4ed8' },
  { key: 'insurance',     name: 'Verity Insurance',           industry: 'Insurance · Policies, claims, reinsurance', url: 'https://fivetran-jasonchletsos.github.io/Insurance-ODI-Demo/', accent: '#0369a1' },
  { key: 'media',          name: 'Lighthouse Media',     industry: 'Media · Audience intelligence',       url: 'https://fivetran-jasonchletsos.github.io/Media-ODI-Demo/', accent: '#7c3aed' },
  { key: 'retail',         name: 'Storefront Analytics', industry: 'Retail & e-commerce',                  url: 'https://fivetran-jasonchletsos.github.io/RetailEcom-ODI-Demo/', accent: '#ea580c' },
  { key: 'techsaas',       name: 'SaaS Pulse',           industry: 'Tech · SaaS analytics',                url: 'https://fivetran-jasonchletsos.github.io/TechSaaS-ODI-Demo/', accent: '#059669' },
  { key: 'supplychain',    name: 'Manifest',             industry: 'Supply chain · Logistics',             url: 'https://fivetran-jasonchletsos.github.io/SupplyChain-ODI-Demo/', accent: '#0891b2' },
  { key: 'lifesci',        name: 'Cohort',               industry: 'Life sciences · Clinical research',    url: 'https://fivetran-jasonchletsos.github.io/LifeSci-ODI-Demo/', accent: '#be185d' },
  { key: 'mission-control', name: 'Mission Control', industry: 'Admin · Governance + observability', url: 'https://fivetran-jasonchletsos.github.io/ODI-Mission-Control/', accent: '#22d3ee' },
];
const CURRENT_DEMO = 'healthcare';

// ─── NavEntryEl — renders a link or a dropdown group ────────────────────────
function NavEntryEl({ entry, pathname }: { entry: NavEntry; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  if (entry.kind === 'link') {
    return (
      <NavLink
        to={entry.to}
        end={entry.to === '/'}
        className={({ isActive }) =>
          `relative px-3 py-2 font-medium transition-colors whitespace-nowrap ${
            isActive ? 'text-[var(--ink-strong)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {entry.label}
            {isActive && (
              <span className="absolute left-3 right-3 -bottom-[1px] h-[2px] rounded-full" style={{ background: 'var(--color-brand-600)' }} />
            )}
          </>
        )}
      </NavLink>
    );
  }

  // entry.kind === 'group' — dropdown
  const isActive = entry.matchPrefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative px-3 py-2 font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
          isActive ? 'text-[var(--ink-strong)]' : 'text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
        }`}
      >
        {entry.label}
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isActive && (
          <span className="absolute left-3 right-6 -bottom-[1px] h-[2px] rounded-full" style={{ background: 'var(--color-brand-600)' }} />
        )}
      </button>
      {open && (
        <span role="menu" className="absolute left-0 top-full mt-1 min-w-[200px] rounded-md border border-[var(--hairline)] bg-white shadow-lg overflow-hidden z-50">
          {entry.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end={c.to === '/'}
              className={({ isActive: ia }) =>
                `block px-4 py-2.5 text-sm font-medium transition-colors ${
                  ia
                    ? 'bg-[var(--paper-deep)] text-[var(--ink-strong)]'
                    : 'text-[var(--ink-muted)] hover:bg-[var(--paper-deep)] hover:text-[var(--ink-strong)]'
                }`
              }
            >
              {c.label}
            </NavLink>
          ))}
        </span>
      )}
    </span>
  );
}

export default function Layout() {
  const [source, setSource] = useState<DataSource>('demo');
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [watchCount, setWatchCount] = useState(0);
  const [spaceSyncOpen, setSpaceSyncOpen] = useState(false);
  const [demoSwitcherOpen, setDemoSwitcherOpen] = useState(false);
  const demoSwitcherRef = useRef<HTMLDivElement>(null);
  const konamiBufferRef = useRef<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = subscribeSource(setSource);
    api.getSummary().finally(() => setSnapshotAt(getSnapshotTime())).catch(() => {});
    const wsub = watchlist.subscribe((ids) => setWatchCount(ids.length));
    return () => { unsub(); wsub(); };
  }, []);

  // Konami code listener — unlocks the SpaceSync easter egg.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when the user is typing into an input/textarea (no surprise launches)
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return;
      const key = e.key.toLowerCase();
      const buf = konamiBufferRef.current;
      buf.push(key);
      if (buf.length > KONAMI.length) buf.shift();
      if (buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i])) {
        konamiBufferRef.current = [];
        setSpaceSyncOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!demoSwitcherOpen) return;
    const onDown = (e: MouseEvent) => {
      if (demoSwitcherRef.current && !demoSwitcherRef.current.contains(e.target as Node)) {
        setDemoSwitcherOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDemoSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [demoSwitcherOpen]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/patients?q=${encodeURIComponent(q)}` : '/patients');
    setMobileOpen(false);
  };

  return (
    <div className="min-h-full flex flex-col bg-[var(--paper)]">
      <div className="institutional-rail" />

      <header className="bg-white border-b border-[var(--hairline)] sticky top-0 z-30 backdrop-blur-sm bg-white/95">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-16 sm:h-20 items-center justify-between gap-2 sm:gap-6">
            <Link to="/" className="flex items-center gap-3 shrink-0 min-w-0 group">
              <div className="h-10 w-10 rounded-md flex items-center justify-center shadow-sm" style={{ background: 'var(--institutional-accent)' }}>
                <CaduceusMark className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="font-serif font-semibold text-lg sm:text-xl text-[var(--ink-strong)] tracking-tight truncate">
                  Clarity Health
                </div>
                <div className="text-[10px] sm:text-[11px] font-medium text-[var(--ink-soft)] uppercase tracking-[0.14em]">
                  Clinical Analytics Platform
                </div>
              </div>
            </Link>

            <form onSubmit={onSubmit} className="hidden md:flex flex-1 max-w-md relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-[var(--ink-soft)] pointer-events-none">
                <SearchIcon className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patient by name, MRN, or city…"
                className="flex-1 rounded-md bg-[var(--paper-deep)] border border-[var(--hairline)] pl-9 pr-3 py-2 text-sm placeholder:text-[var(--ink-soft)] focus:bg-white focus:border-[var(--clinical-teal)] focus:outline-none"
              />
            </form>

            <nav className="hidden lg:flex items-center gap-0.5 text-sm">
              {NAV.map((entry) => (
                <NavEntryEl key={entry.kind === 'link' ? entry.to : entry.label} entry={entry} pathname={location.pathname} />
              ))}
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigate('/watchlist')}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink-strong)] hover:bg-[var(--paper-deep)]"
                aria-label="Watchlist"
                title="Watchlist"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill={watchCount > 0 ? '#f59e0b' : 'none'} stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round">
                  <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
                {watchCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 inline-flex items-center justify-center rounded-full bg-[var(--clinical-amber)] text-[10px] font-bold text-white">
                    {watchCount}
                  </span>
                )}
              </button>
              <DemoSwitcher
                source={source}
                snapshotAt={snapshotAt}
                open={demoSwitcherOpen}
                onToggle={() => setDemoSwitcherOpen((o) => !o)}
                containerRef={demoSwitcherRef}
              />
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--paper-deep)]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileOpen ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          </div>

          {mobileOpen && (
            <div className="lg:hidden pb-4 border-t border-[var(--hairline-soft)] pt-3 space-y-3">
              <form onSubmit={onSubmit} className="md:hidden flex relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-[var(--ink-soft)]">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search patient…"
                  className="flex-1 rounded-md bg-[var(--paper-deep)] border border-[var(--hairline)] pl-9 pr-3 py-2 text-sm"
                />
              </form>
              <nav className="grid grid-cols-2 gap-1 text-sm">
                {NAV.flatMap((entry) =>
                  entry.kind === 'link'
                    ? [{ to: entry.to, label: entry.label }]
                    : entry.children.map((c) => ({ to: c.to, label: `${entry.label} · ${c.label}` })),
                ).map(({ to, label }) => (
                  <NavLink
                    key={to + label}
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-center font-medium border ${
                        isActive
                          ? 'bg-[var(--paper-deep)] text-[var(--ink-strong)] border-[var(--clinical-teal)]'
                          : 'border-[var(--hairline)] text-[var(--ink-muted)] hover:bg-[var(--paper-deep)]'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div>
                <div className="eyebrow mb-2">Switch demo</div>
                <div className="grid grid-cols-1 gap-1">
                  {DEMOS.map((d) => {
                    const isCurrent = d.key === CURRENT_DEMO;
                    const inner = (
                      <div className="flex items-center gap-2.5 w-full">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.accent }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[var(--ink-strong)] truncate">{d.name}</div>
                          <div className="text-[11px] text-[var(--ink-muted)] truncate">{d.industry}</div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] border border-[var(--hairline)] rounded px-1.5 py-0.5">Current</span>
                        )}
                      </div>
                    );
                    return isCurrent ? (
                      <div key={d.key} className="px-3 py-2 rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] opacity-80">
                        {inner}
                      </div>
                    ) : (
                      <a
                        key={d.key}
                        href={d.url}
                        className="px-3 py-2 rounded-md border border-[var(--hairline)] hover:bg-[var(--paper-deep)] transition-colors"
                      >
                        {inner}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--hairline)] bg-white mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 text-xs sm:text-sm text-[var(--ink-muted)] grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="font-serif font-semibold text-[var(--ink-strong)] mb-1.5">Clarity Health · Analytics</div>
            <p className="leading-relaxed text-[var(--ink-soft)]">
              A reference architecture for clinical analytics on EHR-shaped data, built on the modern
              data stack. Synthetic data — not for clinical use.
            </p>
            <a
              href={`${import.meta.env.BASE_URL || '/'}Clarity-Health-3min-Demo-Runbook.pdf`}
              download
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-[var(--hairline)] bg-[var(--paper-deep)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--ink-strong)] hover:border-[var(--clinical-teal)] hover:bg-white transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M12 18v-6" /><path d="M9 15l3 3 3-3" />
              </svg>
              3-min demo runbook (PDF)
            </a>
          </div>
          <div>
            <div className="eyebrow mb-2">Data Pipeline</div>
            <p className="leading-relaxed mb-3">
              Epic Clarity → Fivetran → Iceberg on S3 → dbt labs + dbt-wizard → Great Expectations → Snowflake / Athena / Trino → run-time agents → NewCo Activations → TigerConnect
            </p>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hairline)] bg-white px-2 py-1">
                <span className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-bold text-white" style={{ background: '#0073FF' }}>N</span>
                <span className="font-semibold text-[var(--ink-strong)]">NewCo</span>
              </span>
              <span className="text-[var(--ink-soft)]">+</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--hairline)] bg-white px-2 py-1">
                <span className="inline-flex items-center justify-center h-4 px-1 rounded text-[9px] font-bold text-white" style={{ background: '#29B5E8' }}>❄</span>
                <span className="font-semibold text-[var(--ink-strong)]">Snowflake</span>
              </span>
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">Compliance Posture</div>
            <p className="leading-relaxed">
              Synthetic data only · No PHI · HIPAA-aligned design patterns · Snowflake access history audit
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--hairline-soft)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 text-[11px] text-[var(--ink-soft)] flex flex-col sm:flex-row gap-1 sm:items-center sm:justify-between">
            <div>© 2026 Healthcare EPIC Snowflake Demo · For demonstration only</div>
            <div>Snapshot generated {snapshotAt ? new Date(snapshotAt).toLocaleString() : '—'}</div>
          </div>
        </div>
      </footer>

      {spaceSyncOpen && <PacSync onClose={() => setSpaceSyncOpen(false)} />}
      <HelpTour />
    </div>
  );
}

function DemoSwitcher({
  source,
  snapshotAt: _snapshotAt,
  open,
  onToggle,
  containerRef,
}: {
  source: DataSource;
  snapshotAt: string | null;
  open: boolean;
  onToggle: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const live = source === 'live';
  return (
    <div ref={containerRef} className="relative hidden sm:inline-flex">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={live ? 'Live Snowflake snapshot — click to switch demo' : 'Demo data — click to switch demo'}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
          live
            ? 'bg-[var(--clinical-green-bg)] text-[var(--clinical-green)] border-emerald-200 hover:brightness-95'
            : 'bg-[var(--clinical-amber-bg)] text-[var(--clinical-amber)] border-amber-200 hover:brightness-95'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-[var(--clinical-green)]' : 'bg-[var(--clinical-amber)]'} animate-pulse`} />
        {live ? 'Snowflake · live' : 'Demo'}
        <svg viewBox="0 0 24 24" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[280px] rounded-md border border-[var(--hairline)] bg-[var(--paper)] shadow-lg z-40 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-[var(--hairline-soft)] eyebrow text-[var(--ink-soft)]">
            Switch demo
          </div>
          <div className="py-1">
            {DEMOS.map((d) => {
              const isCurrent = d.key === CURRENT_DEMO;
              const inner = (
                <div className="flex items-center gap-2.5 w-full">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.accent }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--ink-strong)] truncate">{d.name}</div>
                    <div className="text-[11px] text-[var(--ink-muted)] truncate">{d.industry}</div>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-soft)] border border-[var(--hairline)] rounded px-1.5 py-0.5">Current</span>
                  )}
                </div>
              );
              return isCurrent ? (
                <div key={d.key} className="px-3 py-2 opacity-80">
                  {inner}
                </div>
              ) : (
                <a key={d.key} href={d.url} className="block px-3 py-2 hover:bg-[var(--paper-deep)] transition-colors">
                  {inner}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CaduceusMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3v18" />
      <path d="M8 6c0 2 4 3 4 3s4-1 4-3" />
      <path d="M8 10c0 2 4 3 4 3s4-1 4-3" />
      <path d="M8 14c0 2 4 3 4 3s4-1 4-3" />
      <path d="M9 4l3-1 3 1" />
    </svg>
  );
}
