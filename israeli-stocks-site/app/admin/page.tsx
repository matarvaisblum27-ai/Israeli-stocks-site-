'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';

const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false, loading: () => <div className="text-slate-500 text-sm p-4">טוען עורך...</div> });

/* ─── Types ─── */
interface Category {
  id: number;
  name: string;
  position: number;
  intro?: Record<string, string | string[]>;
}

interface Company {
  name: string;
  reviews?: Record<string, string | string[]>;
}

interface InterestingCompany {
  id: number;
  year: string;
  num: number;
  name: string;
  html: string;
}

interface InterestingData {
  preamble: string;
  companies: InterestingCompany[];
}

/* ─── Helpers ─── */
function flattenHtml(val: string | string[] | undefined): string {
  if (!val) return '';
  if (Array.isArray(val)) return val.join('\n');
  return val;
}

type CompanyStatus = 'מעניינת' | 'למעקב' | 'לא עוברת' | null;

function detectStatus(html: string): CompanyStatus {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const tail = text.slice(-150);
  if (tail.includes('לא עוברת')) return 'לא עוברת';
  if (tail.includes('למעקב')) return 'למעקב';
  if (tail.includes('מעניינת')) return 'מעניינת';
  return null;
}

function setStatusInHtml(html: string, newStatus: CompanyStatus): string {
  // Remove existing status patterns from the end of HTML
  let cleaned = html;
  // Remove patterns like: <strong>למעקב</strong>. or <strong>חברה מעניינת.</strong> etc.
  cleaned = cleaned.replace(/<strong>\s*(למעקב|לא עוברת|חברה מעניינת\.?)\s*<\/strong>\.?\s*(<\/p>)?\s*$/i, '$2');
  cleaned = cleaned.replace(/<strong>\s*(למעקב|לא עוברת|חברה מעניינת\.?)\s*\.?\s*<\/strong>\.?\s*(<\/p>)?\s*$/i, '$2');
  // Also clean trailing whitespace/br before closing
  cleaned = cleaned.replace(/(<br\s*\/?>|\s)+(<\/p>)\s*$/, '$2');
  cleaned = cleaned.replace(/\s+$/, '');

  if (!newStatus) return cleaned;

  const statusText = newStatus === 'מעניינת' ? 'חברה מעניינת' : newStatus;
  const badge = `<strong>${statusText}.</strong>`;

  // If HTML ends with </p>, insert before it
  if (cleaned.endsWith('</p>')) {
    return cleaned.slice(0, -4) + ` ${badge}</p>`;
  }
  return cleaned + ` ${badge}`;
}

const STATUS_OPTIONS: Array<{ value: CompanyStatus; label: string; color: string; icon: string }> = [
  { value: null, label: 'ללא', color: 'text-slate-500', icon: '—' },
  { value: 'מעניינת', label: 'מעניינת', color: 'text-emerald-400', icon: '⭐' },
  { value: 'למעקב', label: 'למעקב', color: 'text-amber-400', icon: '👁' },
  { value: 'לא עוברת', label: 'לא עוברת', color: 'text-red-400', icon: '✗' },
];

/* ─── Toast ─── */
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, type === 'success' ? 5000 : 6000);
    return () => clearTimeout(t);
  }, [onClose, type]);
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-lg border ${
      type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
    }`}>
      {message}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN ADMIN PAGE
   ════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatIdx, setSelectedCatIdx] = useState<number | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyIdx, setSelectedCompanyIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mode, setMode] = useState<'categories' | 'company' | 'intro' | 'merge' | 'addCompany' | 'addCategory' | 'interesting' | 'videos'>('categories');
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // For merge & search
  const [allCompanies, setAllCompanies] = useState<Array<{ name: string; catPos: number; catName: string; idx: number }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Interesting stocks
  const [interestingYears, setInterestingYears] = useState<string[]>([]);
  const [selectedInterestingYear, setSelectedInterestingYear] = useState<string | null>(null);
  const [interestingData, setInterestingData] = useState<InterestingData>({ preamble: '', companies: [] });

  // Videos
  const [adminVideos, setAdminVideos] = useState<Array<{ id: string; title: string; priority: boolean }>>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoPriority, setNewVideoPriority] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  /* ─── Load videos ─── */
  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const res = await fetch('/api/admin/videos');
      const data = await res.json();
      if (Array.isArray(data)) setAdminVideos(data);
    } catch {
      showToast('שגיאה בטעינת סרטונים', 'error');
    } finally {
      setVideosLoading(false);
    }
  }, [showToast]);

  const addVideo = useCallback(async (url: string, priority: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, priority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast('סרטון נוסף בהצלחה', 'success');
      setNewVideoUrl('');
      setNewVideoPriority(false);
      loadVideos();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      showToast(msg === 'Video already exists' ? 'הסרטון כבר קיים' : `שגיאה: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  }, [showToast, loadVideos]);

  const deleteVideo = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed');
      setAdminVideos((prev) => prev.filter((v) => v.id !== id));
      showToast('סרטון הוסר', 'success');
    } catch {
      showToast('שגיאה במחיקת סרטון', 'error');
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  const toggleVideoPriority = useCallback(async (id: string, priority: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/videos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, priority }),
      });
      if (!res.ok) throw new Error('Failed');
      setAdminVideos((prev) => prev.map((v) => v.id === id ? { ...v, priority } : v));
      showToast('עודכן', 'success');
    } catch {
      showToast('שגיאה בעדכון', 'error');
    } finally {
      setSaving(false);
    }
  }, [showToast]);

  /* ─── Load categories ─── */
  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => showToast('שגיאה בטעינת קטגוריות', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  /* ─── Load companies for selected category ─── */
  useEffect(() => {
    if (selectedCatIdx === null) { setCompanies([]); return; }
    const cat = categories[selectedCatIdx];
    if (!cat) return;
    setLoading(true);
    fetch(`/api/admin/companies?position=${cat.position}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCompanies(d); })
      .catch(() => showToast('שגיאה בטעינת חברות', 'error'))
      .finally(() => setLoading(false));
  }, [selectedCatIdx, categories, showToast]);

  /* ─── Load interesting years ─── */
  useEffect(() => {
    fetch('/api/admin/interesting?type=years')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInterestingYears(d); })
      .catch(() => {});
  }, []);

  /* ─── Load interesting data when year selected ─── */
  useEffect(() => {
    if (!selectedInterestingYear) return;
    setLoading(true);
    fetch(`/api/admin/interesting?year=${selectedInterestingYear}`)
      .then((r) => r.json())
      .then((d) => setInterestingData(d))
      .catch(() => showToast('שגיאה בטעינת נתוני מעניינות', 'error'))
      .finally(() => setLoading(false));
  }, [selectedInterestingYear, showToast]);

  /* ─── Load all companies (for merge) ─── */
  const loadAllCompanies = useCallback(async () => {
    const all: typeof allCompanies = [];
    for (const cat of categories) {
      if (cat.name.includes('הקדמה')) continue;
      try {
        const res = await fetch(`/api/admin/companies?position=${cat.position}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          data.forEach((c: Company, idx: number) => {
            all.push({ name: c.name, catPos: cat.position, catName: cat.name, idx });
          });
        }
      } catch { /* skip */ }
    }
    setAllCompanies(all);
  }, [categories]);

  /* ─── Auto-load all companies for search ─── */
  useEffect(() => {
    if (categories.length > 0 && allCompanies.length === 0) {
      loadAllCompanies();
    }
  }, [categories, allCompanies.length, loadAllCompanies]);

  /* ─── Close search dropdown on outside click ─── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchResults = searchQuery.length >= 2
    ? allCompanies.filter((c) => c.name.includes(searchQuery)).slice(0, 12)
    : [];

  const navigateToCompany = (item: typeof allCompanies[0]) => {
    // Find the category index
    const catIdx = categories.findIndex((c) => c.position === item.catPos);
    if (catIdx === -1) return;
    setSelectedCatIdx(catIdx);
    // We need to wait for companies to load, then select the company
    // Set a flag so we know to select the company after load
    setSearchQuery('');
    setSearchFocused(false);
    // Load companies for the category, then select the right one
    setLoading(true);
    fetch(`/api/admin/companies?position=${item.catPos}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setCompanies(d);
          setSelectedCompanyIdx(item.idx);
          setMode('company');
        }
      })
      .catch(() => showToast('שגיאה בטעינת חברות', 'error'))
      .finally(() => setLoading(false));
  };

  const selectedCat = selectedCatIdx !== null ? categories[selectedCatIdx] : null;
  const selectedCompany = selectedCompanyIdx !== null ? companies[selectedCompanyIdx] : null;

  /* ─── Save company review ─── */
  const saveCompanyReview = async (companyIndex: number, year: string, html: string) => {
    if (!selectedCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: selectedCat.position,
          companyIndex,
          updates: { reviews: { [year]: html } },
        }),
      });
      if (res.ok) {
        showToast('✓ נשמר! האתר יתעדכן תוך דקה', 'success');
        // Update local state
        setCompanies((prev) => {
          const next = [...prev];
          if (!next[companyIndex].reviews) next[companyIndex].reviews = {};
          (next[companyIndex].reviews as Record<string, string>)[year] = html;
          return next;
        });
      } else {
        const data = await res.json();
        showToast(data.error || 'שגיאה בשמירה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Save company name ─── */
  const saveCompanyName = async (companyIndex: number, newName: string) => {
    if (!selectedCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: selectedCat.position,
          companyIndex,
          updates: { name: newName },
        }),
      });
      if (res.ok) {
        showToast('✓ השם עודכן! האתר יתעדכן תוך דקה', 'success');
        setCompanies((prev) => {
          const next = [...prev];
          next[companyIndex] = { ...next[companyIndex], name: newName };
          return next;
        });
        loadAllCompanies(); // refresh search index
      } else {
        showToast('שגיאה בעדכון שם', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Delete company ─── */
  const deleteCompany = async (companyIndex: number) => {
    if (!selectedCat) return;
    const company = companies[companyIndex];
    if (!confirm(`למחוק את "${company.name}"?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: selectedCat.position, companyIndex }),
      });
      if (res.ok) {
        showToast('✓ החברה נמחקה! האתר יתעדכן תוך דקה', 'success');
        setCompanies((prev) => prev.filter((_, i) => i !== companyIndex));
        setSelectedCompanyIdx(null);
        loadAllCompanies(); // refresh search index
      } else {
        showToast('שגיאה במחיקה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Add company ─── */
  const addCompany = async (name: string) => {
    if (!selectedCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: selectedCat.position, name, reviews: {} }),
      });
      if (res.ok) {
        showToast('✓ חברה נוספה! האתר יתעדכן תוך דקה', 'success');
        setCompanies((prev) => [...prev, { name, reviews: {} }]);
        setMode('categories');
        loadAllCompanies(); // refresh search index
      } else {
        showToast('שגיאה בהוספה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Save category intro ─── */
  const saveCategoryIntro = async (catIndex: number, year: string, html: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: catIndex, updates: { intro: { [year]: html } } }),
      });
      if (res.ok) {
        showToast('✓ ההקדמה עודכנה! האתר יתעדכן תוך דקה', 'success');
        setCategories((prev) => {
          const next = [...prev];
          if (!next[catIndex].intro) next[catIndex].intro = {};
          next[catIndex].intro![year] = html;
          return next;
        });
      } else {
        showToast('שגיאה בשמירה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Rename category ─── */
  const renameCategory = async (catIndex: number, newName: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: catIndex, updates: { name: newName } }),
      });
      if (res.ok) {
        showToast('✓ שם הקטגוריה עודכן! האתר יתעדכן תוך דקה', 'success');
        setCategories((prev) => {
          const next = [...prev];
          next[catIndex] = { ...next[catIndex], name: newName };
          return next;
        });
      } else {
        showToast('שגיאה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Add category ─── */
  const addCategory = async (name: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        showToast('✓ קטגוריה נוספה! האתר יתעדכן תוך דקה', 'success');
        // Reload categories
        const catsRes = await fetch('/api/admin/categories');
        const cats = await catsRes.json();
        if (Array.isArray(cats)) setCategories(cats);
        setMode('categories');
      } else {
        showToast('שגיאה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Delete year from company ─── */
  const deleteYear = async (companyIndex: number, year: string) => {
    if (!selectedCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: selectedCat.position,
          companyIndex,
          updates: { reviews: { [year]: null } },
        }),
      });
      if (res.ok) {
        showToast(`✓ שנת ${year} נמחקה! האתר יתעדכן תוך דקה`, 'success');
        setCompanies((prev) => {
          const next = [...prev];
          const reviews = { ...(next[companyIndex].reviews || {}) };
          delete reviews[year];
          next[companyIndex] = { ...next[companyIndex], reviews };
          return next;
        });
      } else {
        const data = await res.json();
        showToast(data.error || 'שגיאה במחיקת שנה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Move company ─── */
  const moveCompany = async (companyIndex: number, toPosition: number) => {
    if (!selectedCat) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPosition: selectedCat.position,
          companyIndex,
          toPosition,
        }),
      });
      if (res.ok) {
        showToast('✓ החברה הועברה! האתר יתעדכן תוך דקה', 'success');
        setCompanies((prev) => prev.filter((_, i) => i !== companyIndex));
        setSelectedCompanyIdx(null);
        setMode('categories');
        loadAllCompanies(); // refresh search index
      } else {
        const data = await res.json();
        showToast(data.error || 'שגיאה בהעברה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Merge ─── */
  const mergeCompanies = async (
    sourcePos: number, sourceIdx: number,
    targetPos: number, targetIdx: number
  ) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePosition: sourcePos,
          sourceIndex: sourceIdx,
          targetPosition: targetPos,
          targetIndex: targetIdx,
          keepTargetOnConflict: true,
        }),
      });
      if (res.ok) {
        showToast('✓ החברות אוחדו! האתר יתעדכן תוך דקה', 'success');
        setMode('categories');
        loadAllCompanies(); // refresh search index
        // Reload if we're in the affected category
        if (selectedCat && (selectedCat.position === sourcePos || selectedCat.position === targetPos)) {
          const r = await fetch(`/api/admin/companies?position=${selectedCat.position}`);
          const d = await r.json();
          if (Array.isArray(d)) setCompanies(d);
        }
      } else {
        showToast('שגיאה באיחוד', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Interesting: save preamble ─── */
  const saveInterestingPreamble = async (year: string, preamble: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/interesting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, preamble }),
      });
      if (res.ok) {
        showToast('✓ ההקדמה עודכנה! האתר יתעדכן תוך דקה', 'success');
        setInterestingData((prev) => ({ ...prev, preamble }));
      } else showToast('שגיאה בשמירה', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Interesting: save company ─── */
  const saveInterestingCompany = async (year: string, idx: number, company: { name: string; html: string }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/interesting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, companyIndex: idx, company }),
      });
      if (res.ok) {
        showToast('✓ נשמר! האתר יתעדכן תוך דקה', 'success');
        setInterestingData((prev) => {
          const next = { ...prev, companies: [...prev.companies] };
          next.companies[idx] = { ...next.companies[idx], ...company };
          return next;
        });
      } else showToast('שגיאה בשמירה', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Interesting: add company ─── */
  const addInterestingCompany = async (year: string, name: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/interesting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, company: { name, html: '' } }),
      });
      if (res.ok) {
        showToast('✓ חברה נוספה! האתר יתעדכן תוך דקה', 'success');
        // Reload
        const r = await fetch(`/api/admin/interesting?year=${year}`);
        const d = await r.json();
        setInterestingData(d);
      } else showToast('שגיאה', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Interesting: delete company ─── */
  const deleteInterestingCompany = async (year: string, idx: number) => {
    const company = interestingData.companies[idx];
    if (!confirm(`למחוק את "${company.name}" מהמעניינות?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/interesting', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, companyIndex: idx }),
      });
      if (res.ok) {
        showToast('✓ נמחק! האתר יתעדכן תוך דקה', 'success');
        setInterestingData((prev) => ({
          ...prev,
          companies: prev.companies.filter((_, i) => i !== idx),
        }));
      } else showToast('שגיאה', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Interesting: create year ─── */
  const createInterestingYear = async (year: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/interesting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, createYear: true }),
      });
      if (res.ok) {
        showToast('✓ שנה נוספה! האתר יתעדכן תוך דקה', 'success');
        const r = await fetch('/api/admin/interesting?type=years');
        const d = await r.json();
        if (Array.isArray(d)) setInterestingYears(d);
        setSelectedInterestingYear(year);
      } else showToast('שגיאה', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Reorder category (drag & drop) ─── */
  const handleDrop = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (categories[toIndex]?.name.includes('הקדמה') || categories[fromIndex]?.name.includes('הקדמה')) return;
    // Optimistic UI update
    setCategories((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    if (selectedCatIdx === fromIndex) setSelectedCatIdx(toIndex);
    else if (selectedCatIdx !== null && fromIndex < toIndex && selectedCatIdx > fromIndex && selectedCatIdx <= toIndex) {
      setSelectedCatIdx(selectedCatIdx - 1);
    } else if (selectedCatIdx !== null && fromIndex > toIndex && selectedCatIdx >= toIndex && selectedCatIdx < fromIndex) {
      setSelectedCatIdx(selectedCatIdx + 1);
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromIndex, toIndex }),
      });
      if (res.ok) {
        showToast('✓ הסדר עודכן! האתר יתעדכן תוך דקה', 'success');
      } else showToast('שגיאה בשינוי סדר', 'error');
    } catch { showToast('שגיאת תקשורת', 'error'); }
    finally { setSaving(false); }
  };

  /* ─── Rebuild search index ─── */
  const rebuildSearchIndex = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/search-index', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(`אינדקס נבנה מחדש (${data.count} חברות)`, 'success');
      } else {
        showToast(data.error || 'שגיאה', 'error');
      }
    } catch {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */

  const sidebarContent = (
    <>
      {/* ⭐ Interesting years */}
      {interestingYears.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-amber-400 mb-2 px-2 font-medium">⭐ מדד מניות מעניינות</div>
          {interestingYears.map((y) => (
            <button
              key={y}
              onClick={() => {
                setSelectedInterestingYear(y);
                setSelectedCatIdx(null);
                setSelectedCompanyIdx(null);
                setMode('interesting');
                setMobileSidebar(false);
              }}
              className={`w-full text-right px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                mode === 'interesting' && selectedInterestingYear === y
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'text-amber-200/70 hover:bg-slate-800'
              }`}
            >
              מעניינות {y}
            </button>
          ))}
        </div>
      )}

      {/* 🎬 Videos */}
      <button
        onClick={() => {
          setSelectedCatIdx(null);
          setSelectedCompanyIdx(null);
          setSelectedInterestingYear(null);
          setMode('videos');
          setMobileSidebar(false);
          loadVideos();
        }}
        className={`w-full text-right px-3 py-2 rounded-lg mb-3 text-sm transition-colors ${
          mode === 'videos'
            ? 'bg-red-500/20 text-red-400'
            : 'text-red-300/70 hover:bg-slate-800'
        }`}
      >
        🎬 סרטוני העשרה
      </button>

      {/* הקדמה */}
      {categories.filter(c => c.name.includes('הקדמה')).map((cat) => {
        const catIdx = categories.indexOf(cat);
        return (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCatIdx(catIdx);
              setSelectedCompanyIdx(null);
              setSelectedInterestingYear(null);
              setMode('intro');
              setMobileSidebar(false);
            }}
            className={`w-full text-right px-3 py-2 rounded-lg mb-3 text-sm transition-colors ${
              selectedCatIdx === catIdx && mode === 'intro'
                ? 'bg-green-500/20 text-green-400'
                : 'text-green-300/70 hover:bg-slate-800'
            }`}
          >
            📖 הקדמה כללית
          </button>
        );
      })}

      <div className="border-t border-slate-700 mb-3" />

      {/* Categories */}
      <div className="text-xs text-slate-500 mb-2 px-2">קטגוריות <span className="text-slate-600">(גרור לשינוי סדר)</span></div>
      {categories.map((cat, idx) => {
        if (cat.name.includes('הקדמה')) return null;
        return (
          <div
            key={cat.id}
            draggable
            onDragStart={(e) => {
              setDragIdx(idx);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverIdx(idx);
            }}
            onDragLeave={() => setDragOverIdx(null)}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIdx !== null) handleDrop(dragIdx, idx);
              setDragIdx(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
            className={`mb-1 rounded-lg transition-all ${
              dragOverIdx === idx && dragIdx !== idx ? 'border-2 border-blue-400/50 border-dashed' : ''
            } ${dragIdx === idx ? 'opacity-40' : ''}`}
          >
            <button
              onClick={() => {
                setSelectedCatIdx(idx);
                setSelectedCompanyIdx(null);
                setSelectedInterestingYear(null);
                setMode('categories');
                setMobileSidebar(false);
              }}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors cursor-grab active:cursor-grabbing ${
                selectedCatIdx === idx && mode !== 'interesting'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.name}
            </button>
          </div>
        );
      })}
    </>
  );

  return (
    <div className="max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Search bar */}
      <div ref={searchRef} className="relative mb-4">
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="🔍 חפש חברה..."
            className="w-full px-4 py-3 rounded-xl text-sm text-slate-100 pr-10"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchFocused(false); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-sm"
            >
              ✕
            </button>
          )}
        </div>
        {searchFocused && searchQuery.length >= 2 && (
          <div
            className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl max-h-80 overflow-y-auto"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
          >
            {searchResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">לא נמצאו תוצאות</div>
            ) : (
              searchResults.map((item, i) => (
                <button
                  key={`${item.catPos}-${item.idx}`}
                  onClick={() => navigateToCompany(item)}
                  className={`w-full text-right px-4 py-3 text-sm hover:bg-slate-800 transition-colors flex justify-between items-center ${
                    i < searchResults.length - 1 ? 'border-b border-slate-800' : ''
                  }`}
                >
                  <span className="text-slate-200 font-medium">{item.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded">{item.catName}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Stats bar — responsive */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileSidebar(!mobileSidebar)}
          className="md:hidden px-4 py-2 rounded-xl text-sm text-slate-300"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          ☰ קטגוריות
        </button>
        <div className="hidden md:flex px-4 py-2 rounded-xl text-sm" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <span className="text-slate-400">קטגוריות: </span>
          <span className="text-slate-100 font-semibold">{categories.filter(c => !c.name.includes('הקדמה')).length}</span>
        </div>
        <div className="hidden md:flex px-4 py-2 rounded-xl text-sm" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <span className="text-slate-400">חברות בקטגוריה: </span>
          <span className="text-slate-100 font-semibold">{companies.length}</span>
        </div>
        <button
          onClick={rebuildSearchIndex}
          disabled={saving}
          className="hidden md:block px-4 py-2 rounded-xl text-sm text-blue-400 hover:text-blue-300 transition-colors"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          בנה אינדקס חיפוש מחדש
        </button>
        <button
          onClick={() => { setMode('merge'); loadAllCompanies(); setMobileSidebar(false); }}
          className="px-4 py-2 rounded-xl text-sm text-purple-400 hover:text-purple-300 transition-colors"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          איחוד חברות
        </button>
        <button
          onClick={() => { setMode('addCategory'); setMobileSidebar(false); }}
          className="px-4 py-2 rounded-xl text-sm text-green-400 hover:text-green-300 transition-colors"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          + קטגוריה חדשה
        </button>
      </div>

      {saving && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="px-6 py-4 rounded-xl text-sm text-slate-200" style={{ background: '#0f172a' }}>
            שומר...
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* ─── Mobile sidebar overlay ─── */}
        {mobileSidebar && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileSidebar(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="absolute right-0 top-0 bottom-0 w-72 p-3 overflow-y-auto"
              style={{ background: '#0f172a' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-sm text-slate-300 font-medium">ניווט</span>
                <button onClick={() => setMobileSidebar(false)} className="text-slate-400 text-lg">✕</button>
              </div>
              {sidebarContent}
            </div>
          </div>
        )}

        {/* ─── Desktop sidebar ─── */}
        <div className="hidden md:block w-64 shrink-0">
          <div className="sticky top-16 rounded-xl p-3 max-h-[calc(100vh-120px)] overflow-y-auto" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            {sidebarContent}
          </div>
        </div>

        {/* ─── Main content ─── */}
        <div className="flex-1 min-w-0">
          {loading && <div className="text-slate-400 text-sm">טוען...</div>}

          {/* ── Add Category mode ── */}
          {mode === 'addCategory' && (
            <AddCategoryForm onSave={addCategory} onCancel={() => setMode('categories')} />
          )}

          {/* ── Merge mode ── */}
          {mode === 'merge' && (
            <MergePanel
              allCompanies={allCompanies}
              onMerge={mergeCompanies}
              onCancel={() => setMode('categories')}
              loading={allCompanies.length === 0}
            />
          )}

          {/* ── Interesting mode ── */}
          {mode === 'interesting' && selectedInterestingYear && !loading && (
            <InterestingEditor
              year={selectedInterestingYear}
              data={interestingData}
              years={interestingYears}
              onSavePreamble={saveInterestingPreamble}
              onSaveCompany={saveInterestingCompany}
              onAddCompany={addInterestingCompany}
              onDeleteCompany={deleteInterestingCompany}
              onCreateYear={createInterestingYear}
              onBack={() => { setSelectedInterestingYear(null); setMode('categories'); }}
            />
          )}

          {/* ── Videos mode ── */}
          {mode === 'videos' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-100">🎬 ניהול סרטוני העשרה</h2>
                <span className="text-sm text-slate-500">{adminVideos.length} סרטונים</span>
              </div>

              {/* Add video form */}
              <div className="p-4 rounded-xl mb-6" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
                <div className="text-sm text-slate-300 mb-3 font-medium">הוסף סרטון חדש</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="הדבק קישור YouTube כאן..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    dir="ltr"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newVideoUrl.trim()) addVideo(newVideoUrl, newVideoPriority);
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm text-amber-400 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={newVideoPriority}
                      onChange={(e) => setNewVideoPriority(e.target.checked)}
                      className="accent-amber-500"
                    />
                    פודקאסט שנתי
                  </label>
                  <button
                    onClick={() => newVideoUrl.trim() && addVideo(newVideoUrl, newVideoPriority)}
                    disabled={saving || !newVideoUrl.trim()}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                  >
                    + הוסף
                  </button>
                </div>
                <div className="text-[11px] text-slate-600 mt-2">
                  תומך בפורמטים: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
                </div>
              </div>

              {/* Video list */}
              {videosLoading ? (
                <div className="text-slate-400 text-sm">טוען סרטונים...</div>
              ) : (
                <div className="space-y-2">
                  {adminVideos.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                      style={{ background: '#0f172a', border: '1px solid #1e293b' }}
                    >
                      {/* Thumbnail */}
                      <img
                        src={`https://img.youtube.com/vi/${v.id}/mqdefault.jpg`}
                        alt=""
                        className="w-28 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate" dir="ltr">
                          {v.id}
                        </div>
                        {v.title && (
                          <div className="text-xs text-slate-500 truncate">{v.title}</div>
                        )}
                        {v.priority && (
                          <span className="inline-block mt-1 text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            פודקאסט שנתי
                          </span>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => toggleVideoPriority(v.id, !v.priority)}
                          disabled={saving}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                            v.priority
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                              : 'bg-slate-800 text-slate-500 hover:text-amber-400'
                          }`}
                          title={v.priority ? 'הסר תיוג פודקאסט' : 'סמן כפודקאסט שנתי'}
                        >
                          ⭐
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${v.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          ▶
                        </a>
                        <button
                          onClick={() => { if (confirm('למחוק את הסרטון?')) deleteVideo(v.id); }}
                          disabled={saving}
                          className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Category selected ── */}
          {selectedCat && mode === 'categories' && !loading && (
            <div>
              {/* Category header */}
              <CategoryHeader
                category={selectedCat}
                catIndex={selectedCatIdx!}
                onRename={(name) => renameCategory(selectedCatIdx!, name)}
                onEditIntro={() => setMode('intro')}
                onAddCompany={() => setMode('addCompany')}
              />

              {/* Company list */}
              <div className="space-y-1">
                {companies.map((company, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setSelectedCompanyIdx(idx); setMode('company'); }}
                    className={`w-full text-right px-4 py-3 rounded-xl text-sm transition-colors flex justify-between items-center ${
                      selectedCompanyIdx === idx
                        ? 'bg-blue-500/15 border-blue-500/30'
                        : 'hover:bg-slate-800/50'
                    }`}
                    style={{ background: selectedCompanyIdx === idx ? undefined : '#0f172a', border: '1px solid #1e293b' }}
                  >
                    <span className="text-slate-200">{company.name}</span>
                    <span className="text-xs text-slate-500">
                      {Object.keys(company.reviews || {}).sort().join(', ')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Add Company mode ── */}
          {mode === 'addCompany' && selectedCat && (
            <AddCompanyForm onSave={addCompany} onCancel={() => setMode('categories')} />
          )}

          {/* ── Intro Editor mode ── */}
          {mode === 'intro' && selectedCat && selectedCatIdx !== null && (
            <IntroEditor
              category={selectedCat}
              catIndex={selectedCatIdx}
              onSave={saveCategoryIntro}
              onBack={() => setMode('categories')}
            />
          )}

          {/* ── Company Editor mode ── */}
          {mode === 'company' && selectedCompany && selectedCompanyIdx !== null && selectedCat && (
            <CompanyEditor
              company={selectedCompany}
              companyIndex={selectedCompanyIdx}
              category={selectedCat}
              categories={categories}
              onSaveReview={saveCompanyReview}
              onDeleteYear={deleteYear}
              onSaveName={saveCompanyName}
              onDelete={deleteCompany}
              onMove={moveCompany}
              onBack={() => { setSelectedCompanyIdx(null); setMode('categories'); }}
            />
          )}

          {/* ── No category selected ── */}
          {!selectedCat && mode === 'categories' && !loading && (
            <div className="text-center text-slate-500 mt-20">
              <div className="text-4xl mb-4">📊</div>
              <div className="text-lg">בחר קטגוריה מהרשימה כדי להתחיל לערוך</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════ */

function CategoryHeader({
  category,
  catIndex,
  onRename,
  onEditIntro,
  onAddCompany,
}: {
  category: Category;
  catIndex: number;
  onRename: (name: string) => void;
  onEditIntro: () => void;
  onAddCompany: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  return (
    <div className="mb-6 p-4 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      <div className="flex items-center gap-3 mb-2">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg text-sm text-slate-100"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
              autoFocus
            />
            <button
              onClick={() => { onRename(name); setEditing(false); }}
              className="px-3 py-1.5 rounded-lg text-xs text-white bg-blue-500"
            >
              שמור
            </button>
            <button
              onClick={() => { setName(category.name); setEditing(false); }}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400"
            >
              ביטול
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-100">{category.name}</h2>
            <button onClick={() => setEditing(true)} className="text-xs text-blue-400 hover:text-blue-300">
              שנה שם
            </button>
          </>
        )}
      </div>
      <div className="flex gap-2 text-xs">
        <span className="text-slate-500">position: {category.position} | index: {catIndex}</span>
        <button onClick={onEditIntro} className="text-blue-400 hover:underline">ערוך הקדמה</button>
        <button onClick={onAddCompany} className="text-green-400 hover:underline">+ חברה חדשה</button>
      </div>
    </div>
  );
}


function CompanyEditor({
  company,
  companyIndex,
  category,
  categories,
  onSaveReview,
  onDeleteYear,
  onSaveName,
  onDelete,
  onMove,
  onBack,
}: {
  company: Company;
  companyIndex: number;
  category: Category;
  categories: Category[];
  onSaveReview: (idx: number, year: string, html: string) => Promise<void>;
  onDeleteYear: (idx: number, year: string) => Promise<void>;
  onSaveName: (idx: number, name: string) => Promise<void>;
  onDelete: (idx: number) => Promise<void>;
  onMove: (idx: number, toPosition: number) => Promise<void>;
  onBack: () => void;
}) {
  const years = Object.keys(company.reviews || {}).sort();
  const [selectedYear, setSelectedYear] = useState(years[years.length - 1] || '2026');
  const [html, setHtml] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(company.name);
  const [newYear, setNewYear] = useState('');
  const [showMove, setShowMove] = useState(false);
  const [editorMode, setEditorMode] = useState<'rich' | 'html'>('rich');

  useEffect(() => {
    const reviews = company.reviews || {};
    setHtml(flattenHtml(reviews[selectedYear]));
  }, [selectedYear, company]);

  return (
    <div>
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">
          → חזרה לרשימה
        </button>
      </div>

      {/* Company name */}
      <div className="mb-4 p-4 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm text-slate-100"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
                autoFocus
              />
              <button
                onClick={() => { onSaveName(companyIndex, name); setEditingName(false); }}
                className="px-3 py-1.5 rounded-lg text-xs text-white bg-blue-500"
              >
                שמור
              </button>
              <button
                onClick={() => { setName(company.name); setEditingName(false); }}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400"
              >
                ביטול
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-100">{company.name}</h2>
              <button onClick={() => setEditingName(true)} className="text-xs text-blue-400">שנה שם</button>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-3 text-xs">
          <button
            onClick={() => onDelete(companyIndex)}
            className="text-red-400 hover:text-red-300"
          >
            מחק חברה
          </button>
          <button
            onClick={() => setShowMove(!showMove)}
            className="text-yellow-400 hover:text-yellow-300"
          >
            העבר לקטגוריה אחרת
          </button>
        </div>

        {showMove && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#1e293b' }}>
            <div className="text-xs text-slate-400 mb-2">בחר קטגוריה יעד:</div>
            <div className="flex flex-wrap gap-1">
              {categories
                .filter((c) => c.position !== category.position && !c.name.includes('הקדמה'))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onMove(companyIndex, c.position)}
                    className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    {c.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Year tabs */}
      <div className="flex items-center gap-2 mb-4">
        {years.map((y) => (
          <div key={y} className="flex items-center gap-0.5">
            <button
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedYear === y
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={selectedYear !== y ? { background: '#1e293b' } : {}}
            >
              {y}
            </button>
            {selectedYear === y && (
              <button
                onClick={() => {
                  if (confirm(`למחוק את הסקירה לשנת ${y}?`)) {
                    onDeleteYear(companyIndex, y);
                    const remaining = years.filter(yr => yr !== y);
                    setSelectedYear(remaining[remaining.length - 1] || '2026');
                  }
                }}
                className="text-red-400 hover:text-red-300 text-xs px-1"
                title={`מחק שנת ${y}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-1 mr-4">
          <input
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="שנה חדשה"
            className="w-24 px-2 py-1 rounded text-xs text-slate-100"
            style={{ background: '#1e293b', border: '1px solid #334155' }}
          />
          <button
            onClick={() => {
              if (newYear && !years.includes(newYear)) {
                setSelectedYear(newYear);
                setHtml('');
                setNewYear('');
              }
            }}
            className="text-xs text-green-400 hover:text-green-300"
          >
            + הוסף
          </button>
        </div>
      </div>

      {/* Status selector */}
      <div className="mb-4 p-3 rounded-xl flex items-center gap-3 flex-wrap" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
        <span className="text-xs text-slate-400">סטטוס:</span>
        {STATUS_OPTIONS.map((opt) => {
          const current = detectStatus(html);
          const isActive = current === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => setHtml(setStatusInHtml(html, opt.value))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? `${opt.color} ring-2 ring-current/30 bg-slate-800`
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setEditorMode('rich')}
            className={`text-xs px-2 py-1 rounded ${editorMode === 'rich' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}`}
          >
            עורך ויזואלי
          </button>
          <button
            onClick={() => setEditorMode('html')}
            className={`text-xs px-2 py-1 rounded ${editorMode === 'html' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}`}
          >
            HTML
          </button>
        </div>
        {editorMode === 'rich' && <span className="text-[10px] text-slate-600">גרור תמונה לכאן או לחץ 🖼️</span>}
      </div>

      {editorMode === 'rich' ? (
        <RichEditor content={html} onChange={setHtml} />
      ) : (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full h-[60vh] px-4 py-3 rounded-xl text-sm font-mono leading-relaxed resize-none text-slate-200"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
          dir="rtl"
        />
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onSaveReview(companyIndex, selectedYear, html)}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors"
        >
          שמור סקירה
        </button>
        <button
          onClick={() => {
            const reviews = company.reviews || {};
            setHtml(flattenHtml(reviews[selectedYear]));
          }}
          className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200"
          style={{ background: '#1e293b' }}
        >
          בטל שינויים
        </button>
      </div>
    </div>
  );
}


function IntroEditor({
  category,
  catIndex,
  onSave,
  onBack,
}: {
  category: Category;
  catIndex: number;
  onSave: (catIndex: number, year: string, html: string) => Promise<void>;
  onBack: () => void;
}) {
  const intro = category.intro || {};
  const years = Object.keys(intro).sort();
  const [selectedYear, setSelectedYear] = useState(years[years.length - 1] || '2026');
  const [html, setHtml] = useState('');
  const [editorMode, setEditorMode] = useState<'rich' | 'html'>('rich');

  useEffect(() => {
    setHtml(flattenHtml(intro[selectedYear]));
  }, [selectedYear, intro]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">
          → חזרה
        </button>
        <h2 className="text-lg font-bold text-slate-100">הקדמה: {category.name}</h2>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              selectedYear === y ? 'bg-blue-500 text-white' : 'text-slate-400'
            }`}
            style={selectedYear !== y ? { background: '#1e293b' } : {}}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={() => setEditorMode('rich')} className={`text-xs px-2 py-1 rounded ${editorMode === 'rich' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}`}>עורך ויזואלי</button>
        <button onClick={() => setEditorMode('html')} className={`text-xs px-2 py-1 rounded ${editorMode === 'html' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500'}`}>HTML</button>
      </div>

      {editorMode === 'rich' ? (
        <RichEditor content={html} onChange={setHtml} />
      ) : (
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          className="w-full h-[60vh] px-4 py-3 rounded-xl text-sm font-mono resize-none text-slate-200"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
          dir="rtl"
        />
      )}

      <button
        onClick={() => onSave(catIndex, selectedYear, html)}
        className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500"
      >
        שמור הקדמה
      </button>
    </div>
  );
}


function AddCompanyForm({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  return (
    <div className="p-6 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      <h2 className="text-lg font-bold text-slate-100 mb-4">הוספת חברה חדשה</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם החברה"
        className="w-full px-4 py-3 rounded-lg text-sm text-slate-100 mb-4"
        style={{ background: '#1e293b', border: '1px solid #334155' }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => name && onSave(name)}
          disabled={!name}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 disabled:opacity-50"
        >
          הוסף
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm text-slate-400" style={{ background: '#1e293b' }}>
          ביטול
        </button>
      </div>
    </div>
  );
}


function AddCategoryForm({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  return (
    <div className="p-6 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      <h2 className="text-lg font-bold text-slate-100 mb-4">הוספת קטגוריה חדשה</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="שם הקטגוריה"
        className="w-full px-4 py-3 rounded-lg text-sm text-slate-100 mb-4"
        style={{ background: '#1e293b', border: '1px solid #334155' }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => name && onSave(name)}
          disabled={!name}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-green-500 disabled:opacity-50"
        >
          הוסף
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm text-slate-400" style={{ background: '#1e293b' }}>
          ביטול
        </button>
      </div>
    </div>
  );
}


function InterestingEditor({
  year,
  data,
  years,
  onSavePreamble,
  onSaveCompany,
  onAddCompany,
  onDeleteCompany,
  onCreateYear,
  onBack,
}: {
  year: string;
  data: InterestingData;
  years: string[];
  onSavePreamble: (year: string, preamble: string) => Promise<void>;
  onSaveCompany: (year: string, idx: number, company: { name: string; html: string }) => Promise<void>;
  onAddCompany: (year: string, name: string) => Promise<void>;
  onDeleteCompany: (year: string, idx: number) => Promise<void>;
  onCreateYear: (year: string) => Promise<void>;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'companies' | 'preamble'>('companies');
  const [preambleHtml, setPreambleHtml] = useState(data.preamble);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editHtml, setEditHtml] = useState('');
  const [editName, setEditName] = useState('');
  const [editorMode, setEditorMode] = useState<'rich' | 'html'>('rich');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newYearInput, setNewYearInput] = useState('');

  useEffect(() => { setPreambleHtml(data.preamble); }, [data.preamble]);
  useEffect(() => {
    if (selectedIdx !== null && data.companies[selectedIdx]) {
      setEditHtml(data.companies[selectedIdx].html);
      setEditName(data.companies[selectedIdx].name);
    }
  }, [selectedIdx, data.companies]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">← חזרה</button>
        <h2 className="text-lg font-bold text-amber-300">⭐ מעניינות {year}</h2>
        <span className="text-xs text-slate-500">{data.companies.length} חברות</span>
      </div>

      {/* Year tabs + add year */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => { /* parent handles year switch via sidebar */ }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              year === y ? 'bg-amber-500 text-white' : 'text-slate-400'
            }`}
            style={year !== y ? { background: '#1e293b' } : {}}
          >
            {y}
          </button>
        ))}
        <div className="flex items-center gap-1">
          <input
            value={newYearInput}
            onChange={(e) => setNewYearInput(e.target.value)}
            placeholder="שנה חדשה"
            className="w-24 px-2 py-1 rounded text-xs text-slate-100"
            style={{ background: '#1e293b', border: '1px solid #334155' }}
          />
          <button
            onClick={() => { if (newYearInput && !years.includes(newYearInput)) { onCreateYear(newYearInput); setNewYearInput(''); } }}
            className="text-xs text-green-400 hover:text-green-300"
          >
            + הוסף שנה
          </button>
        </div>
      </div>

      {/* Tab switch: companies / preamble */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setTab('companies'); setSelectedIdx(null); }}
          className={`px-4 py-2 rounded-lg text-sm ${tab === 'companies' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
          style={tab !== 'companies' ? { background: '#1e293b' } : {}}
        >
          חברות ({data.companies.length})
        </button>
        <button
          onClick={() => setTab('preamble')}
          className={`px-4 py-2 rounded-lg text-sm ${tab === 'preamble' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400'}`}
          style={tab !== 'preamble' ? { background: '#1e293b' } : {}}
        >
          הקדמה
        </button>
      </div>

      {/* ── Preamble tab ── */}
      {tab === 'preamble' && (
        <div>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setEditorMode('rich')} className={`text-xs px-2 py-1 rounded ${editorMode === 'rich' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'}`}>עורך ויזואלי</button>
            <button onClick={() => setEditorMode('html')} className={`text-xs px-2 py-1 rounded ${editorMode === 'html' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'}`}>HTML</button>
          </div>
          {editorMode === 'rich' ? (
            <RichEditor content={preambleHtml} onChange={setPreambleHtml} />
          ) : (
            <textarea
              value={preambleHtml}
              onChange={(e) => setPreambleHtml(e.target.value)}
              className="w-full h-[50vh] px-4 py-3 rounded-xl text-sm font-mono resize-none text-slate-200"
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}
              dir="rtl"
            />
          )}
          <button
            onClick={() => onSavePreamble(year, preambleHtml)}
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600"
          >
            שמור הקדמה
          </button>
        </div>
      )}

      {/* ── Companies tab ── */}
      {tab === 'companies' && selectedIdx === null && (
        <div>
          {/* Add company */}
          <div className="flex gap-2 mb-4">
            <input
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="שם חברה חדשה..."
              className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-100"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            <button
              onClick={() => { if (newCompanyName) { onAddCompany(year, newCompanyName); setNewCompanyName(''); } }}
              disabled={!newCompanyName}
              className="px-4 py-2 rounded-lg text-sm text-white bg-green-500 hover:bg-green-600 disabled:opacity-50"
            >
              + הוסף
            </button>
          </div>

          {/* Company list */}
          <div className="space-y-1">
            {data.companies.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
                style={{ background: '#0f172a', border: '1px solid #1e293b' }}
              >
                <button
                  onClick={() => setSelectedIdx(idx)}
                  className="text-slate-200 hover:text-amber-300 text-right flex-1"
                >
                  <span className="text-xs text-slate-500 ml-2">#{c.num}</span>
                  {c.name}
                </button>
                <button
                  onClick={() => onDeleteCompany(year, idx)}
                  className="text-red-400 hover:text-red-300 text-xs mr-3"
                >
                  מחק
                </button>
              </div>
            ))}
            {data.companies.length === 0 && (
              <div className="text-slate-500 text-sm text-center py-8">אין חברות עדיין</div>
            )}
          </div>
        </div>
      )}

      {/* ── Single company edit ── */}
      {tab === 'companies' && selectedIdx !== null && data.companies[selectedIdx] && (
        <div>
          <button onClick={() => setSelectedIdx(null)} className="text-sm text-blue-400 hover:text-blue-300 mb-4">
            ← חזרה לרשימה
          </button>
          <div className="mb-4 p-4 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">שם:</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg text-sm text-slate-100"
                style={{ background: '#1e293b', border: '1px solid #334155' }}
              />
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            <button onClick={() => setEditorMode('rich')} className={`text-xs px-2 py-1 rounded ${editorMode === 'rich' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'}`}>עורך ויזואלי</button>
            <button onClick={() => setEditorMode('html')} className={`text-xs px-2 py-1 rounded ${editorMode === 'html' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500'}`}>HTML</button>
          </div>
          {editorMode === 'rich' ? (
            <RichEditor content={editHtml} onChange={setEditHtml} />
          ) : (
            <textarea
              value={editHtml}
              onChange={(e) => setEditHtml(e.target.value)}
              className="w-full h-[50vh] px-4 py-3 rounded-xl text-sm font-mono resize-none text-slate-200"
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}
              dir="rtl"
            />
          )}
          <button
            onClick={() => onSaveCompany(year, selectedIdx, { name: editName, html: editHtml })}
            className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600"
          >
            שמור
          </button>
        </div>
      )}
    </div>
  );
}


function MergePanel({
  allCompanies,
  onMerge,
  onCancel,
  loading,
}: {
  allCompanies: Array<{ name: string; catPos: number; catName: string; idx: number }>;
  onMerge: (srcPos: number, srcIdx: number, tgtPos: number, tgtIdx: number) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [source, setSource] = useState<typeof allCompanies[0] | null>(null);
  const [target, setTarget] = useState<typeof allCompanies[0] | null>(null);

  const filteredSource = sourceSearch.length >= 2
    ? allCompanies.filter((c) => c.name.includes(sourceSearch)).slice(0, 10)
    : [];
  const filteredTarget = targetSearch.length >= 2
    ? allCompanies.filter((c) => c.name.includes(targetSearch)).slice(0, 10)
    : [];

  return (
    <div className="p-6 rounded-xl" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-100">איחוד חברות</h2>
        <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-200">ביטול</button>
      </div>

      {loading ? (
        <div className="text-slate-400 text-sm">טוען חברות...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Source */}
          <div>
            <div className="text-sm text-red-400 mb-2 font-medium">מקור (יימחק)</div>
            <input
              value={sourceSearch}
              onChange={(e) => { setSourceSearch(e.target.value); setSource(null); }}
              placeholder="חפש חברה..."
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-100 mb-2"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            {source ? (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                <div className="text-red-400 font-medium">{source.name}</div>
                <div className="text-xs text-slate-500">{source.catName}</div>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredSource.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { setSource(c); setSourceSearch(c.name); }}
                    className="w-full text-right px-3 py-2 rounded text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {c.name} <span className="text-slate-500">({c.catName})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target */}
          <div>
            <div className="text-sm text-green-400 mb-2 font-medium">יעד (ישמר)</div>
            <input
              value={targetSearch}
              onChange={(e) => { setTargetSearch(e.target.value); setTarget(null); }}
              placeholder="חפש חברה..."
              className="w-full px-3 py-2 rounded-lg text-sm text-slate-100 mb-2"
              style={{ background: '#1e293b', border: '1px solid #334155' }}
            />
            {target ? (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-sm">
                <div className="text-green-400 font-medium">{target.name}</div>
                <div className="text-xs text-slate-500">{target.catName}</div>
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {filteredTarget.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => { setTarget(c); setTargetSearch(c.name); }}
                    className="w-full text-right px-3 py-2 rounded text-xs text-slate-300 hover:bg-slate-800"
                  >
                    {c.name} <span className="text-slate-500">({c.catName})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {source && target && (
        <button
          onClick={() => onMerge(source.catPos, source.idx, target.catPos, target.idx)}
          className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-500 hover:bg-purple-600"
        >
          אחד את &quot;{source.name}&quot; לתוך &quot;{target.name}&quot;
        </button>
      )}
    </div>
  );
}
