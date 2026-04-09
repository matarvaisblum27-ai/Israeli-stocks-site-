import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'סקירת מניות ישראל — בסיס היסטורי',
  description: 'בסיס נתונים אינטראקטיבי מבוסס סקירות שלומי ארדן (2024–2026)',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
