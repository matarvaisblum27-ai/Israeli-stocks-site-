'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/admin');
      } else {
        setError(data.error || 'שגיאה לא ידועה');
      }
    } catch {
      setError('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="relative min-h-screen flex items-center justify-center bg-black px-6 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#2997ff]/20 blur-[120px]" />
      </div>
      <form onSubmit={handleSubmit} className="glass relative w-full max-w-sm rounded-[28px] p-8 md:p-10">
        <p className="text-titanium text-sm font-semibold text-center mb-2">סקירת מניות ישראל</p>
        <h1 className="text-4xl font-bold tracking-tight text-ink text-center mb-2">ניהול האתר.</h1>
        <p className="text-muted text-sm text-center mb-8">הכנס סיסמה כדי להמשיך</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          autoComplete="current-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          className="w-full px-4 py-3.5 rounded-2xl text-base text-ink text-center placeholder:text-muted mb-4 outline-none bg-white/[0.06] focus:bg-white/[0.1] focus:ring-2 focus:ring-accent/60 transition-all duration-500"
          autoFocus
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3.5 rounded-full text-base font-semibold text-white bg-accent hover:bg-accent/85 transition-all duration-500 disabled:opacity-40"
        >
          {loading ? 'מתחבר…' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
