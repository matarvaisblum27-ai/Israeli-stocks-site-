import './globals.css';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';

const SITE_URL = 'https://israeli-stocks-site.vercel.app';

export const metadata: Metadata = {
  title: 'סקירת מניות ישראל — בסיס היסטורי | שלומי ארדן',
  description: 'בסיס נתונים אינטראקטיבי של סקירות המניות הישראליות של שלומי ארדן לשנים 2024–2026. כולל מדד SA20, ניתוחי חברות לפי קטגוריות, והשוואה למדדי ייחוס.',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'סקירת מניות ישראל — שלומי ארדן',
    description: 'בסיס נתונים אינטראקטיבי של סקירות המניות הישראליות לשנים 2024–2026 כולל מדד SA20',
    url: SITE_URL,
    siteName: 'סקירת מניות ישראל',
    locale: 'he_IL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'סקירת מניות ישראל — שלומי ארדן',
    description: 'בסיס נתונים אינטראקטיבי של סקירות המניות הישראליות לשנים 2024–2026',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <Analytics />
        <footer className="bg-black border-t border-white/[0.06] py-12 px-6 text-center">
          <div className="text-sm font-semibold text-slate-300">
            אתר ניתוח מניות ישראליות · שלומי ארדן
          </div>
          <div className="text-xs text-muted mt-3 mb-4">פותח על ידי מטר וייסבלום</div>
          <div className="flex items-center justify-center gap-5 text-xs">
            <a
              href="https://www.linkedin.com/in/matar-vaisblum-720172344/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline underline-offset-4"
            >
              LinkedIn
            </a>
            <span className="text-slate-700">|</span>
            <a href="mailto:matarvaisblum27@gmail.com" className="text-accent hover:underline underline-offset-4">
              matarvaisblum27@gmail.com
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
