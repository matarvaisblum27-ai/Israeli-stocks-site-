import { NextResponse } from 'next/server';
import { readFile, writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';
const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function catPath(position: number) {
  return `israeli-stocks-site/public/data/cat-${position}.json`;
}

export async function POST() {
  try {
    const { content: catsContent } = await readFile(CATEGORIES_PATH);
    const categories = JSON.parse(catsContent);

    const catFiles: Record<number, Array<{ name: string; reviews?: Record<string, string> }>> = {};
    for (const cat of categories) {
      try {
        const { content } = await readFile(catPath(cat.position));
        catFiles[cat.position] = JSON.parse(content);
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
