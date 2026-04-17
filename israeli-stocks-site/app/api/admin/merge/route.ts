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
    const { sourcePosition, sourceIndex, targetPosition, targetIndex, keepTargetOnConflict } =
      await request.json();

    const srcPath = catPath(sourcePosition);
    const tgtPath = catPath(targetPosition);

    const [srcFile, tgtFile, catsFile] = await Promise.all([
      readFile(srcPath),
      sourcePosition === targetPosition ? Promise.resolve(null) : readFile(tgtPath),
      readFile(CATEGORIES_PATH),
    ]);

    const srcCompanies = JSON.parse(srcFile.content);
    const tgtCompanies = tgtFile ? JSON.parse(tgtFile.content) : srcCompanies;

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
    files.push({ path: srcPath, content: JSON.stringify(srcCompanies, null, 2) });
    if (sourcePosition !== targetPosition) {
      files.push({ path: tgtPath, content: JSON.stringify(tgtCompanies, null, 2) });
    }

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
      `admin: merge "${source.name}" into "${target.name}"`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
