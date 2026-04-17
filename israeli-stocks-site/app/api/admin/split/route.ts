import { NextResponse } from 'next/server';
import { writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';
import { readFileSync } from 'fs';
import { join } from 'path';

const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function catGhPath(position: number) {
  return `israeli-stocks-site/public/data/cat-${position}.json`;
}

function readLocal(filename: string): string {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

export async function POST(request: Request) {
  try {
    const { position, companyIndex, newName, years } = await request.json();

    if (!newName || !years || years.length === 0) {
      return NextResponse.json({ error: 'Missing newName or years' }, { status: 400 });
    }

    const companies = JSON.parse(readLocal(`cat-${position}.json`));
    const categories = JSON.parse(readLocal('categories.json'));

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
      { path: catGhPath(position), content: JSON.stringify(companies, null, 2) },
    ];

    // Rebuild search index
    const catFiles: Record<number, Array<{ name: string }>> = {};
    for (const cat of categories) {
      const existing = files.find((f) => f.path === catGhPath(cat.position));
      if (existing) {
        catFiles[cat.position] = JSON.parse(existing.content);
      } else {
        try { catFiles[cat.position] = JSON.parse(readLocal(`cat-${cat.position}.json`)); }
        catch { catFiles[cat.position] = []; }
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
