'use client';

/* ── Shared bits ── */
export function StatusPill({ status }: { status: 'מעניינת' | 'למעקב' | 'לא עוברת' }) {
  const dot = status === 'מעניינת' ? 'bg-emerald-400' : status === 'למעקב' ? 'bg-amber-400' : 'bg-slate-500';
  const text = status === 'מעניינת' ? 'text-emerald-300' : status === 'למעקב' ? 'text-amber-300' : 'text-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

export function Disclosure({ open }: { open: boolean }) {
  return (
    <span className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-slate-300 transition-transform duration-500 ease-apple ${open ? 'rotate-180' : ''}`}>
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

