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
    <div dir="rtl" className="min-h-screen bg-black text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-50 h-12 bg-black/70 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.06]">
        <div className="h-full px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold tracking-tight text-ink">ניהול האתר</h1>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.08] text-slate-300">admin</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              onClick={() => window.open('/', '_blank')}
              className="text-xs text-accent hover:underline underline-offset-4"
            >
              צפה באתר
            </button>
            <button
              onClick={handleLogout}
              className="text-xs px-3.5 py-1.5 rounded-full bg-white/[0.08] text-slate-200 hover:bg-white/[0.14] transition-colors duration-500"
            >
              התנתק
            </button>
          </div>
        </div>
      </header>

      <div className="p-3 md:p-8 max-w-[1400px] mx-auto">{children}</div>
    </div>
  );
}
