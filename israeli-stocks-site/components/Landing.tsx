'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Reveal from './Reveal';
import SA20Chart from './SA20Chart';
import { sanitizeHtml } from '@/lib/sanitize';

export type StatusKey = 'מעניינת' | 'למעקב' | 'לא עוברת';

interface Counts { interesting: number; watch: number; notPassing: number }

/* ── Small pieces ─────────────────────────────────────────────── */

/** Chevron pointing "forward" in RTL (i.e. to the left). */
export function Chevron({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M7.5 2.5 4 6l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLink({
  children,
  onClick,
  href,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = `group inline-flex items-center gap-1 text-accent hover:underline underline-offset-4 decoration-1 transition-colors duration-500 ease-apple ${className}`;
  const inner = (
    <>
      <span>{children}</span>
      <Chevron className="w-3.5 h-3.5 transition-transform duration-500 ease-apple group-hover:-translate-x-0.5" />
    </>
  );
  return href ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>{inner}</button>
  );
}

function fmt(n: number) {
  return n > 0 ? n.toLocaleString('he-IL') : '—';
}

/* ════════════════════════════════════════════════════════════════
   Landing
   ════════════════════════════════════════════════════════════════ */
export default function Landing({
  total,
  counts,
  searchCount,
  categoriesCount,
  years,
  searchSlot,
  intro,
  interestingYears,
  onBrowse,
  onStatus,
  onInteresting,
}: {
  total: number;
  counts: Counts;
  searchCount: number;
  categoriesCount: number;
  years: string[];
  searchSlot: ReactNode;
  intro: Record<string, string> | null;
  interestingYears: string[];
  onBrowse: () => void;
  onStatus: (s: StatusKey) => void;
  onInteresting: (year: string) => void;
}) {
  const stockCount = searchCount || total;
  return (
    <div className="overflow-x-clip">
      <Hero
        stockCount={stockCount}
        counts={counts}
        years={years}
        searchSlot={searchSlot}
        onStatus={onStatus}
      />
      <Features stockCount={stockCount} categoriesCount={categoriesCount} years={years} />
      <Engine total={total} />
      <Tiers counts={counts} onStatus={onStatus} interestingYears={interestingYears} onInteresting={onInteresting} onBrowse={onBrowse} />
      {intro && <IntroSection intro={intro} />}
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────── */
function Hero({
  stockCount,
  counts,
  years,
  searchSlot,
  onStatus,
}: {
  stockCount: number;
  counts: Counts;
  years: string[];
  searchSlot: ReactNode;
  onStatus: (s: StatusKey) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // The dashboard starts tilted back and settles flat as you scroll.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / 420));
      el.style.transform = `perspective(1800px) rotateX(${(1 - p) * 14}deg) scale(${0.94 + p * 0.06})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  const tiles: { key: StatusKey; label: string; value: number; dot: string }[] = [
    { key: 'מעניינת', label: 'מעניינות', value: counts.interesting, dot: 'bg-emerald-400' },
    { key: 'למעקב', label: 'למעקב', value: counts.watch, dot: 'bg-amber-400' },
    { key: 'לא עוברת', label: 'לא עוברות', value: counts.notPassing, dot: 'bg-slate-500' },
  ];

  return (
    <section className="relative px-6 pt-24 md:pt-36 pb-24 md:pb-40 text-center">
      <Reveal as="p" className="text-titanium text-base md:text-lg font-semibold mb-5">
        סקירת המניות של שלומי ארדן
      </Reveal>
      <Reveal as="h1" delay={80} className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-ink">
        <span className="inline-block">כל המניות.</span>{' '}
        <span className="inline-block">כל השנים.</span>
        <br />
        <span className="text-titanium inline-block">במקום אחד.</span>
      </Reveal>
      <Reveal as="p" delay={160} className="mt-7 mx-auto max-w-2xl text-lg md:text-xl leading-relaxed text-muted text-balance">
        {stockCount > 0 ? `${fmt(stockCount)} חברות ציבוריות` : 'כל החברות הציבוריות'} בישראל, עם חיפוש מיידי,
        סיווג ברור וארכיון של {years.length} שנות ניתוח.
      </Reveal>
      <Reveal delay={240} className="mt-8 flex items-center justify-center gap-8 text-lg md:text-xl">
        <ChevronLink href="#search">חפשו מניה</ChevronLink>
        <ChevronLink href="#sa20">למדד SA-20</ChevronLink>
      </Reveal>

      {/* ── Glass dashboard centerpiece ── */}
      <Reveal delay={320} className="relative mt-20 md:mt-28 mx-auto max-w-4xl">
        {/* glow */}
        <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-10 -z-10">
          <div className="absolute right-[10%] top-0 h-72 w-72 rounded-full bg-[#2997ff]/30 blur-[110px]" />
          <div className="absolute left-[12%] top-24 h-64 w-64 rounded-full bg-[#7c5cff]/25 blur-[110px]" />
          <div className="absolute left-1/2 bottom-0 h-40 w-[70%] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-[90px]" />
        </div>

        <div
          id="search"
          ref={panelRef}
          className="glass relative rounded-[32px] p-5 md:p-8 text-right scroll-mt-28 origin-top transition-transform duration-300 ease-out"
          style={{ transform: 'perspective(1800px) rotateX(14deg) scale(0.94)' }}
        >
          {/* window chrome */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              סקירה {years[0]}
            </div>
            <div className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            </div>
          </div>

          {/* real search */}
          <div className="relative z-20">{searchSlot}</div>

          {/* status tiles */}
          <div className="mt-6 grid grid-cols-3 gap-3 md:gap-4">
            {tiles.map((t) => (
              <button
                key={t.key}
                onClick={() => onStatus(t.key)}
                className="group rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] p-4 md:p-5 text-right transition-all duration-700 ease-apple hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
                  {t.label}
                </div>
                <div className="mt-2 text-3xl md:text-5xl font-bold tracking-tight text-ink tabular-nums">{fmt(t.value)}</div>
              </button>
            ))}
          </div>

          {/* archive strip */}
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-black/30 px-4 py-3">
            <span className="text-xs text-muted">ארכיון</span>
            <div className="flex items-center gap-2">
              {years.map((y, i) => (
                <span
                  key={y}
                  className={`rounded-full px-3 py-1 text-xs tabular-nums ${i === 0 ? 'bg-ink text-black font-semibold' : 'bg-white/[0.06] text-slate-300'}`}
                >
                  {y}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Features: sticky headline + stacking cards ───────────────── */
function Features({ stockCount, categoriesCount, years }: { stockCount: number; categoriesCount: number; years: string[] }) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
      cards.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        // entering: 0 → 1 as the card rises into place
        const enter = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.55)));
        // covered: how far the next card has slid over this one
        const next = cards[i + 1];
        let covered = 0;
        if (next) {
          const nr = next.getBoundingClientRect();
          covered = Math.min(1, Math.max(0, (r.bottom - nr.top) / r.height));
        }
        const scale = 0.92 + enter * 0.08 - covered * 0.05;
        el.style.transform = `scale(${scale.toFixed(4)})`;
        el.style.opacity = String(0.35 + enter * 0.65 - covered * 0.35);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const features = [
    {
      eyebrow: 'חיפוש',
      title: 'שתי אותיות. כל מניה.',
      body: `מקלידים ומגיעים ישר לחברה, מתוך ${fmt(stockCount)} מניות, יחד עם הסקטור שלה.`,
      visual: (
        <div className="rounded-2xl bg-black/40 p-4">
          <div className="rounded-xl bg-white/[0.06] px-4 py-3 text-sm text-slate-300">טב|</div>
          <div className="mt-2 space-y-1.5">
            {['טבע', 'טאואר', 'טבעול'].map((n, i) => (
              <div key={n} className={`flex justify-between rounded-lg px-4 py-2 text-sm ${i === 0 ? 'bg-white/[0.08] text-ink' : 'text-muted'}`}>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      eyebrow: 'סיווג',
      title: 'שורה תחתונה ברורה.',
      body: `כל חברה מקבלת סיווג: מעניינת, למעקב או לא עוברת. מסננים בלחיצה, על פני ${categoriesCount} סקטורים.`,
      visual: (
        <div className="flex flex-wrap gap-2.5">
          {[
            ['מעניינת', 'bg-emerald-400', 'text-emerald-300'],
            ['למעקב', 'bg-amber-400', 'text-amber-300'],
            ['לא עוברת', 'bg-slate-500', 'text-slate-300'],
          ].map(([l, d, t]) => (
            <span key={l} className={`inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-sm ${t}`}>
              <span className={`h-2 w-2 rounded-full ${d}`} />
              {l}
            </span>
          ))}
        </div>
      ),
    },
    {
      eyebrow: 'ארכיון',
      title: 'הסיפור של כל חברה, לאורך זמן.',
      body: `לכל מניה, מה נכתב עליה ב-${[...years].reverse().join(', ')}. רואים איך התזה התפתחה משנה לשנה.`,
      visual: (
        <div className="relative flex items-center justify-between px-2">
          <div className="absolute inset-x-6 top-1/2 h-px bg-gradient-to-l from-[#2997ff] via-white/20 to-white/5" />
          {years.map((y, i) => (
            <div key={y} className="relative flex flex-col items-center gap-2">
              <span className={`h-3 w-3 rounded-full ring-4 ring-[#1d1d1f] ${i === 0 ? 'bg-[#2997ff]' : 'bg-slate-600'}`} />
              <span className={`text-sm tabular-nums ${i === 0 ? 'text-ink font-semibold' : 'text-muted'}`}>{y}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <section className="relative px-6 py-24 md:py-40">
      <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-2 lg:gap-20">
        {/* sticky headline (right side in RTL) */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal as="p" className="text-titanium text-base md:text-lg font-semibold mb-4">איך זה עובד</Reveal>
          <Reveal as="h2" delay={80} className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-ink">
            מאות עמודים.
            <br />
            <span className="text-titanium">שלוש תנועות.</span>
          </Reveal>
          <Reveal as="p" delay={160} className="mt-6 max-w-md text-lg md:text-xl leading-relaxed text-muted text-balance">
            הסקירה המלאה, בלי לגלול בין קבצים. מחפשים, מסננים וקוראים.
          </Reveal>
        </div>

        {/* stacking cards */}
        <div className="relative">
          {features.map((f, i) => (
            <div
              key={f.title}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="card-depth sticky rounded-[28px] p-8 md:p-10 mb-10 md:mb-16 origin-top transition-[transform,opacity] duration-200 ease-out will-change-transform"
              style={{ top: `${112 + i * 28}px` }}
            >
              <div className="text-sm font-semibold text-titanium">{f.eyebrow}</div>
              <h3 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-ink">{f.title}</h3>
              <p className="mt-4 text-base md:text-lg leading-relaxed text-muted text-balance">{f.body}</p>
              <div className="mt-8">{f.visual}</div>
            </div>
          ))}
          {/* runway so the last card can settle */}
          <div className="h-[20vh]" aria-hidden />
        </div>
      </div>
    </section>
  );
}

/* ── Engine: SA-20 schematic reveal ───────────────────────────── */
function Engine({ total }: { total: number }) {
  // Flow reads right → left (RTL): three yearly reviews → screening core → SA-20.
  const sources = [
    { y: 70, label: 'סקירה 2024' },
    { y: 180, label: 'סקירה 2025' },
    { y: 290, label: 'סקירה 2026' },
  ];
  return (
    <section id="sa20" className="relative scroll-mt-16 bg-black px-6 py-24 md:py-40">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(41,151,255,0.10),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl text-center">
        <Reveal as="p" className="text-titanium text-base md:text-lg font-semibold mb-4">מדד SA-20</Reveal>
        <Reveal as="h2" delay={80} className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-ink">
          עשרים מניות.
          <br />
          <span className="text-titanium">מדד אחד.</span>
        </Reveal>
        <Reveal as="p" delay={160} className="mt-6 mx-auto max-w-2xl text-lg md:text-xl leading-relaxed text-muted text-balance">
          20 המניות המעניינות של 2026, מול ת״א 125, S&amp;P 500, נאסד״ק 100 ו-MSCI World. מתעדכן מדי יום אחרי סגירת המסחר.
        </Reveal>

        {/* schematic */}
        <Reveal delay={240} className="mt-16 md:mt-24">
          <svg viewBox="0 0 1000 360" className="w-full h-auto" style={{ direction: 'ltr' }} role="img" aria-label="מהסקירות השנתיות, דרך סינון החברות, אל מדד SA-20">
            <defs>
              <linearGradient id="blade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2c2c2e" />
                <stop offset="1" stopColor="#141416" />
              </linearGradient>
              <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* source → core paths */}
            {sources.map((s) => (
              <g key={s.y}>
                <path d={`M820 ${s.y} C 700 ${s.y}, 680 180, 610 180`} fill="none" stroke="#2c2c2e" strokeWidth="2" />
                <path d={`M820 ${s.y} C 700 ${s.y}, 680 180, 610 180`} fill="none" stroke="#2997ff" strokeWidth="2" className="data-path" filter="url(#neon)" />
              </g>
            ))}
            {/* core → output */}
            <path d="M390 180 L 210 180" fill="none" stroke="#2c2c2e" strokeWidth="2" />
            <path d="M390 180 L 210 180" fill="none" stroke="#34d399" strokeWidth="2.5" className="data-path" filter="url(#neon)" />
            {/* faint grid traces */}
            <path d="M390 150 C 320 150, 300 110, 210 110" fill="none" stroke="#424245" strokeWidth="1" className="data-path-slow" />
            <path d="M390 210 C 320 210, 300 250, 210 250" fill="none" stroke="#424245" strokeWidth="1" className="data-path-slow" />

            {/* source nodes */}
            {sources.map((s, i) => (
              <g key={s.label}>
                <rect x="828" y={s.y - 22} width="150" height="44" rx="14" fill="#1d1d1f" stroke="#2c2c2e" />
                <circle cx="958" cy={s.y} r="4" fill={i === 2 ? '#2997ff' : '#6e6e73'} />
                <text x="940" y={s.y + 5} textAnchor="end" fontSize="15" fill="#f5f5f7" fontWeight="600">{s.label}</text>
              </g>
            ))}

            {/* core blade */}
            <g>
              <rect x="390" y="96" width="220" height="168" rx="22" fill="url(#blade)" stroke="#3a3a3c" />
              <rect x="404" y="110" width="192" height="140" rx="14" fill="none" stroke="#2c2c2e" />
              {[0, 1, 2, 3, 4].map((r) => (
                <g key={r}>
                  <rect x="418" y={124 + r * 24} width="164" height="14" rx="4" fill="#0a0a0a" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                    <circle
                      key={c}
                      cx={428 + c * 20}
                      cy={131 + r * 24}
                      r="2.2"
                      fill={(r * 8 + c) % 7 === 0 ? '#34d399' : (r + c) % 3 === 0 ? '#2997ff' : '#2c2c2e'}
                      className={(r * 8 + c) % 7 === 0 ? 'pulse-core' : undefined}
                    />
                  ))}
                </g>
              ))}
              <text x="500" y="290" textAnchor="middle" fontSize="14" fill="#86868b" direction="rtl">
                {total > 0 ? `${total.toLocaleString('he-IL')} חברות בסקירת 2026` : 'סינון החברות'}
              </text>
            </g>

            {/* output */}
            <g>
              <circle cx="140" cy="180" r="72" fill="#0a0a0a" stroke="#34d399" strokeOpacity="0.35" />
              <circle cx="140" cy="180" r="58" fill="#1d1d1f" stroke="#34d399" strokeWidth="1.5" filter="url(#neon)" className="pulse-core" />
              <text x="140" y="180" textAnchor="middle" fontSize="26" fontWeight="700" fill="#f5f5f7" direction="ltr">SA-20</text>
              <text x="140" y="204" textAnchor="middle" fontSize="13" fill="#86868b" direction="rtl">20 מניות</text>
            </g>
          </svg>
        </Reveal>

        {/* live chart */}
        <Reveal delay={120} className="mt-12 md:mt-20 text-right">
          <SA20Chart />
        </Reveal>
      </div>
    </section>
  );
}

/* ── Tiers grid ───────────────────────────────────────────────── */
function Tiers({
  counts,
  onStatus,
  interestingYears,
  onInteresting,
  onBrowse,
}: {
  counts: Counts;
  onStatus: (s: StatusKey) => void;
  interestingYears: string[];
  onInteresting: (y: string) => void;
  onBrowse: () => void;
}) {
  const tiers: { key: StatusKey; title: string; value: number; body: string; dot: string; glow: string }[] = [
    {
      key: 'מעניינת',
      title: 'מעניינות',
      value: counts.interesting,
      body: 'החברות שעברו את הסינון ושווה להעמיק בהן.',
      dot: 'bg-emerald-400',
      glow: 'group-hover:shadow-[0_30px_120px_-30px_rgba(52,211,153,0.45)]',
    },
    {
      key: 'למעקב',
      title: 'למעקב',
      value: counts.watch,
      body: 'יש כאן משהו, אבל עוד לא. כדאי להמשיך לעקוב.',
      dot: 'bg-amber-400',
      glow: 'group-hover:shadow-[0_30px_120px_-30px_rgba(251,191,36,0.4)]',
    },
    {
      key: 'לא עוברת',
      title: 'לא עוברות',
      value: counts.notPassing,
      body: 'לא עומדות בקריטריונים של הסקירה השנה.',
      dot: 'bg-slate-500',
      glow: 'group-hover:shadow-[0_30px_120px_-30px_rgba(161,161,166,0.35)]',
    },
  ];

  return (
    <section className="relative px-6 py-24 md:py-40">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Reveal as="p" className="text-titanium text-base md:text-lg font-semibold mb-4">סקירה {interestingYears[0] || '2026'}</Reveal>
          <Reveal as="h2" delay={80} className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-ink">
            בחרו מאיפה להתחיל.
          </Reveal>
        </div>

        <div className="mt-16 md:mt-24 grid gap-5 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.key} delay={i * 100} className="h-full">
              <button
                onClick={() => onStatus(t.key)}
                className={`group card-depth w-full h-full flex flex-col items-stretch justify-start rounded-[28px] p-8 md:p-10 text-right transition-all duration-900 ease-apple hover:scale-[1.03] hover:bg-[#232325] ${t.glow}`}
              >
                <div className="flex items-center gap-2 text-sm text-muted">
                  <span className={`h-2 w-2 rounded-full ${t.dot}`} />
                  {t.title}
                </div>
                <div className="mt-6 text-6xl md:text-7xl font-bold tracking-tight text-ink tabular-nums">{fmt(t.value)}</div>
                <div className="mt-1 text-sm text-muted">חברות</div>
                <p className="mt-6 text-base leading-relaxed text-slate-300">{t.body}</p>
                <div className="mt-auto pt-8 inline-flex items-center gap-1 text-accent text-base">
                  <span className="group-hover:underline underline-offset-4">לרשימה המלאה</span>
                  <Chevron className="w-3.5 h-3.5 transition-transform duration-700 ease-apple group-hover:-translate-x-1" />
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200} className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-lg">
          {interestingYears.map((y) => (
            <ChevronLink key={y} onClick={() => onInteresting(y)}>מדד המניות המעניינות {y}</ChevronLink>
          ))}
          <ChevronLink onClick={onBrowse}>לכל הסקטורים</ChevronLink>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Intro text from the review ───────────────────────────────── */
function IntroSection({ intro }: { intro: Record<string, string> }) {
  const years = Object.keys(intro).sort().reverse();
  const [year, setYear] = useState(years[0]);
  return (
    <section className="relative px-6 pt-12 pb-32 md:pb-48">
      <div className="mx-auto max-w-3xl">
        <Reveal as="h2" className="text-4xl md:text-5xl font-bold tracking-tight text-ink text-center">
          מילה מהכותב.
        </Reveal>
        <Reveal delay={80} className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full bg-[#1d1d1f] p-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-full px-5 py-1.5 text-sm tabular-nums transition-all duration-500 ease-apple ${
                  y === year ? 'bg-ink text-black font-semibold' : 'text-slate-300 hover:text-ink'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal delay={160}>
          <div
            className="review-body card-depth mt-8 rounded-[28px] p-7 md:p-12 text-[17px]"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(intro[year] || '') }}
          />
        </Reveal>
      </div>
    </section>
  );
}
