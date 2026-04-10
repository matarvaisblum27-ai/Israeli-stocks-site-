'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Company, InterestingEntry } from '@/lib/supabase';
import CompanyCard from './CompanyCard';

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
            {page === 'stocks' ? 'סקירת מניות ישראל' : 'העשרה'}
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

        {view.type === 'intro' && intro && (
          <>
            <SA20Chart />
            <IntroView intro={intro} />
          </>
        )}

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
   SA20 Comparison Chart — shown above intro on main stocks page
   ════════════════════════════════════════════════════════════════ */
interface SeriesPoint {
  date: string;
  value: number;
}
interface BenchmarkSeries {
  name: string;
  ticker: string;
  color: string;
  data: SeriesPoint[];
}
interface SA20Response {
  sa20: SeriesPoint[];
  benchmarks: BenchmarkSeries[];
  stockPerformance: Array<{ name: string; ticker: string; pctChange: number; latestPrice: number }>;
  stockCount: number;
  totalStocks: number;
  failedTickers: Array<{ name: string; ticker: string }>;
  lastUpdated: string;
  period: string;
  error?: string;
}

const PERIODS = [
  { key: '1w', label: 'שבוע' },
  { key: '1m', label: 'חודש' },
  { key: 'ytd', label: 'מתחילת השנה' },
  { key: '1y', label: 'שנה' },
] as const;

const SA20_COLOR = '#34d399';

function SA20Chart() {
  const [data, setData] = useState<SA20Response | null>(null);
  const [period, setPeriod] = useState('ytd');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/stock-index?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.sa20) {
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
  }, [period]);

  // Build all series for the chart
  const allSeries = useMemo(() => {
    if (!data) return [];
    const series: Array<{ name: string; color: string; data: SeriesPoint[] }> = [];
    if (data.sa20.length > 0) {
      series.push({ name: 'SA20', color: SA20_COLOR, data: data.sa20 });
    }
    for (const b of data.benchmarks) {
      if (b.data.length > 0) {
        series.push({ name: b.name, color: b.color, data: b.data });
      }
    }
    return series;
  }, [data]);

  return (
    <div className="bg-panel border border-border rounded-xl mb-6 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            📈 מדד SA20
          </h2>
          <p className="text-muted text-xs mt-0.5">
            {data ? `${data.stockCount} מניות מעניינות 2026 לעומת מדדי ייחוס` : 'טוען...'}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                period === p.key
                  ? 'bg-accent border-accent text-white'
                  : 'bg-bg border-border text-muted hover:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* SA20 big number */}
      {data && data.sa20.length > 0 && (
        <div className="px-4 pt-3 flex items-baseline gap-3">
          <span className={`text-3xl font-bold ${data.sa20[data.sa20.length - 1].value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.sa20[data.sa20.length - 1].value >= 0 ? '+' : ''}
            {data.sa20[data.sa20.length - 1].value}%
          </span>
          <span className="text-muted text-xs">
            SA20 · {PERIODS.find((p) => p.key === period)?.label}
          </span>
        </div>
      )}

      {/* Chart area */}
      <div className="p-4">
        {loading && <div className="text-muted text-sm py-8 text-center">טוען נתוני מניות...</div>}
        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}
        {!loading && !error && allSeries.length > 0 && (
          <MultiLineChart
            series={allSeries}
            hoveredSeries={hoveredSeries}
            onHoverSeries={setHoveredSeries}
          />
        )}
      </div>

      {/* Legend */}
      {!loading && allSeries.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
          {allSeries.map((s) => {
            const lastVal = s.data[s.data.length - 1]?.value;
            return (
              <button
                key={s.name}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${
                  hoveredSeries && hoveredSeries !== s.name ? 'opacity-30' : 'opacity-100'
                }`}
                onMouseEnter={() => setHoveredSeries(s.name)}
                onMouseLeave={() => setHoveredSeries(null)}
              >
                <span className="w-3 h-[3px] rounded-full inline-block" style={{ background: s.color }} />
                <span className="text-slate-300">{s.name}</span>
                {lastVal != null && (
                  <span className={`font-semibold ${lastVal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {lastVal >= 0 ? '+' : ''}{lastVal}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Expandable individual stocks table */}
      {data && data.stockPerformance.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowTable(!showTable)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-muted hover:text-slate-300 transition-colors"
          >
            <span>ביצועי {data.stockCount} מניות בודדות</span>
            <span>{showTable ? '▴' : '▾'}</span>
          </button>
          {showTable && (
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {data.stockPerformance.map((s) => (
                <div key={s.ticker} className="flex justify-between items-center px-4 py-2">
                  <div>
                    <div className="text-sm text-slate-200">{s.name}</div>
                    <div className="text-[10px] text-muted">{s.ticker}</div>
                  </div>
                  <div className={`text-sm font-semibold ${s.pctChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.pctChange >= 0 ? '+' : ''}{s.pctChange}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last updated */}
      {data && (
        <div className="px-4 py-2 text-[10px] text-muted border-t border-border text-center">
          עדכון: {new Date(data.lastUpdated).toLocaleDateString('he-IL')}
          {data.failedTickers.length > 0 && ` · ${data.failedTickers.length} מניות לא נטענו`}
        </div>
      )}
    </div>
  );
}

/* ── Multi-line SVG Chart ── */
function MultiLineChart({
  series,
  hoveredSeries,
  onHoverSeries,
}: {
  series: Array<{ name: string; color: string; data: SeriesPoint[] }>;
  hoveredSeries: string | null;
  onHoverSeries: (name: string | null) => void;
}) {
  const width = 800;
  const height = 320;
  const padding = { top: 15, right: 15, bottom: 28, left: 48 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Collect all dates and values to determine scales
  const allDatesSet = new Set<string>();
  let globalMin = 0;
  let globalMax = 0;
  for (const s of series) {
    for (const d of s.data) {
      allDatesSet.add(d.date);
      if (d.value < globalMin) globalMin = d.value;
      if (d.value > globalMax) globalMax = d.value;
    }
  }
  const allDates = Array.from(allDatesSet).sort();
  if (allDates.length < 2) return null;

  // Add some padding to y range
  const yPad = Math.max(1, (globalMax - globalMin) * 0.1);
  const minVal = globalMin - yPad;
  const maxVal = globalMax + yPad;
  const range = maxVal - minVal || 1;

  const dateToX = (date: string) => {
    const idx = allDates.indexOf(date);
    if (idx < 0) return null;
    return padding.left + (idx / (allDates.length - 1)) * chartW;
  };
  const valToY = (val: number) => padding.top + chartH - ((val - minVal) / range) * chartH;

  const zeroY = valToY(0);

  // Y-axis grid
  const ySteps = 6;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = minVal + (range * i) / ySteps;
    return { val: Math.round(val * 10) / 10, y: valToY(val) };
  });

  // X-axis labels
  const xStep = Math.max(1, Math.floor(allDates.length / 6));
  const xLabelDates = allDates.filter((_, i) => i % xStep === 0 || i === allDates.length - 1);

  // Build paths
  const paths = series.map((s) => {
    const pts: Array<{ x: number; y: number }> = [];
    for (const d of s.data) {
      const x = dateToX(d.date);
      if (x == null) continue;
      pts.push({ x, y: valToY(d.value) });
    }
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return { name: s.name, color: s.color, linePath, pts };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" onMouseLeave={() => onHoverSeries(null)}>
      {/* Grid lines */}
      {yLabels.map((l) => (
        <g key={l.val}>
          <line x1={padding.left} y1={l.y} x2={width - padding.right} y2={l.y} stroke="#1e293b" strokeWidth={1} />
          <text x={padding.left - 6} y={l.y + 4} textAnchor="end" fontSize={10} fill="#64748b">
            {l.val}%
          </text>
        </g>
      ))}

      {/* Zero line */}
      {globalMin < 0 && globalMax > 0 && (
        <line
          x1={padding.left} y1={zeroY}
          x2={width - padding.right} y2={zeroY}
          stroke="#475569" strokeWidth={1} strokeDasharray="4 4"
        />
      )}

      {/* Lines */}
      {paths.map((p) => {
        const isHovered = hoveredSeries === p.name;
        const isFaded = hoveredSeries && !isHovered;
        return (
          <g key={p.name}>
            <path
              d={p.linePath}
              fill="none"
              stroke={p.color}
              strokeWidth={p.name === 'SA20' ? 3 : 2}
              opacity={isFaded ? 0.15 : 1}
              className="transition-opacity duration-200"
            />
            {/* Invisible wider hit-area for hover */}
            <path
              d={p.linePath}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              onMouseEnter={() => onHoverSeries(p.name)}
              style={{ cursor: 'pointer' }}
            />
          </g>
        );
      })}

      {/* Endpoint dots */}
      {paths.map((p) => {
        const last = p.pts[p.pts.length - 1];
        if (!last) return null;
        const isFaded = hoveredSeries && hoveredSeries !== p.name;
        return (
          <circle
            key={`dot-${p.name}`}
            cx={last.x} cy={last.y} r={3.5}
            fill={p.color}
            opacity={isFaded ? 0.15 : 1}
            className="transition-opacity duration-200"
          />
        );
      })}

      {/* X labels */}
      {xLabelDates.map((d) => {
        const x = dateToX(d);
        if (x == null) return null;
        return (
          <text key={d} x={x} y={height - 4} textAnchor="middle" fontSize={10} fill="#64748b">
            {d.slice(5)}
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
