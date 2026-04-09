'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Category, Company, InterestingEntry } from '@/lib/supabase';
import CompanyCard from './CompanyCard';

const YEARS = ['2026', '2025', '2024'];

type View =
  | { type: 'cat'; idx: number }
  | { type: 'interesting'; year: string }
  | { type: 'intro' };

export default function Shell({
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

  // Load data on view change
  useEffect(() => {
    if (view.type === 'cat') {
      const cat = categories[view.idx];
      if (!cat) return;
      setLoading(true);
      fetch(`/api/category/${cat.id}`)
        .then((r) => r.json())
        .then((d) => setCompanies(d.companies || []))
        .finally(() => setLoading(false));
    } else if (view.type === 'interesting') {
      setLoading(true);
      fetch(`/api/interesting/${view.year}`)
        .then((r) => r.json())
        .then((d) => setInteresting(d))
        .finally(() => setLoading(false));
    }
  }, [view, categories]);

  // Filter sidebar categories by count matching filter
  const filteredCategories = useMemo(() => {
    return categories.map((c, i) => ({ cat: c, idx: i }));
  }, [categories]);

  const intro = categories.find((c) => c.name.includes('הקדמה'))?.intro as
    | Record<string, string>
    | null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-[280px] bg-panel border-l border-border p-3 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="mb-3">
          <h1 className="text-base font-bold text-slate-100 mb-1">
            סקירת מניות ישראל
          </h1>
          <div className="text-[11px] text-muted">2024 · 2025 · 2026</div>
        </div>

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
          <IntroView intro={intro} />
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
