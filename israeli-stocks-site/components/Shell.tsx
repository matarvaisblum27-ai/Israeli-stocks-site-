'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Company, InterestingEntry } from '@/lib/supabase';
import CompanyCard from './CompanyCard';
import Landing from './Landing';
import Reveal from './Reveal';
import { StatusPill, Disclosure } from './ui';
import { sanitizeHtml } from '@/lib/sanitize';

const YEARS = ['2026', '2025', '2024'];

type Page = 'stocks' | 'enrichment';

type View =
  | { type: 'cat'; idx: number }
  | { type: 'interesting'; year: string }
  | { type: 'intro' };

/* ── Video type ── */
interface VideoItem {
  id: string;
  title: string;
  priority: boolean;
  addedAt?: string;
}

/* ── Excluded video keywords ── */
const EXCLUDED_KEYWORDS = ['צירופי מקרים', 'רועי כפרי', 'david thompson', 'thai food'];

function isExcluded(title: string) {
  const lower = title.toLowerCase();
  return EXCLUDED_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/* ════════════════════════════════════════════════════════════════
   Root Shell
   ════════════════════════════════════════════════════════════════ */
export default function Shell({
  categories,
  interestingYears,
}: {
  categories: Category[];
  interestingYears: string[];
}) {
  const [page, setPage] = useState<Page>('stocks');
  const [view, setView] = useState<View>({ type: 'intro' });
  const [statusFilter, setStatusFilter] = useState<CompanyStatus>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const firstCatIdx = useMemo(
    () => Math.max(0, categories.findIndex((c) => !c.name.includes('הקדמה'))),
    [categories]
  );

  const isLanding = page === 'stocks' && view.type === 'intro' && !statusFilter;

  const goHome = useCallback(() => {
    setPage('stocks');
    setView({ type: 'intro' });
    setStatusFilter(null);
    window.scrollTo({ top: 0 });
  }, []);

  const goBrowse = useCallback(() => {
    setPage('stocks');
    setStatusFilter(null);
    setView((v) => (v.type === 'intro' ? { type: 'cat', idx: firstCatIdx } : v));
    window.scrollTo({ top: 0 });
  }, [firstCatIdx]);

  const goEnrichment = useCallback(() => {
    setPage('enrichment');
    window.scrollTo({ top: 0 });
  }, []);

  const navLink = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      className={`text-xs transition-colors duration-500 ease-apple ${
        active ? 'text-ink' : 'text-slate-300/80 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* ── Ultra-thin translucent navbar ── */}
      <nav className="sticky top-0 z-50 h-12 bg-black/70 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl h-full px-5 flex items-center justify-between">
          <button onClick={goHome} className="text-sm font-semibold tracking-tight text-ink hover:opacity-80 transition-opacity duration-500">
            סקירת מניות ישראל
          </button>
          <div className="flex items-center gap-6 md:gap-8">
            {navLink('ראשי', isLanding, goHome)}
            {navLink('מניות', page === 'stocks' && !isLanding, goBrowse)}
            {navLink('העשרה', page === 'enrichment', goEnrichment)}
            <span className="hidden md:inline text-xs text-muted">שלומי ארדן</span>
          </div>
        </div>
      </nav>

      {/* ── Categories bar (mobile, explorer only) ── */}
      {page === 'stocks' && !isLanding && (
        <div className="lg:hidden sticky top-12 z-40 bg-black/70 backdrop-blur-2xl border-b border-white/[0.06] px-5 py-2">
          <MobileCategoriesButton onOpen={() => setMobileSidebarOpen(true)} />
        </div>
      )}

      {/* ── Page content ── */}
      {page === 'stocks' && (
        <StocksPage
          categories={categories}
          interestingYears={interestingYears}
          view={view}
          setView={setView}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onBrowse={goBrowse}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarClose={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'enrichment' && <EnrichmentPage />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Search box (used in the hero dashboard and the sidebar)
   ════════════════════════════════════════════════════════════════ */
type SearchItem = { name: string; catName: string; catPos: number; catIdx: number };

function SearchBox({
  searchIndex,
  onSelect,
  size = 'sm',
}: {
  searchIndex: SearchItem[];
  onSelect: (item: SearchItem) => void;
  size?: 'sm' | 'lg';
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return searchIndex.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, searchIndex]);

  const lg = size === 'lg';

  return (
    <div className="relative">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className={`absolute top-1/2 -translate-y-1/2 right-4 text-muted pointer-events-none ${lg ? 'w-5 h-5' : 'w-4 h-4 right-3'}`}
          fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
        >
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={lg ? 'חפשו חברה לפי שם…' : 'חיפוש חברה…'}
          className={`w-full bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] rounded-2xl text-ink placeholder:text-muted outline-none ring-0 focus:ring-2 focus:ring-accent/60 transition-all duration-500 ease-apple ${
            lg ? 'pr-12 pl-4 py-4 text-lg' : 'pr-10 pl-3 py-2.5 text-sm rounded-xl'
          }`}
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl bg-[#1d1d1f] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10 overflow-hidden text-right">
          {results.map((item, i) => (
            <button
              key={i}
              onMouseDown={() => { onSelect(item); setQuery(''); setOpen(false); }}
              className="w-full text-right px-4 py-3 flex flex-col gap-0.5 hover:bg-white/[0.06] transition-colors duration-300"
            >
              <span className="text-sm text-ink font-medium">{item.name}</span>
              <span className="text-[11px] text-muted">{item.catName}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl bg-[#1d1d1f]/95 backdrop-blur-2xl ring-1 ring-white/10 px-4 py-4 text-sm text-muted text-center">
          לא נמצאו תוצאות
        </div>
      )}
      {searchIndex.length > 0 && (
        <div className={`text-muted mt-2 ${lg ? 'text-xs text-right pr-1' : 'text-[11px] text-center'}`}>
          {searchIndex.length} מניות לחיפוש
        </div>
      )}
    </div>
  );
}

/* ── Status detection (same logic as admin page) ── */
type CompanyStatus = 'מעניינת' | 'למעקב' | 'לא עוברת' | null;

function detectStatus(html: string): CompanyStatus {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tail = text.slice(-200);
  // Handle typos like "ל א עוברת" (ל outside <strong> tag)
  if (/ל\s*א\s*עוברת/.test(tail)) return 'לא עוברת';
  if (tail.includes('לא עוברת')) return 'לא עוברת';
  if (tail.includes('למעקב')) return 'למעקב';
  if (tail.includes('מעניינת')) return 'מעניינת';
  return null;
}

/* ════════════════════════════════════════════════════════════════
   Stocks Page (existing functionality)
   ════════════════════════════════════════════════════════════════ */
function StocksPage({
  categories,
  interestingYears,
  view,
  setView,
  statusFilter,
  setStatusFilter,
  onBrowse,
  mobileSidebarOpen,
  onMobileSidebarClose,
}: {
  categories: Category[];
  interestingYears: string[];
  view: View;
  setView: (v: View) => void;
  statusFilter: CompanyStatus;
  setStatusFilter: (s: CompanyStatus) => void;
  onBrowse: () => void;
  mobileSidebarOpen: boolean;
  onMobileSidebarClose: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [interesting, setInteresting] = useState<{
    preamble: string;
    companies: InterestingEntry[];
  }>({ preamble: '', companies: [] });
  const [loading, setLoading] = useState(false);
  const [searchIndex, setSearchIndex] = useState<SearchItem[]>([]);
  const [statusCompanies, setStatusCompanies] = useState<Array<{name: string; catName: string; catIdx: number; html: string; status: CompanyStatus; reviews: Record<string, string>}>>([]);
  const [statusCounts, setStatusCounts] = useState<{interesting: number; watch: number; notPassing: number}>({interesting: 0, watch: 0, notPassing: 0});

  const isLanding = view.type === 'intro' && !statusFilter;

  // Load search index once (cache-bust to always get fresh data after deploy)
  useEffect(() => {
    fetch(`/data/search-index.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(() => {});
  }, []);

  // Load all category files and build status index
  useEffect(() => {
    async function buildStatusIndex() {
      // Load interesting-2026 list to override status for curated stocks
      let interestingNames = new Set<string>();
      try {
        const intRes = await fetch(`/data/interesting-2026.json?v=${Date.now()}`);
        const intData = await intRes.json();
        if (intData.companies) {
          // Store both full names and base names (without aliases in parentheses) for matching
          for (const c of intData.companies) {
            interestingNames.add(c.name);
            // Also add the base name (before parentheses) for fuzzy matching
            const baseName = c.name.replace(/\s*\(.*\)\s*$/, '').trim();
            if (baseName !== c.name) interestingNames.add(baseName);
          }
        }
      } catch {}

      const nonIntroCats = categories.filter(c => !c.name.includes('הקדמה'));
      const results = await Promise.all(
        nonIntroCats.map(async (cat, i) => {
          try {
            const res = await fetch(`/data/cat-${cat.position ?? i}.json?v=${Date.now()}`);
            const companies = await res.json();
            const arr = Array.isArray(companies) ? companies : companies.companies || [];
            return arr
              .filter((c: any) => c.reviews && c.reviews['2026'])
              .map((c: any) => {
                const html2026 = typeof c.reviews['2026'] === 'string' ? c.reviews['2026'] : Array.isArray(c.reviews['2026']) ? c.reviews['2026'].join('') : '';
                // Collect all years
                const reviews: Record<string, string> = {};
                for (const year of Object.keys(c.reviews || {}).sort().reverse()) {
                  const val = c.reviews[year];
                  reviews[year] = typeof val === 'string' ? val : Array.isArray(val) ? val.join('') : '';
                }
                // Use interesting-2026 list to override status for curated stocks
                let status = detectStatus(html2026);
                if (interestingNames.has(c.name)) {
                  status = 'מעניינת';
                }
                return {
                  name: c.name,
                  catName: cat.name,
                  catIdx: categories.indexOf(cat),
                  html: html2026,
                  status,
                  reviews,
                };
              });
          } catch {
            return [];
          }
        })
      );

      const all = results.flat();
      // Deduplicate by company name and filter out entries without a detected status
      const seen = new Set<string>();
      const unique = all.filter(c => {
        if (seen.has(c.name)) return false;
        seen.add(c.name);
        return true;
      });
      const withStatus = unique.filter(c => c.status !== null);
      setStatusCompanies(unique);
      setStatusCounts({
        interesting: withStatus.filter(c => c.status === 'מעניינת').length,
        watch: withStatus.filter(c => c.status === 'למעקב').length,
        notPassing: withStatus.filter(c => c.status === 'לא עוברת').length,
      });
    }
    buildStatusIndex();
  }, [categories]);

  const handleSelectResult = useCallback((item: SearchItem) => {
    setStatusFilter(null);
    setView({ type: 'cat', idx: item.catIdx });
    setFilter(item.name);
    onMobileSidebarClose();
    window.scrollTo({ top: 0 });
  }, [onMobileSidebarClose, setStatusFilter, setView]);

  useEffect(() => {
    if (view.type === 'cat') {
      const cat = categories[view.idx];
      if (!cat) return;
      setLoading(true);
      fetch(`/data/cat-${cat.position ?? view.idx}.json?v=${Date.now()}`)
        .then((r) => r.json())
        .then((d) => setCompanies(Array.isArray(d) ? d : d.companies || []))
        .finally(() => setLoading(false));
    } else if (view.type === 'interesting') {
      setLoading(true);
      fetch(`/data/interesting-${view.year}.json?v=${Date.now()}`)
        .then((r) => r.json())
        .then((d) => setInteresting(d))
        .finally(() => setLoading(false));
    }
  }, [view, categories]);

  const filteredCategories = useMemo(() => {
    return categories.map((c, i) => ({ cat: c, idx: i }));
  }, [categories]);

  const intro = categories.find((c) => c.name.includes('הקדמה'))?.intro as
    | Record<string, string>
    | null;

  const go = (v: View) => {
    setView(v);
    setFilter('');
    setStatusFilter(null);
    onMobileSidebarClose();
    window.scrollTo({ top: 0 });
  };

  const navItem = (active: boolean, extra = '') =>
    `w-full text-right px-3 py-2 rounded-xl mb-0.5 text-sm transition-all duration-500 ease-apple ${
      active ? 'bg-ink text-black font-semibold' : `text-slate-300 hover:bg-white/[0.06] hover:text-ink ${extra}`
    }`;

  /* Sidebar content — reused in both desktop aside and mobile drawer */
  const sidebarContent = (
    <>
      <div className="mb-4">
        <SearchBox searchIndex={searchIndex} onSelect={handleSelectResult} />
      </div>
      <button onClick={() => go({ type: 'intro' })} className={navItem(false) + ' mb-3'}>
        ← דף הבית
      </button>
      {interestingYears.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-muted px-3 mb-1.5">מדד מניות מעניינות</div>
          {interestingYears.map((y) => (
            <button
              key={y}
              onClick={() => go({ type: 'interesting', year: y })}
              className={navItem(view.type === 'interesting' && view.year === y && !statusFilter)}
            >
              מעניינות {y}
            </button>
          ))}
        </div>
      )}
      <div className="text-[11px] font-semibold text-muted px-3 mb-1.5 pt-3 border-t border-white/[0.06]">סקטורים</div>
      {filteredCategories
        .filter(({ cat }) => !cat.name.includes('הקדמה'))
        .map(({ cat, idx }) => (
          <button
            key={cat.id}
            onClick={() => go({ type: 'cat', idx })}
            className={navItem(view.type === 'cat' && view.idx === idx && !statusFilter) + ' flex justify-between items-center'}
          >
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
    </>
  );

  const totalCompanies = statusCompanies.length; // all unique companies with 2026 reviews

  /* ── Landing (home) ── */
  if (isLanding) {
    return (
      <Landing
        total={totalCompanies}
        counts={statusCounts}
        searchCount={searchIndex.length}
        categoriesCount={categories.filter((c) => !c.name.includes('הקדמה')).length}
        years={YEARS}
        searchSlot={<SearchBox size="lg" searchIndex={searchIndex} onSelect={handleSelectResult} />}
        intro={intro}
        interestingYears={interestingYears}
        onBrowse={onBrowse}
        onStatus={(s) => { setStatusFilter(s); window.scrollTo({ top: 0 }); }}
        onInteresting={(y) => go({ type: 'interesting', year: y })}
      />
    );
  }

  const ribbonBtn = (key: NonNullable<CompanyStatus>, label: string, dot: string, value: number) => (
    <button
      onClick={() => { setStatusFilter(statusFilter === key ? null : key); window.scrollTo({ top: 0 }); }}
      className={`flex items-center gap-2 py-1.5 px-3.5 rounded-full transition-all duration-500 ease-apple ${
        statusFilter === key ? 'bg-ink text-black' : 'text-slate-300 hover:bg-white/[0.06]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </button>
  );

  /* ── Explorer ── */
  return (
    <div className="flex flex-col flex-1">
      {/* ── Status filter ribbon ── */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
        {ribbonBtn('מעניינת', 'מעניינות', 'bg-emerald-400', statusCounts.interesting)}
        {ribbonBtn('למעקב', 'למעקב', 'bg-amber-400', statusCounts.watch)}
        {ribbonBtn('לא עוברת', 'לא עוברות', 'bg-slate-500', statusCounts.notPassing)}
        <div className="text-muted text-xs pr-2">
          סה״כ <span className="text-slate-300 font-semibold tabular-nums">{totalCompanies}</span> חברות
        </div>
      </div>

    <div className="flex flex-1 relative">
      {/* ── Mobile drawer overlay ── */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-500 ease-apple ${
          mobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileSidebarClose}
      >
        <div
          className={`absolute top-0 right-0 h-full w-[300px] bg-[#1d1d1f]/95 backdrop-blur-2xl p-4 overflow-y-auto scroll-quiet transition-transform duration-500 ease-apple ${
            mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-ink">סקטורים</span>
            <button onClick={onMobileSidebarClose} className="text-muted hover:text-ink text-lg px-1 transition-colors" aria-label="סגור">✕</button>
          </div>
          {sidebarContent}
        </div>
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:block w-[290px] px-4 py-2 sticky top-12 h-[calc(100vh-48px)] overflow-y-auto scroll-quiet shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 px-5 py-6 lg:px-10 lg:py-10 max-w-5xl mx-auto w-full min-w-0">
        {loading && <div className="text-muted text-sm animate-pulse">טוען…</div>}

        {statusFilter && (
          <Reveal key={statusFilter}>
            <div className="mb-8">
              <button
                onClick={() => setStatusFilter(null)}
                className="text-sm text-accent hover:underline underline-offset-4 mb-4"
              >
                נקה סינון
              </button>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-ink">
                {statusFilter === 'מעניינת' && 'חברות מעניינות.'}
                {statusFilter === 'למעקב' && 'חברות למעקב.'}
                {statusFilter === 'לא עוברת' && 'חברות שלא עוברות.'}
              </h2>
              <div className="text-lg text-muted mt-3">
                {statusCompanies.filter(c => c.status === statusFilter).length} חברות
              </div>
            </div>
            <div className="space-y-3">
              {statusCompanies
                .filter(c => c.status === statusFilter)
                .sort((a, b) => a.name.localeCompare(b.name, 'he'))
                .map((c) => (
                  <div key={c.name + c.catName} className="card-depth rounded-2xl overflow-hidden transition-colors duration-500 ease-apple hover:bg-[#232325]">
                    <StatusCompanyCard company={c} onNavigate={(catIdx, name) => {
                      setStatusFilter(null);
                      setView({ type: 'cat', idx: catIdx });
                      setFilter(name);
                      window.scrollTo({ top: 0 });
                    }} />
                  </div>
                ))}
            </div>
          </Reveal>
        )}

        {!statusFilter && view.type === 'cat' && !loading && categories[view.idx] && (
          <CategoryView
            key={view.idx}
            category={categories[view.idx]}
            companies={companies}
            filter={filter}
            onClearFilter={() => setFilter('')}
          />
        )}

        {!statusFilter && view.type === 'interesting' && !loading && (
          <InterestingView
            key={view.year}
            year={view.year}
            preamble={interesting.preamble}
            companies={interesting.companies}
            years={interestingYears}
            onYearChange={(y) => setView({ type: 'interesting', year: y })}
            filter={filter}
          />
        )}
      </main>
    </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Enrichment Page — YouTube video gallery
   ════════════════════════════════════════════════════════════════ */
function EnrichmentPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    // Load video list, then try to fetch titles
    fetch('/data/videos.json')
      .then((r) => r.json())
      .then(async (vids: VideoItem[]) => {
        // Show videos immediately (without titles), then fetch titles in background
        const filtered = vids.filter((v) => !v.title || !isExcluded(v.title));
        // Sort: priority first, then newest first by addedAt
        filtered.sort((a, b) => {
          if (a.priority && !b.priority) return -1;
          if (!a.priority && b.priority) return 1;
          // Within same priority group, newest first
          const aTime = a.addedAt || '2000-01-01';
          const bTime = b.addedAt || '2000-01-01';
          return bTime.localeCompare(aTime);
        });
        setVideos(filtered);
        setLoading(false);

        // Fetch titles in parallel from noembed (CORS-friendly), with timeout
        const withTitles = await Promise.all(
          filtered.map(async (v) => {
            if (v.title) return v;
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 4000);
              const res = await fetch(
                `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${v.id}`,
                { signal: controller.signal }
              );
              clearTimeout(timeout);
              const data = await res.json();
              const title = data.title || '';
              if (title && isExcluded(title)) return null; // mark for removal
              return { ...v, title };
            } catch {
              return v;
            }
          })
        );
        const finalVideos = withTitles.filter((v): v is VideoItem => v !== null);
        setVideos(finalVideos);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 px-6 pt-20 md:pt-28 pb-32 max-w-6xl mx-auto w-full">
      <div className="text-center mb-16 md:mb-24">
        <Reveal as="p" className="text-titanium text-base md:text-lg font-semibold mb-4">העשרה</Reveal>
        <Reveal as="h1" delay={80} className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] text-ink">
          לשמוע את הניתוח.
        </Reveal>
        <Reveal as="p" delay={160} className="mt-6 mx-auto max-w-xl text-lg md:text-xl leading-relaxed text-muted">
          סרטונים ופודקאסטים של שלומי ארדן. שיחות זום, ראיונות וניתוחים.
        </Reveal>
      </div>

      {loading && <div className="text-muted text-sm text-center animate-pulse">טוען סרטונים…</div>}

      {/* Video playing modal */}
      {playingId && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setPlayingId(null)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
              className="w-full h-full rounded-[20px] shadow-[0_40px_120px_-20px_rgba(0,0,0,1)]"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setPlayingId(null)}
              className="absolute -top-12 left-0 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-ink text-base transition-colors duration-500"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((v) => (
          <Reveal
            key={v.id}
            className="card-depth rounded-[24px] overflow-hidden cursor-pointer group transition-transform duration-900 ease-apple hover:scale-[1.02]"
          >
          <div onClick={() => setPlayingId(v.id)}>
            {/* Thumbnail */}
            <div className="relative aspect-video bg-black overflow-hidden">
              <img
                src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                alt={v.title || 'סרטון'}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-[1.04] transition-all duration-900 ease-apple"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${v.id}/default.jpg`; }}
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-xl ring-1 ring-white/25 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-white/25 transition-all duration-700 ease-apple">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 text-white fill-current mr-[-2px]">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Priority badge */}
              {v.priority && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xl text-ink text-[11px] font-semibold px-2.5 py-1 rounded-full">
                  פודקאסט שנתי
                </div>
              )}
            </div>
            {/* Title */}
            <div className="p-5">
              <div className="text-[15px] font-medium text-ink line-clamp-2 leading-relaxed">
                {v.title || (v.priority ? 'פודקאסט שנתי' : 'סרטון')}
              </div>
            </div>
          </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Sub-views
   ════════════════════════════════════════════════════════════════ */
function CategoryView({
  category,
  companies,
  filter,
  onClearFilter,
}: {
  category: Category;
  companies: Company[];
  filter: string;
  onClearFilter: () => void;
}) {
  const filtered = useMemo(() => {
    if (!filter) return companies;
    const f = filter.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(f));
  }, [companies, filter]);

  const intro = category.intro as Record<string, string> | null;
  const [introYear, setIntroYear] = useState<string | null>(null);
  const introYears = intro ? Object.keys(intro).sort().reverse() : [];

  return (
    <Reveal>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink mb-3">{category.name}</h1>
      <div className="text-muted text-lg mb-8 flex items-center gap-4">
        <span>{filtered.length} חברות</span>
        {filter && (
          <button
            onClick={onClearFilter}
            className="text-accent text-sm hover:underline underline-offset-4"
          >
            הצג הכל ({companies.length})
          </button>
        )}
      </div>

      {intro && introYears.length > 0 && (
        <div className="mb-8 card-depth rounded-[24px] p-6 md:p-8">
          <div className="inline-flex rounded-full bg-black/40 p-1 mb-4">
            {introYears.map((y) => (
              <button
                key={y}
                onClick={() => setIntroYear(y === introYear ? null : y)}
                className={`px-4 py-1.5 rounded-full text-xs transition-all duration-500 ease-apple ${
                  y === (introYear || introYears[0])
                    ? 'bg-ink text-black font-semibold'
                    : 'text-slate-300 hover:text-ink'
                }`}
              >
                הקדמה {y}
              </button>
            ))}
          </div>
          <div
            className="review-body text-sm"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(intro[introYear || introYears[0]] || ''),
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <CompanyCard key={c.id} company={c} years={YEARS} />
        ))}
      </div>
    </Reveal>
  );
}

function InterestingView({
  year,
  preamble,
  companies,
  years,
  onYearChange,
  filter,
}: {
  year: string;
  preamble: string;
  companies: InterestingEntry[];
  years: string[];
  onYearChange: (y: string) => void;
  filter: string;
}) {
  const filtered = useMemo(() => {
    if (!filter) return companies;
    const f = filter.toLowerCase();
    return companies.filter((c) => c.name.toLowerCase().includes(f));
  }, [companies, filter]);

  return (
    <Reveal>
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink mb-5">
        מדד המניות המעניינות {year}.
      </h1>
      <div className="inline-flex rounded-full bg-[#1d1d1f] p-1 mb-4">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`px-5 py-1.5 rounded-full text-sm tabular-nums transition-all duration-500 ease-apple ${
              y === year
                ? 'bg-ink text-black font-semibold'
                : 'text-slate-300 hover:text-ink'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="text-muted text-lg mb-8">{filtered.length} חברות מעניינות</div>

      {preamble && (
        <div
          className="review-body card-depth rounded-[24px] p-6 md:p-8 mb-8 text-[15px]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(preamble) }}
        />
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <InterestingCard key={c.id} entry={c} />
        ))}
      </div>
    </Reveal>
  );
}

function InterestingCard({ entry }: { entry: InterestingEntry }) {
  const [open, setOpen] = useState(false);
  const preview = entry.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
  return (
    <div className="card-depth rounded-2xl overflow-hidden transition-colors duration-500 ease-apple hover:bg-[#232325]">
      <div
        className="p-5 cursor-pointer flex justify-between items-start gap-4"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[17px] text-ink mb-1.5 flex items-center gap-2.5 flex-wrap">
            <span className="text-muted tabular-nums">{entry.num}</span>
            <span>{entry.name}</span>
            <StatusPill status="מעניינת" />
          </div>
          {!open && <div className="text-sm text-muted truncate">{preview}…</div>}
        </div>
        <Disclosure open={open} />
      </div>
      {open && (
        <div
          className="review-body px-6 pb-6 pt-2 text-[15px]"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.html) }}
        />
      )}
    </div>
  );
}

function StatusCompanyCard({ company, onNavigate }: {
  company: { name: string; catName: string; catIdx: number; html: string; status: CompanyStatus; reviews: Record<string, string> };
  onNavigate: (catIdx: number, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const years = Object.keys(company.reviews).sort().reverse();
  const [selectedYear, setSelectedYear] = useState(years[0] || '2026');
  const preview = company.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);

  const currentHtml = company.reviews[selectedYear] || '';
  const currentStatus = detectStatus(currentHtml);
  const yearStatusColor = currentStatus === 'מעניינת' ? 'text-emerald-400' : currentStatus === 'למעקב' ? 'text-amber-400' : 'text-slate-400';

  return (
    <>
      <div
        className="p-5 cursor-pointer flex justify-between items-start gap-4"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[17px] text-ink mb-1 flex items-center gap-2.5 flex-wrap">
            <span>{company.name}</span>
            {company.status && <StatusPill status={company.status} />}
          </div>
          <div className="text-xs text-muted mb-1.5">{company.catName}</div>
          {!open && <div className="text-sm text-muted truncate">{preview}…</div>}
        </div>
        <div className="flex items-center gap-3">
          {years.length > 1 && <span className="text-[11px] text-slate-600">{years.length} שנים</span>}
          <Disclosure open={open} />
        </div>
      </div>
      {open && (
        <div>
          {/* Year tabs */}
          {years.length > 1 && (
            <div className="mx-5 inline-flex gap-1 rounded-full bg-black/40 p-1">
              {years.map((y) => {
                const ys = detectStatus(company.reviews[y]);
                const dotColor = ys === 'מעניינת' ? 'bg-emerald-400' : ys === 'למעקב' ? 'bg-amber-400' : ys === 'לא עוברת' ? 'bg-slate-500' : 'bg-slate-700';
                return (
                  <button
                    key={y}
                    onClick={(e) => { e.stopPropagation(); setSelectedYear(y); }}
                    className={`px-3.5 py-1.5 rounded-full text-xs tabular-nums flex items-center gap-1.5 transition-all duration-500 ease-apple ${
                      selectedYear === y
                        ? 'bg-ink text-black font-semibold'
                        : 'text-slate-300 hover:text-ink'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    {y}
                  </button>
                );
              })}
            </div>
          )}
          {/* Status for selected year */}
          {currentStatus && selectedYear !== years[0] && (
            <div className={`px-6 pt-3 text-xs ${yearStatusColor}`}>
              {currentStatus} ב-{selectedYear}
            </div>
          )}
          <div
            className="review-body px-6 pb-4 pt-3 text-[15px]"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentHtml) }}
          />
          <div className="px-6 pb-5">
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate(company.catIdx, company.name); }}
              className="text-sm text-accent hover:underline underline-offset-4"
            >
              לסקטור {company.catName} ‹
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Mobile categories button — shown only on small screens ── */
function MobileCategoriesButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-ink text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors duration-500"
      aria-label="פתח סקטורים"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
      סקטורים וחיפוש
    </button>
  );
}
