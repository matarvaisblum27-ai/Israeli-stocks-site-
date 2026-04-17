import { NextResponse } from 'next/server';
import { writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';
import { readFileSync } from 'fs';
import { join } from 'path';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';
const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function catGhPath(position: number) {
  return `israeli-stocks-site/public/data/cat-${position}.json`;
}

function readLocal(filename: string): string {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

export async function POST(request: Request) {
  try {
    const { sourcePosition, sourceIndex, targetPosition, targetIndex, keepTargetOnConflict } =
      await request.json();

    const srcCompanies = JSON.parse(readLocal(`cat-${sourcePosition}.json`));
    const tgtCompanies = sourcePosition === targetPosition
      ? srcCompanies
      : JSON.parse(readLocal(`cat-${targetPosition}.json`));
    const categories = JSON.parse(readLocal('categories.json'));

    if (sourceIndex < 0 || sourceIndex >= srcCompanies.length) {
      return NextResponse.json({ error: 'Invalid source index' }, { status: 400 });
    }
    if (targetIndex < 0 || targetIndex >= tgtCompanies.length) {
      return NextResponse.json({ error: 'Invalid target index' }, { status: 400 });
    }

    const source = srcCompanies[sourceIndex];
    const target = tgtCompanies[targetIndex];

    // Merge reviews
    if (!target.reviews) target.reviews = {};
    for (const [year, html] of Object.entries(source.reviews || {})) {
      if (!target.reviews[year] || !keepTargetOnConflict) {
        target.reviews[year] = html;
      }
    }

    // Remove source
    srcCompanies.splice(sourceIndex, 1);

    const files: Array<{ path: string; content: string }> = [];
    files.push({ path: catGhPath(sourcePosition), content: JSON.stringify(srcCompanies, null, 2) });
    if (sourcePosition !== targetPosition) {
      files.push({ path: catGhPath(targetPosition), content: JSON.stringify(tgtCompanies, null, 2) });
    }

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

    await writeMultipleFiles(files, `admin: merge "${source.name}" into "${target.name}"`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
