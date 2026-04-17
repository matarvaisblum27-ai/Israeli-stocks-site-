'use client';

import { useState, useEffect, useCallback } from 'react';

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

/* ─── Helpers ─── */
function flattenHtml(val: string | string[] | undefined): string {
  if (!val) return '';
  if (Array.isArray(val)) return val.join('\n');
  return val;
}

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
  const [mode, setMode] = useState<'categories' | 'company' | 'intro' | 'merge' | 'addCompany' | 'addCategory'>('categories');

  // For merge
  const [allCompanies, setAllCompanies] = useState<Array<{ name: string; catPos: number; catName: string; idx: number }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

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
  return (
    <div className="max-w-7xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="px-4 py-2 rounded-xl text-sm" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <span className="text-slate-400">קטגוריות: </span>
          <span className="text-slate-100 font-semibold">{categories.filter(c => !c.name.includes('הקדמה')).length}</span>
        </div>
        <div className="px-4 py-2 rounded-xl text-sm" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
          <span className="text-slate-400">חברות בקטגוריה: </span>
          <span className="text-slate-100 font-semibold">{companies.length}</span>
        </div>
        <button
          onClick={rebuildSearchIndex}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm text-blue-400 hover:text-blue-300 transition-colors"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          בנה אינדקס חיפוש מחדש
        </button>
        <button
          onClick={() => { setMode('merge'); loadAllCompanies(); }}
          className="px-4 py-2 rounded-xl text-sm text-purple-400 hover:text-purple-300 transition-colors"
          style={{ background: '#0f172a', border: '1px solid #1e293b' }}
        >
          איחוד חברות
        </button>
        <button
          onClick={() => setMode('addCategory')}
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

      <div className="flex gap-6">
        {/* ─── Sidebar: categories ─── */}
        <div className="w-64 shrink-0">
          <div className="sticky top-16 rounded-xl p-3 max-h-[calc(100vh-120px)] overflow-y-auto" style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <div className="text-xs text-slate-500 mb-2 px-2">קטגוריות</div>
            {categories.map((cat, idx) => {
              if (cat.name.includes('הקדמה')) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCatIdx(idx);
                    setSelectedCompanyIdx(null);
                    setMode('categories');
                  }}
                  className={`w-full text-right px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                    selectedCatIdx === idx
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
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
  const [showPreview, setShowPreview] = useState(false);

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

      {/* HTML Editor */}
      <div className="grid gap-4" style={{ gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">HTML</span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {showPreview ? 'הסתר תצוגה מקדימה' : 'תצוגה מקדימה'}
              </button>
            </div>
          </div>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full h-[60vh] px-4 py-3 rounded-xl text-sm font-mono leading-relaxed resize-none text-slate-200"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            dir="rtl"
          />
        </div>

        {showPreview && (
          <div
            className="p-4 rounded-xl overflow-auto h-[60vh] review-body text-sm"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

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
  const [showPreview, setShowPreview] = useState(false);

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

      <div className="grid gap-4" style={{ gridTemplateColumns: showPreview ? '1fr 1fr' : '1fr' }}>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-xs text-slate-500">HTML</span>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              {showPreview ? 'הסתר' : 'תצוגה מקדימה'}
            </button>
          </div>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="w-full h-[60vh] px-4 py-3 rounded-xl text-sm font-mono resize-none text-slate-200"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            dir="rtl"
          />
        </div>
        {showPreview && (
          <div
            className="p-4 rounded-xl overflow-auto h-[60vh] review-body text-sm"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>

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
