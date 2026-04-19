'use client';

import { useEffect, useState, useMemo } from 'react';

/* ── Types ── */
interface SeriesPoint { date: string; value: number }
interface BenchmarkSeries { name: string; ticker: string; color: string; data: SeriesPoint[] }
interface StockPerf { name: string; ticker: string; pctChange: number }
interface SA20Response {
  sa20: SeriesPoint[];
  benchmarks: BenchmarkSeries[];
  stockPerformance: StockPerf[];
  lastUpdated: string;
  startDate: string;
}

/* ── Colors ── */
const SA20_COLOR = '#34d399';
const SERIES_COLORS: Record<string, string> = {
  'ת"א 125': '#60a5fa',
  'S&P 500': '#f59e0b',
  'Nasdaq 100': '#a78bfa',
  'MSCI World': '#f472b6',
};

/* ── Chart dimensions ── */
const CHART_H = 280;
const CHART_W = 700;
const PAD = { top: 16, right: 16, bottom: 34, left: 52 };

export default function SA20Chart() {
  const [data, setData] = useState<SA20Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null);
  const [stocksOpen, setStocksOpen] = useState(false);

  useEffect(() => {
    fetch('/api/stock-index')
      .then((r) => { if (!r.ok) throw new Error('API error'); return r.json(); })
      .then((d) => setData(d))
      .catch(() => setError('לא ניתן לטעון נתוני מדד'))
      .finally(() => setLoading(false));
  }, []);

  /* Build all series */
  const series = useMemo(() => {
    if (!data) return [];
    const all: Array<{ name: string; color: string; points: Array<{ date: string; value: number; pct: number }> }> = [];
    all.push({
      name: 'SA-20',
      color: SA20_COLOR,
      points: data.sa20.map((p) => ({ date: p.date, value: p.value, pct: (p.value / 1000 - 1) * 100 })),
    });
    for (const b of data.benchmarks) {
      all.push({
        name: b.name,
        color: SERIES_COLORS[b.name] || b.color,
        points: b.data.map((p) => ({ date: p.date, value: p.value, pct: (p.value / 1000 - 1) * 100 })),
      });
    }
    return all;
  }, [data]);

  /* Chart bounds */
  const { dates, yMin, yMax } = useMemo(() => {
    const dateSet = new Set<string>();
    let min = Infinity, max = -Infinity;
    for (const s of series) {
      if (hidden.has(s.name)) continue;
      for (const p of s.points) {
        dateSet.add(p.date);
        if (p.pct < min) min = p.pct;
        if (p.pct > max) max = p.pct;
      }
    }
    const sorted = Array.from(dateSet).sort();
    const pad = Math.max((max - min) * 0.15, 1);
    return { dates: sorted, yMin: min - pad, yMax: max + pad };
  }, [series, hidden]);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  function xPos(date: string) {
    const idx = dates.indexOf(date);
    if (idx < 0 || dates.length <= 1) return PAD.left;
    return PAD.left + (idx / (dates.length - 1)) * plotW;
  }
  function yPos(pct: number) {
    return PAD.top + (1 - (pct - yMin) / (yMax - yMin)) * plotH;
  }
  function toggleSeries(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  /* Y-axis ticks */
  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    let step = 1;
    if (range > 30) step = 5;
    else if (range > 15) step = 2;
    const ticks: number[] = [];
    const start = Math.ceil(yMin / step) * step;
    for (let v = start; v <= yMax; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
  }, [yMin, yMax]);

  function fmtDate(d: string) {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  }

  function latest(s: typeof series[0]) {
    return s.points.length > 0 ? s.points[s.points.length - 1] : { value: 1000, pct: 0 };
  }

  if (loading) {
    return (
      <div className="mt-8 bg-[#0c1425] border border-slate-700/50 rounded-2xl p-6">
        <div className="text-slate-500 text-sm animate-pulse">טוען נתוני מדד SA-20...</div>
      </div>
    );
  }
  if (error || !data) return null;

  const sa20 = series.find((s) => s.name === 'SA-20');
  const sa20Latest = sa20 ? latest(sa20) : { value: 1000, pct: 0 };
  const tooltipDate = tooltip ? dates[tooltip.idx] : null;

  return (
    <div className="mt-8 bg-[#0c1425] border border-slate-700/50 rounded-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between">
          {/* Right side — title */}
          <div className="text-right flex-1">
            <div className="flex items-center justify-end gap-2 mb-1">
              <span className="text-lg font-bold text-slate-100">SA-20 מדד</span>
              <span className="text-xl">📈</span>
            </div>
            <div className="text-xs text-slate-400 mb-3">
              20 מניות מעניינות 2026 לעומת מדדי ייחוס
            </div>
            {/* Current value */}
            <div className="flex items-baseline justify-end gap-3">
              <span className="text-xs text-slate-400">SA-20 · מ-06.04.2026</span>
              <span className={`text-sm font-bold ${sa20Latest.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {sa20Latest.pct >= 0 ? '+' : ''}{sa20Latest.pct.toFixed(2)}%
              </span>
              <span className="text-3xl font-bold text-slate-100 tabular-nums">
                {sa20Latest.value.toLocaleString('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>
        </div>
        {/* Left info line */}
        <div className="text-[10px] text-slate-500 mt-2">
          מתחילת המדד 06.04.2026 · בסיס 1,000 נקודות
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="px-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full"
          style={{ minWidth: 360 }}
          onMouseLeave={() => setTooltip(null)}
          onTouchEnd={() => setTooltip(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const scaleX = CHART_W / rect.width;
            const relX = (e.clientX - rect.left) * scaleX - PAD.left;
            if (relX < 0 || relX > plotW || dates.length === 0) { setTooltip(null); return; }
            const idx = Math.round((relX / plotW) * (dates.length - 1));
            setTooltip({ idx: Math.max(0, Math.min(idx, dates.length - 1)) });
          }}
        >
          {/* Grid + Y labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left} x2={CHART_W - PAD.right}
                y1={yPos(v)} y2={yPos(v)}
                stroke={v === 0 ? '#334155' : '#1e293b'}
                strokeWidth={v === 0 ? 1.2 : 0.5}
                strokeDasharray={v === 0 ? '6,3' : 'none'}
              />
              <text x={PAD.left - 6} y={yPos(v) + 3.5} textAnchor="end" fontSize="10" fill="#475569">
                {v > 0 ? '+' : ''}{v.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* X labels */}
          {dates.filter((_, i) => {
            if (dates.length <= 10) return true;
            const step = Math.ceil(dates.length / 8);
            return i % step === 0 || i === dates.length - 1;
          }).map((d) => (
            <text key={d} x={xPos(d)} y={CHART_H - 8} textAnchor="middle" fontSize="9.5" fill="#475569">
              {fmtDate(d)}
            </text>
          ))}

          {/* Lines */}
          {series.map((s) => {
            if (hidden.has(s.name)) return null;
            const pts = s.points.filter((p) => dates.includes(p.date))
              .map((p) => `${xPos(p.date)},${yPos(p.pct)}`).join(' ');
            return (
              <polyline key={s.name} points={pts} fill="none" stroke={s.color}
                strokeWidth={s.name === 'SA-20' ? 2.5 : 1.5}
                strokeLinejoin="round" strokeLinecap="round" />
            );
          })}

          {/* Endpoint dots */}
          {series.map((s) => {
            if (hidden.has(s.name)) return null;
            const last = s.points[s.points.length - 1];
            if (!last || !dates.includes(last.date)) return null;
            return (
              <circle key={s.name + '-dot'} cx={xPos(last.date)} cy={yPos(last.pct)}
                r={3} fill={s.color} stroke="#0c1425" strokeWidth={1.5} />
            );
          })}

          {/* Tooltip line + dots */}
          {tooltip && tooltipDate && (
            <>
              <line x1={xPos(tooltipDate)} x2={xPos(tooltipDate)}
                y1={PAD.top} y2={PAD.top + plotH}
                stroke="#475569" strokeWidth={1} strokeDasharray="3,3" />
              {series.map((s) => {
                if (hidden.has(s.name)) return null;
                const pt = s.points.find((p) => p.date === tooltipDate);
                if (!pt) return null;
                return (
                  <circle key={s.name + '-tp'} cx={xPos(tooltipDate)} cy={yPos(pt.pct)}
                    r={4} fill={s.color} stroke="#0c1425" strokeWidth={2} />
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* ── Tooltip overlay ── */}
      {tooltip && tooltipDate && (
        <div className="mx-5 mb-2 bg-slate-800/70 backdrop-blur-sm rounded-lg px-3 py-2 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-slate-500 font-medium">{fmtDate(tooltipDate)}</span>
          {series.map((s) => {
            if (hidden.has(s.name)) return null;
            const pt = s.points.find((p) => p.date === tooltipDate);
            if (!pt) return null;
            return (
              <span key={s.name} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-slate-400">{s.name}</span>
                <span style={{ color: pt.pct >= 0 ? '#34d399' : '#f87171' }}>
                  {pt.pct >= 0 ? '+' : ''}{pt.pct.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Legend (bottom) ── */}
      <div className="px-5 py-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 border-t border-slate-800">
        {[...series].reverse().map((s) => {
          const l = latest(s);
          return (
            <button
              key={s.name}
              onClick={() => toggleSeries(s.name)}
              className={`flex items-center gap-1.5 text-[11px] transition-opacity ${
                hidden.has(s.name) ? 'opacity-25' : 'opacity-100'
              } hover:opacity-80`}
            >
              <span className="font-bold tabular-nums" style={{ color: l.pct >= 0 ? '#34d399' : '#f87171' }}>
                {l.value.toFixed(1)}
              </span>
              <span className="text-slate-300">{s.name}</span>
              <span className="w-3 h-[3px] rounded-full" style={{ background: s.color }} />
            </button>
          );
        })}
      </div>

      {/* ── Stock Performance (expandable) ── */}
      <div className="border-t border-slate-800">
        <button
          onClick={() => setStocksOpen(!stocksOpen)}
          className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-slate-400 hover:bg-slate-800/30 transition-colors"
        >
          <span className="font-medium">ביצועי 20 מניות בודדות</span>
          <span className={`transition-transform ${stocksOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {stocksOpen && data.stockPerformance && (
          <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5">
            {[...data.stockPerformance]
              .sort((a, b) => b.pctChange - a.pctChange)
              .map((s) => (
                <div key={s.ticker} className="flex items-center justify-between text-[11px] py-0.5">
                  <span className="text-slate-400 truncate ml-2">{s.name}</span>
                  <span
                    className="font-semibold tabular-nums flex-shrink-0"
                    style={{ color: s.pctChange >= 0 ? '#34d399' : '#f87171' }}
                  >
                    {s.pctChange >= 0 ? '+' : ''}{s.pctChange.toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 py-2 text-center text-[10px] text-slate-600 border-t border-slate-800/50">
        עדכון: {new Date(data.lastUpdated).toLocaleDateString('he-IL')}
      </div>
    </div>
  );
}
