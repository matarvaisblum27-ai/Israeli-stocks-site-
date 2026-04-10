import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'סקירת מניות ישראל — בסיס היסטורי',
  description: 'בסיס נתונים אינטראקטיבי מבוסס סקירות שלומי ארדן (2024–2026)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <footer className="border-t border-[#1e293b] bg-[#0b1220] py-8 px-4 text-center">
          <div className="mb-2 text-sm font-semibold text-slate-300">
            אתר ניתוח מניות ישראליות-שלומי ארדן
          </div>
          <div className="h-px w-16 mx-auto bg-[#1e293b] my-4" />
          <div className="text-xs text-[#94a3b8] mb-2">פותח על ידי מטר וייסבלום</div>
          <div className="flex items-center justify-center gap-4 text-xs text-[#94a3b8]">
            <a
              href="https://www.linkedin.com/in/matar-vaisblum-720172344/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              LinkedIn
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <span>|</span>
            <a
              href="mailto:matarvaisblum27@gmail.com"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              matarvaisblum27@gmail.com
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
