import { NextResponse } from 'next/server';
import { writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';
import { readFileSync } from 'fs';
import { join } from 'path';

const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function readLocal(filename: string): string {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

export async function POST() {
  try {
    const categories = JSON.parse(readLocal('categories.json'));

    const catFiles: Record<number, Array<{ name: string; reviews?: Record<string, string> }>> = {};
    for (const cat of categories) {
      try {
        catFiles[cat.position] = JSON.parse(readLocal(`cat-${cat.position}.json`));
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
