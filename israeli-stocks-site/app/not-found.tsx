import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: '#0b1220', fontFamily: 'inherit' }}
      dir="rtl"
    >
      <div className="text-7xl font-black text-slate-700 mb-4 select-none">404</div>
      <h1 className="text-2xl font-bold text-slate-100 mb-2">הדף לא נמצא</h1>
      <p className="text-slate-400 mb-8 max-w-sm">
        הדף שחיפשת אינו קיים או הועבר למקום אחר.
      </p>
      <Link
        href="/"
        className="bg-accent hover:bg-accent/80 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
