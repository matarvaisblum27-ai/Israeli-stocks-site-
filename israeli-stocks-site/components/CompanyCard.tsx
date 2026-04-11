'use client';

import { useState } from 'react';
import type { Company } from '@/lib/supabase';
import { sanitizeHtml } from '@/lib/sanitize';

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

const BADGE_STYLES: Record<NonNullable<Classification>, { bg: string; text: string; icon: string }> = {
  'מעניינת':   { bg: 'bg-emerald-600/25 border border-emerald-500/40', text: 'text-emerald-300', icon: '⭐' },
  'למעקב':    { bg: 'bg-amber-600/25 border border-amber-500/40',    text: 'text-amber-300',   icon: '👁' },
  'לא עוברת': { bg: 'bg-red-600/25 border border-red-500/40',        text: 'text-red-400',     icon: '✗' },
};

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
  const badgeStyle = classification ? BADGE_STYLES[classification] : null;

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer flex justify-between items-start gap-3"
        onClick={() => setOpen(!open)}
      >
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-100 mb-1 flex gap-2 items-center flex-wrap">
            <span>{company.name}</span>
            {badgeStyle && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${badgeStyle.bg} ${badgeStyle.text}`}>
                <span>{badgeStyle.icon}</span>
                <span>{classification}</span>
              </span>
            )}
            <div className="flex gap-1">
              {years.map((y) => (
                <span
                  key={y}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    reviews[y]
                      ? 'bg-emerald-700/40 text-emerald-300'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {y}
                </span>
              ))}
            </div>
          </div>
          {!open && preview && (
            <div className="text-xs text-muted truncate">{preview}...</div>
          )}
        </div>
        <div className="text-muted text-lg">{open ? '▴' : '▾'}</div>
      </div>

      {open && (
        <div className="border-t border-border">
          {availableYears.length > 1 && (
            <div className="flex gap-2 px-5 pt-4">
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold border ${
                    y === year
                      ? 'bg-accent border-accent text-white'
                      : 'bg-bg border-border text-muted'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          <div
            className="review-body px-5 pb-5 pt-4 text-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(reviews[year] || '') }}
          />
        </div>
      )}
    </div>
  );
}
