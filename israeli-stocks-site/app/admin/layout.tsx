'use client';

import { useRouter, usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show admin chrome on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: '#0b1220', color: '#e2e8f0' }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-3 md:px-6 py-3 border-b"
        style={{ background: '#0f172a', borderColor: '#1e293b' }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-100">ניהול האתר</h1>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.open('/', '_blank')}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            צפה באתר
          </button>
          <button
            onClick={handleLogout}
            className="text-xs px-3 py-1.5 rounded-lg text-slate-300 hover:text-white transition-colors"
            style={{ background: '#1e293b' }}
          >
            התנתק
          </button>
        </div>
      </header>

      <div className="p-3 md:p-6">{children}</div>
    </div>
  );
}
