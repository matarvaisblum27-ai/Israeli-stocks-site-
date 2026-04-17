import { NextResponse } from 'next/server';
import { writeMultipleFiles, readDataFile } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';

const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

export async function POST() {
  try {
    // Read fresh data from GitHub (source of truth)
    const categories = JSON.parse(await readDataFile('categories.json'));

    const catFiles: Record<number, Array<{ name: string; reviews?: Record<string, string> }>> = {};
    for (const cat of categories) {
      try {
        catFiles[cat.position] = JSON.parse(await readDataFile(`cat-${cat.position}.json`));
      } catch {
        catFiles[cat.position] = [];
      }
    }

    const searchIndex = buildSearchIndex(categories, catFiles);

    await writeMultipleFiles(
      [{ path: SEARCH_INDEX_PATH, content: JSON.stringify(searchIndex, null, 2) }],
      'admin: rebuild search index'
    );

    return NextResponse.json({ ok: true, count: searchIndex.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
