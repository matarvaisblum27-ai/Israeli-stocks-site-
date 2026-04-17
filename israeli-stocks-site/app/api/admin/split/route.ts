import { NextResponse } from 'next/server';
import { readFile, writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';
const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function catPath(position: number) {
  return `israeli-stocks-site/public/data/cat-${position}.json`;
}

export async function POST(request: Request) {
  try {
    const { position, companyIndex, newName, years } = await request.json();
    // years: string[] — years to move to the new company

    if (!newName || !years || years.length === 0) {
      return NextResponse.json({ error: 'Missing newName or years' }, { status: 400 });
    }

    const path = catPath(position);
    const [catFile, catsFile] = await Promise.all([
      readFile(path),
      readFile(CATEGORIES_PATH),
    ]);

    const companies = JSON.parse(catFile.content);
    if (companyIndex < 0 || companyIndex >= companies.length) {
      return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
    }

    const original = companies[companyIndex];
    const newReviews: Record<string, string> = {};

    for (const year of years) {
      if (original.reviews?.[year]) {
        newReviews[year] = original.reviews[year];
        delete original.reviews[year];
      }
    }

    companies.push({ name: newName, reviews: newReviews });

    const files: Array<{ path: string; content: string }> = [
      { path, content: JSON.stringify(companies, null, 2) },
    ];

    // Rebuild search index
    const categories = JSON.parse(catsFile.content);
    const catFiles: Record<number, Array<{ name: string }>> = {};
    for (const cat of categories) {
      const p = catPath(cat.position);
      const existing = files.find((f) => f.path === p);
      if (existing) {
        catFiles[cat.position] = JSON.parse(existing.content);
      } else {
        try {
          const { content } = await readFile(p);
          catFiles[cat.position] = JSON.parse(content);
        } catch {
          catFiles[cat.position] = [];
        }
      }
    }
    const searchIndex = buildSearchIndex(categories, catFiles);
    files.push({ path: SEARCH_INDEX_PATH, content: JSON.stringify(searchIndex, null, 2) });

    await writeMultipleFiles(
      files,
      `admin: split "${original.name}" → "${newName}" (years: ${years.join(', ')})`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
