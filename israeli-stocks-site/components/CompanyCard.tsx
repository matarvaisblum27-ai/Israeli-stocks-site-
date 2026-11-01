'use client';

import { useState } from 'react';
import type { Company } from '@/lib/supabase';
import { sanitizeHtml } from '@/lib/sanitize';
import { StatusPill, Disclosure } from './ui';

type Classification = 'מעניינת' | 'למעקב' | 'לא עוברת' | null;

function getClassification(html: string): Classification {
  if (!html) return null;
  // Strip HTML tags and normalise whitespace
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  // Check last ~150 characters for classification keywords
  const tail = text.slice(-150);
  if (tail.includes('לא עוברת')) return 'לא עוברת';
  if (tail.includes('למעקב')) return 'למעקב';
  if (tail.includes('מעניינת')) return 'מעניינת';
  return null;
}

export default function CompanyCard({
  company,
  years,
}: {
  company: Company;
  years: string[];
}) {
  const [open, setOpen] = useState(false);
  const reviews = company.reviews || {};
  const availableYears = years.filter((y) => reviews[y]);
  const [year, setYear] = useState<string>(availableYears[0] || years[0]);

  const preview = (reviews[availableYears[0]] || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 220);

  const classification = getClassification(reviews['2026'] || '');

  return (
    <div className="card-depth rounded-2xl overflow-hidden transition-colors duration-500 ease-apple hover:bg-[#232325]">
      <div
        className="p-5 cursor-pointer flex justify-between items-start gap-4"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[17px] text-ink mb-1.5 flex gap-2.5 items-center flex-wrap">
            <span>{company.name}</span>
            {classification && <StatusPill status={classification} />}
            <div className="flex gap-1">
              {years.map((y) => (
                <span
                  key={y}
                  className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                    reviews[y] ? 'bg-white/[0.08] text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {y}
                </span>
              ))}
            </div>
          </div>
          {!open && preview && (
            <div className="text-sm text-muted truncate">{preview}…</div>
          )}
        </div>
        <Disclosure open={open} />
      </div>

      {open && (
        <div>
          {availableYears.length > 1 && (
            <div className="mx-5 inline-flex gap-1 rounded-full bg-black/40 p-1">
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-3.5 py-1.5 rounded-full text-xs tabular-nums transition-all duration-500 ease-apple ${
                    y === year ? 'bg-ink text-black font-semibold' : 'text-slate-300 hover:text-ink'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <div
            className="review-body px-6 pb-6 pt-3 text-[15px]"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(reviews[year] || '') }}
          />
        </div>
      )}
    </div>
  );
}
