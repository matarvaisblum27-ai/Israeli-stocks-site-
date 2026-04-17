import { NextResponse } from 'next/server';
import { readFile, writeMultipleFiles } from '@/lib/github';
import { buildSearchIndex } from '@/lib/search-index';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';
const SEARCH_INDEX_PATH = 'israeli-stocks-site/public/data/search-index.json';

function catPath(position: number) {
  return `israeli-stocks-site/public/data/cat-${position}.json`;
}

async function rebuildAndSave(
  files: Array<{ path: string; content: string }>,
  message: string
) {
  // Load categories
  const existingCatsEntry = files.find((f) => f.path === CATEGORIES_PATH);
  let categoriesContent: string;
  if (existingCatsEntry) {
    categoriesContent = existingCatsEntry.content;
  } else {
    const { content } = await readFile(CATEGORIES_PATH);
    categoriesContent = content;
  }
  const categories = JSON.parse(categoriesContent);

  // Load all cat files
  const catFiles: Record<number, Array<{ name: string; reviews?: Record<string, string> }>> = {};
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

  // Rebuild search index
  const searchIndex = buildSearchIndex(categories, catFiles);
  files.push({
    path: SEARCH_INDEX_PATH,
    content: JSON.stringify(searchIndex, null, 2),
  });

  await writeMultipleFiles(files, message);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const position = url.searchParams.get('position');
    if (!position) return NextResponse.json({ error: 'position required' }, { status: 400 });

    const { content } = await readFile(catPath(parseInt(position)));
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { position, companyIndex, updates } = await request.json();
    // updates: { name?, reviews?: { year: html } }

    const path = catPath(position);
    const { content } = await readFile(path);
    const companies = JSON.parse(content);

    if (companyIndex < 0 || companyIndex >= companies.length) {
      return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
    }

    const company = companies[companyIndex];
    if (updates.name !== undefined) company.name = updates.name;
    if (updates.reviews) {
      if (!company.reviews) company.reviews = {};
      for (const [year, html] of Object.entries(updates.reviews)) {
        if (html === null || html === '') {
          delete company.reviews[year];
        } else {
          company.reviews[year] = html;
        }
      }
    }

    const files = [{ path, content: JSON.stringify(companies, null, 2) }];
    await rebuildAndSave(files, `admin: update "${company.name}" in cat-${position}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { position, name, reviews } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const path = catPath(position);
    let companies = [];
    try {
      const { content } = await readFile(path);
      companies = JSON.parse(content);
    } catch {
      // New cat file
    }

    companies.push({ name, reviews: reviews || {} });

    const files = [{ path, content: JSON.stringify(companies, null, 2) }];
    await rebuildAndSave(files, `admin: add company "${name}" to cat-${position}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { position, companyIndex } = await request.json();

    const path = catPath(position);
    const { content } = await readFile(path);
    const companies = JSON.parse(content);

    if (companyIndex < 0 || companyIndex >= companies.length) {
      return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
    }

    const removed = companies.splice(companyIndex, 1)[0];

    const files = [{ path, content: JSON.stringify(companies, null, 2) }];
    await rebuildAndSave(files, `admin: remove "${removed.name}" from cat-${position}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
