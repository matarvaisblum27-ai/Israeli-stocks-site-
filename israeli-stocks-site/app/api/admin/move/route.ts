import { NextResponse } from 'next/server';
import { writeMultipleFiles, readDataFile } from '@/lib/github';
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
    const { fromPosition, companyIndex, toPosition } = await request.json();

    if (fromPosition === toPosition) {
      return NextResponse.json({ error: 'Same category' }, { status: 400 });
    }

    // Read fresh data from GitHub (source of truth) to avoid stale-read issues
    const fromCompanies = JSON.parse(await readDataFile(`cat-${fromPosition}.json`));
    const toCompanies = JSON.parse(await readDataFile(`cat-${toPosition}.json`));
    const categories = JSON.parse(await readDataFile('categories.json'));

    if (companyIndex < 0 || companyIndex >= fromCompanies.length) {
      return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
    }

    const [company] = fromCompanies.splice(companyIndex, 1);
    toCompanies.push(company);

    const files: Array<{ path: string; content: string }> = [
      { path: catGhPath(fromPosition), content: JSON.stringify(fromCompanies, null, 2) },
      { path: catGhPath(toPosition), content: JSON.stringify(toCompanies, null, 2) },
    ];

    // Rebuild search index — use fresh GitHub data for untouched cat files too
    const catFilesMap: Record<number, Array<{ name: string }>> = {};
    for (const cat of categories) {
      const existing = files.find((f) => f.path === catGhPath(cat.position));
      if (existing) {
        catFilesMap[cat.position] = JSON.parse(existing.content);
      } else {
        try { catFilesMap[cat.position] = JSON.parse(readLocal(`cat-${cat.position}.json`)); }
        catch { catFilesMap[cat.position] = []; }
      }
    }
    const searchIndex = buildSearchIndex(categories, catFilesMap);
    files.push({ path: SEARCH_INDEX_PATH, content: JSON.stringify(searchIndex, null, 2) });

    await writeMultipleFiles(
      files,
      `admin: move "${company.name}" from cat-${fromPosition} to cat-${toPosition}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
