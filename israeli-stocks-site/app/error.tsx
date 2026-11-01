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
      style={{ background: '#000' }}
      dir="rtl"
    >
            <h1 className="text-4xl font-bold tracking-tight text-ink mb-2">אירעה שגיאה</h1>
      <p className="text-slate-400 mb-8 max-w-sm text-sm">
        משהו השתבש בטעינת הדף. אפשר לנסות שוב או לרענן את הדפדפן.
      </p>
      <button
        onClick={reset}
        className="text-accent text-lg hover:underline underline-offset-4"
      >
        נסה שוב
      </button>
    </div>
  );
}
