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
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0b1220' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 rounded-2xl border"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}
      >
        <h1 className="text-2xl font-bold text-slate-100 text-center mb-2">
          ניהול האתר
        </h1>
        <p className="text-slate-400 text-sm text-center mb-6">
          הכנס סיסמה כדי להמשיך
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          className="w-full px-4 py-3 rounded-lg text-sm text-slate-100 placeholder-slate-500 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
          style={{ background: '#1e293b', border: '1px solid #334155' }}
          autoFocus
          disabled={loading}
        />

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
          style={{ background: '#3b82f6' }}
        >
          {loading ? 'מתחבר...' : 'כניסה'}
        </button>
      </form>
    </div>
  );
}
