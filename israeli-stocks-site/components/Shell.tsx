'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Company, InterestingEntry } from '@/lib/supabase';
import CompanyCard from './CompanyCard';
import SA20Chart from './SA20Chart';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const switchPage = useCallback((p: Page) => {
    setPage(p);
    setMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top navbar ── */}
      <nav className="bg-panel border-b border-border px-4 py-2 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          {/* Right side (RTL): hamburger + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-md hover:bg-slate-800 transition-colors"
              aria-label="תפריט"
            >
              <span className={`block w-5 h-[2px] bg-slate-300 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block w-5 h-[2px] bg-slate-300 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-[2px] bg-slate-300 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </button>
            <span className="text-sm font-bold text-slate-100">
              {page === 'stocks' ? 'סקירת מניות ישראל' : 'העשרה'}
            </span>
          </div>
          {/* Left side (RTL): author */}
          <div className="text-[11px] text-muted">שלומי ארדן</div>
        </div>
        {/* Categories ribbon — mobile only, below nav row */}
        {page === 'stocks' && (
          <div className="mt-2 lg:hidden">
            <MobileCategoriesButton onOpen={() => setMobileSidebarOpen(true)} />
          </div>
        )}
      </nav>

      {/* ── Dropdown menu ── */}
      {menuOpen && (
        <div className="absolute top-[42px] right-4 z-[60] bg-panel border border-border rounded-xl shadow-xl overflow-hidden w-56">
          <button
            onClick={() => switchPage('stocks')}
            className={`w-full text-right px-4 py-3 text-sm flex items-center gap-2 ${
              page === 'stocks' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📊 סקירת מניות ישראל
          </button>
          <button
            onClick={() => switchPage('enrichment')}
            className={`w-full text-right px-4 py-3 text-sm flex items-center gap-2 border-t border-border ${
              page === 'enrichment' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            🎓 העשרה
          </button>
        </div>
      )}

      {/* ── Click-away overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
      )}

      {/* ── Page content ── */}
      {page === 'stocks' && (
        <StocksPage
          categories={categories}
          interestingYears={interestingYears}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarClose={() => setMobileSidebarOpen(false)}
        />
      )}
      {page === 'enrichment' && <EnrichmentPage />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Stocks Page (existing functionality)
   ════════════════════════════════════════════════════════════════ */
function StocksPage({
  categories,
  interestingYears,
  mobileSidebarOpen,
  onMobileSidebarClose,
}: {
  categories: Category[];
  interestingYears: string[];
  mobileSidebarOpen: boolean;
  onMobileSidebarClose: () => void;
}) {
  const [view, setView] = useState<View>({ type: 'intro' });
  const [filter, setFilter] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [interesting, setInteresting] = useState<{
    preamble: string;
    companies: InterestingEntry[];
  }>({ preamble: '', companies: [] });
  const [loading, setLoading] = useState(false);
  const [searchIndex, setSearchIndex] = useState<Array<{ name: string; catName: string; catPos: number; catIdx: number }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Load search index once (cache-bust to always get fresh data after deploy)
  useEffect(() => {
    fetch(`/data/search-index.json?v=${Date.now()}`)
      .then((r) => r.json())
      .then(setSearchIndex)
      .catch(() => {});
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return searchIndex
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, searchIndex]);

  const handleSelectResult = useCallback((item: { catIdx: number; catPos: number; name: string }) => {
    setView({ type: 'cat', idx: item.catIdx });
    setFilter(item.name);
    setSearchQuery('');
    setShowDropdown(false);
    onMobileSidebarClose();
  }, [onMobileSidebarClose]);

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

  /* Sidebar content — reused in both desktop aside and mobile drawer */
  const sidebarContent = (
    <>
      {/* Smart search with dropdown */}
      <div className="relative mb-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="חיפוש חברה..."
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-accent"
        />
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full right-0 left-0 z-50 bg-[#0f1a2e] border border-border rounded-xl shadow-2xl overflow-hidden mt-1">
            {searchResults.map((item, i) => (
              <button
                key={i}
                onMouseDown={() => handleSelectResult(item)}
                className="w-full text-right px-3 py-2.5 flex flex-col gap-0.5 hover:bg-slate-800 border-b border-border/50 last:border-0 transition-colors"
              >
                <span className="text-sm text-slate-100 font-medium">{item.name}</span>
                <span className="text-[11px] text-muted">{item.catName}</span>
              </button>
            ))}
          </div>
        )}
        {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="absolute top-full right-0 left-0 z-50 bg-[#0f1a2e] border border-border rounded-xl shadow-2xl mt-1 px-3 py-3 text-sm text-muted text-center">
            לא נמצאו תוצאות
          </div>
        )}
        {searchIndex.length > 0 && (
          <div className="text-[11px] text-muted text-center mt-1">{searchIndex.length} מניות לחיפוש</div>
        )}
      </div>
      <button
        onClick={() => { setView({ type: 'intro' }); setFilter(''); onMobileSidebarClose(); }}
        className={`w-full text-right px-3 py-2 rounded-md mb-2 text-sm font-semibold ${
          view.type === 'intro' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
        }`}
      >
        📖 הקדמה
      </button>
      {interestingYears.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] text-muted px-1 mb-1">⭐ מדד מניות מעניינות</div>
          {interestingYears.map((y) => (
            <button
              key={y}
              onClick={() => { setView({ type: 'interesting', year: y }); setFilter(''); onMobileSidebarClose(); }}
              className={`w-full text-right px-3 py-2 rounded-md mb-1 text-sm ${
                view.type === 'interesting' && view.year === y
                  ? 'bg-accent text-white' : 'text-amber-300 hover:bg-slate-800'
              }`}
            >
              ⭐ מעניינות {y}
            </button>
          ))}
        </div>
      )}
      <div className="text-[11px] text-muted px-1 mb-1 border-t border-border pt-2">קטגוריות</div>
      {filteredCategories
        .filter(({ cat }) => !cat.name.includes('הקדמה'))
        .map(({ cat, idx }) => (
          <button
            key={cat.id}
            onClick={() => { setView({ type: 'cat', idx }); setFilter(''); onMobileSidebarClose(); }}
            className={`w-full text-right px-3 py-2 rounded-md mb-1 text-sm flex justify-between items-center ${
              view.type === 'cat' && view.idx === idx
                ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="truncate">{cat.name}</span>
          </button>
        ))}
    </>
  );

  return (
    <div className="flex flex-1 relative">
      {/* ── Mobile drawer overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 lg:hidden"
          onClick={onMobileSidebarClose}
        >
          <div
            className="absolute top-0 right-0 h-full w-[280px] bg-panel border-l border-border p-3 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <button onClick={onMobileSidebarClose} className="text-muted text-xl px-1">✕</button>
              <span className="text-sm font-semibold text-slate-200">קטגוריות</span>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:block w-[280px] bg-panel border-l border-border p-3 sticky top-[44px] h-[calc(100vh-44px)] overflow-y-auto shrink-0">
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 lg:p-6 max-w-5xl mx-auto w-full min-w-0">
        {loading && <div className="text-muted text-sm">טוען...</div>}

        {view.type === 'intro' && intro && (
          <>
            <IntroView intro={intro} />
            <SA20Chart />
          </>
        )}

        {view.type === 'cat' && !loading && (
          <CategoryView
            category={categories[view.idx]}
            companies={companies}
            filter={filter}
            onClearFilter={() => setFilter('')}
          />
        )}

        {view.type === 'interesting' && !loading && (
          <InterestingView
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
    // Load video list, then fetch titles from YouTube oEmbed
    fetch('/data/videos.json')
      .then((r) => r.json())
      .then(async (vids: VideoItem[]) => {
        // Fetch titles in parallel from noembed (CORS-friendly)
        const withTitles = await Promise.all(
          vids.map(async (v) => {
            try {
              const res = await fetch(
                `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${v.id}`
              );
              const data = await res.json();
              return { ...v, title: data.title || v.title || '' };
            } catch {
              return v;
            }
          })
        );

        // Filter out excluded videos
        const filtered = withTitles.filter((v) => !v.title || !isExcluded(v.title));

        // Sort: priority (podcasts) first, then rest
        filtered.sort((a, b) => {
          if (a.priority && !b.priority) return -1;
          if (!a.priority && b.priority) return 1;
          return 0;
        });

        setVideos(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">🎓 העשרה</h1>
      <p className="text-muted text-sm mb-6">
        סרטונים ופודקאסטים של שלומי ארדן — שיחות זום, ראיונות, וניתוחים
      </p>

      {loading && <div className="text-muted text-sm">טוען סרטונים...</div>}

      {/* Video playing modal */}
      {playingId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPlayingId(null)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={`https://www.youtube.com/embed/${playingId}?autoplay=1`}
              className="w-full h-full rounded-xl"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              onClick={() => setPlayingId(null)}
              className="absolute -top-10 left-0 text-white text-2xl hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {videos.map((v) => (
          <div
            key={v.id}
            onClick={() => setPlayingId(v.id)}
            className="bg-panel border border-border rounded-xl overflow-hidden cursor-pointer group hover:border-accent transition-colors"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-slate-900">
              <img
                src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`}
                alt={v.title || 'סרטון'}
                className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current mr-[-2px]">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Priority badge */}
              {v.priority && (
                <div className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                  פודקאסט שנתי
                </div>
              )}
            </div>
            {/* Title */}
            <div className="p-3">
              <div className="text-sm font-medium text-slate-200 line-clamp-2 leading-relaxed">
                {v.title || 'טוען...'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Sub-views (unchanged)
   ════════════════════════════════════════════════════════════════ */
function IntroView({ intro }: { intro: Record<string, string> }) {
  const years = Object.keys(intro).sort().reverse();
  const [year, setYear] = useState(years[0]);
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">הקדמה</h1>
      <div className="flex gap-2 mb-4">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold border ${
              y === year
                ? 'bg-accent border-accent text-white'
                : 'bg-panel border-border text-muted'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div
        className="review-body bg-panel border border-border rounded-xl p-6"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(intro[year] || '') }}
      />
    </div>
  );
}

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
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">{category.name}</h1>
      <div className="text-muted text-sm mb-4 flex items-center gap-2">
        <span>{filtered.length} חברות</span>
        {filter && (
          <button
            onClick={onClearFilter}
            className="text-accent text-xs hover:underline"
          >
            הצג הכל ({companies.length})
          </button>
        )}
      </div>

      {intro && introYears.length > 0 && (
        <div className="mb-6 bg-panel border border-border rounded-xl p-5">
          <div className="flex gap-2 mb-3">
            {introYears.map((y) => (
              <button
                key={y}
                onClick={() => setIntroYear(y === introYear ? null : y)}
                className={`px-3 py-1 rounded-md text-xs font-semibold border ${
                  y === (introYear || introYears[0])
                    ? 'bg-accent border-accent text-white'
                    : 'bg-bg border-border text-muted'
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
    </div>
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
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">
        ⭐ מדד מניות מעניינות {year}
      </h1>
      <div className="flex gap-2 mb-4">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold border ${
              y === year
                ? 'bg-accent border-accent text-white'
                : 'bg-panel border-border text-muted'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
      <div className="text-muted text-sm mb-4">{filtered.length} חברות מעניינות</div>

      {preamble && (
        <div
          className="review-body bg-panel border border-border rounded-xl p-5 mb-6 text-sm"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(preamble) }}
        />
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <InterestingCard key={c.id} entry={c} />
        ))}
      </div>
    </div>
  );
}

function InterestingCard({ entry }: { entry: InterestingEntry }) {
  const [open, setOpen] = useState(false);
  const preview = entry.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220);
  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer flex justify-between items-start gap-3"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-100 mb-1">
            {entry.num}. {entry.name}{' '}
            <span className="inline-block bg-emerald-700/40 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full">
              מעניינת
            </span>
          </div>
          {!open && <div className="text-xs text-muted truncate">{preview}...</div>}
        </div>
        <div className="text-muted text-lg">{open ? '▴' : '▾'}</div>
      </div>
      {open && (
        <div
          className="review-body px-5 pb-5 border-t border-border pt-4"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(entry.html) }}
        />
      )}
    </div>
  );
}

/* ── Mobile categories button — shown only on small screens ── */
function MobileCategoriesButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-border text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
      aria-label="פתח קטגוריות"
    >
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
      </svg>
      קטגוריות
    </button>
  );
}
