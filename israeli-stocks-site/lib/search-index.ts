/**
 * Rebuild search-index.json from categories and cat files.
 */

interface Category {
  id: number;
  name: string;
  position: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intro?: any;
}

interface Company {
  name: string;
  reviews?: Record<string, string>;
}

interface SearchEntry {
  name: string;
  catName: string;
  catIdx: number;
  catPos: number;
}

export function buildSearchIndex(
  categories: Category[],
  catFiles: Record<number, Company[]>
): SearchEntry[] {
  const entries: SearchEntry[] = [];

  categories.forEach((cat, idx) => {
    // Skip intro category
    if (cat.name.includes('הקדמה')) return;

    const companies = catFiles[cat.position];
    if (!companies) return;

    for (const company of companies) {
      entries.push({
        name: company.name,
        catName: cat.name,
        catIdx: idx,
        catPos: cat.position,
      });
    }
  });

  entries.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return entries;
}
