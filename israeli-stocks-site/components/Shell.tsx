'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Company, InterestingEntry } from '@/lib/supabase';
import CompanyCard from './CompanyCard';

const YEARS = ['2026', '2025', '2024'];

type Page = 'stocks' | 'enrichment' | 'index';

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

  const switchPage = useCallback((p: Page) => {
    setPage(p);
    setMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top navbar ── */}
      <nav className="bg-panel border-b border-border px-4 py-2 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* Hamburger button */}
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
            {page === 'stocks' ? 'סקירת מניות ישראל' : page === 'index' ? 'מדד מניות מעניינות 2026' : 'העשרה'}
          </span>
        </div>
        <div className="text-[11px] text-muted">שלומי ארדן</div>
      </nav>

      {/* ── Dropdown menu ── */}
      {menuOpen && (
        <div className="absolute top-[44px] right-4 z-50 bg-panel border border-border rounded-xl shadow-xl overflow-hidden w-56">
          <button
            onClick={() => switchPage('stocks')}
            className={`w-full text-right px-4 py-3 text-sm flex items-center gap-2 ${
              page === 'stocks' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📊 סקירת מניות ישראל
          </button>
          <button
            onClick={() => switchPage('index')}
            className={`w-full text-right px-4 py-3 text-sm flex items-center gap-2 border-t border-border ${
              page === 'index' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📈 מדד מניות מעניינות 2026
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
        <StocksPage categories={categories} interestingYears={interestingYears} />
      )}
      {page === 'index' && <StockIndexPage />}
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
}: {
  categories: Category[];
  interestingYears: string[];
}) {
  const [view, setView] = useState<View>({ type: 'intro' });
  const [filter, setFilter] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [interesting, setInteresting] = useState<{
    preamble: string;
    companies: InterestingEntry[];
  }>({ preamble: '', companies: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (view.type === 'cat') {
      const cat = categories[view.idx];
      if (!cat) return;
      setLoading(true);
      fetch(`/data/cat-${cat.position ?? view.idx}.json`)
        .then((r) => r.json())
        .then((d) => setCompanies(Array.isArray(d) ? d : d.companies || []))
        .finally(() => setLoading(false));
    } else if (view.type === 'interesting') {
      setLoading(true);
      fetch(`/data/interesting-${view.year}.json`)
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

  return (
    <div className="flex flex-1">
      <aside className="w-[280px] bg-panel border-l border-border p-3 sticky top-[44px] h-[calc(100vh-44px)] overflow-y-auto shrink-0">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="חיפוש חברה או טקסט..."
          className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-slate-200 mb-3 placeholder:text-slate-500 focus:outline-none focus:border-accent"
        />

        <button
          onClick={() => setView({ type: 'intro' })}
          className={`w-full text-right px-3 py-2 rounded-md mb-2 text-sm font-semibold ${
            view.type === 'intro'
              ? 'bg-accent text-white'
              : 'text-slate-300 hover:bg-slate-800'
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
                onClick={() => setView({ type: 'interesting', year: y })}
                className={`w-full text-right px-3 py-2 rounded-md mb-1 text-sm ${
                  view.type === 'interesting' && view.year === y
                    ? 'bg-accent text-white'
                    : 'text-amber-300 hover:bg-slate-800'
                }`}
              >
                ⭐ מעניינות {y}
              </button>
            ))}
          </div>
        )}

        <div className="text-[11px] text-muted px-1 mb-1 border-t border-border pt-2">
          קטגוריות
        </div>
        {filteredCategories
          .filter(({ cat }) => !cat.name.includes('הקדמה'))
          .map(({ cat, idx }) => (
            <button
              key={cat.id}
              onClick={() => setView({ type: 'cat', idx })}
              className={`w-full text-right px-3 py-2 rounded-md mb-1 text-sm flex justify-between items-center ${
                view.type === 'cat' && view.idx === idx
                  ? 'bg-accent text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{cat.name}</span>
            </button>
          ))}
      </aside>

      <main className="flex-1 p-6 max-w-5xl mx-auto">
        {loading && <div className="text-muted text-sm">טוען...</div>}

        {view.type === 'intro' && intro && <IntroView intro={intro} />}

        {view.type === 'cat' && !loading && (
          <CategoryView
            category={categories[view.idx]}
            companies={companies}
            filter={filter}
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
   Stock Index Page — Average performance chart of 2026 interesting stocks
   ════════════════════════════════════════════════════════════════ */
interface IndexDataPoint {
  date: string;
  value: number;
  count: number;
}
interface StockPerf {
  name: string;
  ticker: string;
  pctChange: number;
  latestPrice: number;
}
interface IndexResponse {
  indexData: IndexDataPoint[];
  stockPerformance: StockPerf[];
  stockCount: number;
  totalStocks: number;
  failedTickers: Array<{ name: string; ticker: string }>;
  lastUpdated: string;
  error?: string;
}

function StockIndexPage() {
  const [data, setData] = useState<IndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stock-index')
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.indexData) {
          setError(d.error);
        } else {
          setData(d);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-4">📈 מדד מניות מעניינות 2026</h1>
        <div className="text-muted text-sm">טוען נתוני מניות...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-4">📈 מדד מניות מעניינות 2026</h1>
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
          {error || 'אין נתונים זמינים'}
        </div>
      </div>
    );
  }

  const latestPoint = data.indexData[data.indexData.length - 1];
  const isPositive = latestPoint && latestPoint.value >= 0;

  return (
    <div className="flex-1 p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">📈 מדד מניות מעניינות 2026</h1>
      <p className="text-muted text-sm mb-4">
        שינוי ממוצע של {data.stockCount} מניות מעניינות מתחילת 2026
      </p>

      {/* Big number */}
      {latestPoint && (
        <div className="bg-panel border border-border rounded-xl p-6 mb-6 text-center">
          <div className={`text-5xl font-bold mb-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{latestPoint.value}%
          </div>
          <div className="text-muted text-xs">
            עדכון אחרון: {new Date(data.lastUpdated).toLocaleDateString('he-IL')}
            {' · '}{data.stockCount}/{data.totalStocks} מניות
          </div>
        </div>
      )}

      {/* Chart */}
      {data.indexData.length > 1 && (
        <div className="bg-panel border border-border rounded-xl p-4 mb-6">
          <div className="text-sm font-semibold text-slate-300 mb-3">ביצועי המדד מתחילת 2026</div>
          <IndexChart data={data.indexData} />
        </div>
      )}

      {/* Individual stocks table */}
      {data.stockPerformance.length > 0 && (
        <div className="bg-panel border border-border rounded-xl overflow-hidden mb-6">
          <div className="text-sm font-semibold text-slate-300 p-4 border-b border-border">
            ביצועי מניות בודדות
          </div>
          <div className="divide-y divide-border">
            {data.stockPerformance.map((s) => (
              <div key={s.ticker} className="flex justify-between items-center px-4 py-3">
                <div>
                  <div className="text-sm text-slate-200">{s.name}</div>
                  <div className="text-[11px] text-muted">{s.ticker}</div>
                </div>
                <div className={`text-sm font-semibold ${s.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.pctChange >= 0 ? '+' : ''}{s.pctChange}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed tickers */}
      {data.failedTickers.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 text-amber-300 text-xs">
          <div className="font-semibold mb-1">לא הצלחנו לטעון {data.failedTickers.length} מניות:</div>
          {data.failedTickers.map((f) => (
            <span key={f.ticker} className="inline-block bg-amber-900/40 rounded px-2 py-0.5 ml-1 mb-1">
              {f.name} ({f.ticker})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Simple SVG chart component (no external dependency needed) */
function IndexChart({ data }: { data: IndexDataPoint[] }) {
  if (data.length < 2) return null;

  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const values = data.map((d) => d.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, date: d.date, value: d.value };
  });

  const zeroY = padding.top + chartH - ((0 - minVal) / range) * chartH;

  // SVG path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area fill
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;

  const lastValue = values[values.length - 1];
  const color = lastValue >= 0 ? '#34d399' : '#f87171';
  const fillColor = lastValue >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)';

  // Y-axis labels
  const ySteps = 5;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = minVal + (range * i) / ySteps;
    return { val: Math.round(val * 10) / 10, y: padding.top + chartH - (i / ySteps) * chartH };
  });

  // X-axis labels (show ~5 dates)
  const xStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % xStep === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {yLabels.map((l) => (
        <g key={l.val}>
          <line
            x1={padding.left}
            y1={l.y}
            x2={width - padding.right}
            y2={l.y}
            stroke="#1e293b"
            strokeWidth={1}
          />
          <text x={padding.left - 8} y={l.y + 4} textAnchor="end" fontSize={11} fill="#94a3b8">
            {l.val}%
          </text>
        </g>
      ))}

      {/* Zero line */}
      <line
        x1={padding.left}
        y1={zeroY}
        x2={width - padding.right}
        y2={zeroY}
        stroke="#475569"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Area */}
      <path d={areaPath} fill={fillColor} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} />

      {/* Date labels */}
      {xLabels.map((d) => {
        const idx = data.indexOf(d);
        const x = padding.left + (idx / (data.length - 1)) * chartW;
        return (
          <text key={d.date} x={x} y={height - 5} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {d.date.slice(5)}
          </text>
        );
      })}
    </svg>
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
        dangerouslySetInnerHTML={{ __html: intro[year] || '' }}
      />
    </div>
  );
}

function CategoryView({
  category,
  companies,
  filter,
}: {
  category: Category;
  companies: Company[];
  filter: string;
}) {
  const filtered = useMemo(() => {
    if (!filter) return companies;
    const f = filter.toLowerCase();
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(f) ||
        Object.values(c.reviews || {}).some((h) => h.toLowerCase().includes(f))
    );
  }, [companies, filter]);

  const intro = category.intro as Record<string, string> | null;
  const [introYear, setIntroYear] = useState<string | null>(null);
  const introYears = intro ? Object.keys(intro).sort().reverse() : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">{category.name}</h1>
      <div className="text-muted text-sm mb-4">{filtered.length} חברות</div>

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
              __html: intro[introYear || introYears[0]] || '',
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
    return companies.filter(
      (c) => c.name.toLowerCase().includes(f) || c.html.toLowerCase().includes(f)
    );
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
          dangerouslySetInnerHTML={{ __html: preamble }}
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
          dangerouslySetInnerHTML={{ __html: entry.html }}
        />
      )}
    </div>
  );
}
