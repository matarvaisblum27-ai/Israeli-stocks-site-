'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in development (could send to monitoring in prod)
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: '#0b1220' }}
      dir="rtl"
    >
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-xl font-bold text-slate-100 mb-2">אירעה שגיאה</h1>
      <p className="text-slate-400 mb-8 max-w-sm text-sm">
        משהו השתבש בטעינת הדף. אפשר לנסות שוב או לרענן את הדפדפן.
      </p>
      <button
        onClick={reset}
        className="bg-accent hover:bg-accent/80 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
      >
        נסה שוב
      </button>
    </div>
  );
}
