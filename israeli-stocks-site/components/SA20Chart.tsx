'use client';

import { useEffect, useState, useMemo } from 'react';

/* ── Types ── */
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
  stockPerformance: Array<{ name: string; ticker: string; pctChange: number }>;
  lastUpdated: string;
}

/* ── Colors ── */
const SA20_COLOR = '#34d399'; // green
const SERIES_COLORS: Record<string, string> = {
  'ת"א 125': '#60a5fa',
  'S&P 500': '#f59e0b',
  'Nasdaq 100': '#a78bfa',
  'MSCI World': '#f472b6',
};

/* ── Chart dimensions ── */
const CHART_H = 260;
const CHART_W = 680;
const PAD = { top: 20, right: 20, bottom: 36, left: 58 };

export default function SA20Chart() {
  const [data, setData] = useState<SA20Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<{ x: number; idx: number } | null>(null);

  useEffect(() => {
    fetch('/api/stock-index')
      .then((r) => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError('לא ניתן לטעון נתוני מדד'))
      .finally(() => setLoading(false));
  }, []);

  /* Build all series with pct changes */
  const series = useMemo(() => {
    if (!data) return [];
    const all: Array<{ name: string; color: string; points: Array<{ date: string; pct: number }> }> = [];

    // SA20
    all.push({
      name: 'SA-20',
      color: SA20_COLOR,
      points: data.sa20.map((p) => ({ date: p.date, pct: (p.value / 1000 - 1) * 100 })),
    });

    // Benchmarks
    for (const b of data.benchmarks) {
      all.push({
        name: b.name,
        color: SERIES_COLORS[b.name] || b.color,
        points: b.data.map((p) => ({ date: p.date, pct: (p.value / 1000 - 1) * 100 })),
      });
    }
    return all;
  }, [data]);

  /* Compute chart bounds */
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
    // Add padding to y range
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
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  /* Y-axis grid lines */
  const yTicks = useMemo(() => {
    const range = yMax - yMin;
    let step = 1;
    if (range > 20) step = 5;
    else if (range > 10) step = 2;
    const ticks: number[] = [];
    const start = Math.ceil(yMin / step) * step;
    for (let v = start; v <= yMax; v += step) {
      ticks.push(Math.round(v * 100) / 100);
    }
    return ticks;
  }, [yMin, yMax]);

  /* Format date for display */
  function fmtDate(d: string) {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}`;
  }

  /* Get latest pct for a series */
  function latestPct(s: typeof series[0]) {
    return s.points.length > 0 ? s.points[s.points.length - 1].pct : 0;
  }

  if (loading) {
    return (
      <div className="mt-6 bg-panel border border-border rounded-xl p-6">
        <div className="text-muted text-sm animate-pulse">טוען נתוני מדד SA-20...</div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently hide if API fails
  }

  /* Tooltip data */
  const tooltipDate = tooltip ? dates[tooltip.idx] : null;

  return (
    <div className="mt-6 bg-panel border border-border rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-slate-100">ביצועי מדד SA-20 מול מדדי ייחוס</h2>
        <span className="text-[10px] text-muted">
          עדכון: {new Date(data.lastUpdated).toLocaleDateString('he-IL')}
        </span>
      </div>

      {/* Legend — clickable */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {series.map((s) => (
          <button
            key={s.name}
            onClick={() => toggleSeries(s.name)}
            className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md transition-all ${
              hidden.has(s.name) ? 'opacity-30' : 'opacity-100'
            } hover:bg-slate-800`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-slate-300">{s.name}</span>
            <span
              className="font-semibold mr-0.5"
              style={{ color: latestPct(s) >= 0 ? '#34d399' : '#f87171' }}
            >
              {latestPct(s) >= 0 ? '+' : ''}{latestPct(s).toFixed(1)}%
            </span>
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full max-w-[700px]"
          style={{ minWidth: 400 }}
          onMouseLeave={() => setTooltip(null)}
          onMouseMove={(e) => {
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const scaleX = CHART_W / rect.width;
            const mouseX = (e.clientX - rect.left) * scaleX;
            const relX = mouseX - PAD.left;
            if (relX < 0 || relX > plotW || dates.length === 0) {
              setTooltip(null);
              return;
            }
            const idx = Math.round((relX / plotW) * (dates.length - 1));
            setTooltip({ x: mouseX, idx: Math.max(0, Math.min(idx, dates.length - 1)) });
          }}
        >
          {/* Grid lines + Y labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={CHART_W - PAD.right}
                y1={yPos(v)}
                y2={yPos(v)}
                stroke={v === 0 ? '#475569' : '#1e293b'}
                strokeWidth={v === 0 ? 1.5 : 0.5}
              />
              <text
                x={PAD.left - 6}
                y={yPos(v) + 4}
                textAnchor="end"
                className="text-[10px]"
                fill="#64748b"
              >
                {v > 0 ? '+' : ''}{v.toFixed(1)}%
              </text>
            </g>
          ))}

          {/* X-axis date labels */}
          {dates.filter((_, i) => {
            if (dates.length <= 8) return true;
            const step = Math.ceil(dates.length / 7);
            return i % step === 0 || i === dates.length - 1;
          }).map((d) => (
            <text
              key={d}
              x={xPos(d)}
              y={CHART_H - 6}
              textAnchor="middle"
              className="text-[9px]"
              fill="#64748b"
            >
              {fmtDate(d)}
            </text>
          ))}

          {/* Lines */}
          {series.map((s) => {
            if (hidden.has(s.name)) return null;
            const pts = s.points
              .filter((p) => dates.includes(p.date))
              .map((p) => `${xPos(p.date)},${yPos(p.pct)}`)
              .join(' ');
            return (
              <polyline
                key={s.name}
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth={s.name === 'SA-20' ? 2.5 : 1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Tooltip vertical line + dots */}
          {tooltip && tooltipDate && (
            <>
              <line
                x1={xPos(tooltipDate)}
                x2={xPos(tooltipDate)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="#475569"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              {series.map((s) => {
                if (hidden.has(s.name)) return null;
                const pt = s.points.find((p) => p.date === tooltipDate);
                if (!pt) return null;
                return (
                  <circle
                    key={s.name}
                    cx={xPos(tooltipDate)}
                    cy={yPos(pt.pct)}
                    r={3.5}
                    fill={s.color}
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Tooltip box */}
      {tooltip && tooltipDate && (
        <div className="mt-2 bg-slate-800/80 backdrop-blur rounded-lg px-3 py-2 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-muted font-medium">{fmtDate(tooltipDate)}</span>
          {series.map((s) => {
            if (hidden.has(s.name)) return null;
            const pt = s.points.find((p) => p.date === tooltipDate);
            if (!pt) return null;
            return (
              <span key={s.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-slate-400">{s.name}:</span>
                <span style={{ color: pt.pct >= 0 ? '#34d399' : '#f87171' }}>
                  {pt.pct >= 0 ? '+' : ''}{pt.pct.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
