# סקירת מניות ישראל — Next.js + Supabase

אתר אינטראקטיבי המבוסס על סקירות שלומי ארדן לשנים 2024, 2025, 2026.

## הקמה מהירה

### 1. Supabase
1. צור פרויקט חדש ב-[supabase.com](https://supabase.com)
2. ב-SQL Editor, הרץ את `supabase/schema.sql`
3. ב-Settings → API, העתק:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (לזריעה בלבד, לא לפרוס!)

### 2. התקנה וזריעה
```bash
npm install
cp .env.example .env.local
# מלא את המפתחות ב-.env.local
node scripts/seed.mjs
```

### 3. הרצה מקומית
```bash
npm run dev
```

### 4. פריסה ל-Vercel
1. דחוף ל-GitHub:
   ```bash
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/USER/REPO.git
   git push -u origin main
   ```
2. ב-[vercel.com](https://vercel.com) → Import Project
3. הוסף משתני סביבה: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (לא צריך את service_role ב-Vercel)
4. Deploy

## מבנה
- `app/` — Next.js App Router
- `components/Shell.tsx` — ממשק ראשי (sidebar + views)
- `components/CompanyCard.tsx` — כרטיס חברה עם טאבים של שנים
- `lib/supabase.ts`, `lib/data.ts` — שאילתות
- `supabase/schema.sql` — סכמת DB
- `scripts/seed.mjs` — זריעת נתונים מ-`_unified.json` ו-`_index.json`
