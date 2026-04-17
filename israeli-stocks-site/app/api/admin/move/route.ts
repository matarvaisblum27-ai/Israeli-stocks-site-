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
    const { fromPosition, companyIndex, toPosition } = await request.json();

    if (fromPosition === toPosition) {
      return NextResponse.json({ error: 'Same category' }, { status: 400 });
    }

    const fromPath = catPath(fromPosition);
    const toPath = catPath(toPosition);

    const [fromFile, toFile, catsFile] = await Promise.all([
      readFile(fromPath),
      readFile(toPath),
      readFile(CATEGORIES_PATH),
    ]);

    const fromCompanies = JSON.parse(fromFile.content);
    const toCompanies = JSON.parse(toFile.content);

    if (companyIndex < 0 || companyIndex >= fromCompanies.length) {
      return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
    }

    const [company] = fromCompanies.splice(companyIndex, 1);
    toCompanies.push(company);

    const files: Array<{ path: string; content: string }> = [
      { path: fromPath, content: JSON.stringify(fromCompanies, null, 2) },
      { path: toPath, content: JSON.stringify(toCompanies, null, 2) },
    ];

    // Rebuild search index
    const categories = JSON.parse(catsFile.content);
    const catFilesMap: Record<number, Array<{ name: string }>> = {};
    for (const cat of categories) {
      const p = catPath(cat.position);
      const existing = files.find((f) => f.path === p);
      if (existing) {
        catFilesMap[cat.position] = JSON.parse(existing.content);
      } else {
        try {
          const { content } = await readFile(p);
          catFilesMap[cat.position] = JSON.parse(content);
        } catch {
          catFilesMap[cat.position] = [];
        }
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
