import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ background: '#000', fontFamily: 'inherit' }}
      dir="rtl"
    >
      <div className="text-8xl font-bold tracking-tight text-titanium mb-4 select-none">404</div>
      <h1 className="text-4xl font-bold tracking-tight text-ink mb-2">הדף לא נמצא</h1>
      <p className="text-slate-400 mb-8 max-w-sm">
        הדף שחיפשת אינו קיים או הועבר למקום אחר.
      </p>
      <Link
        href="/"
        className="text-accent text-lg hover:underline underline-offset-4"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
