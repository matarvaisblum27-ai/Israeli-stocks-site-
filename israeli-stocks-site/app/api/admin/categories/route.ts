import { NextResponse } from 'next/server';
import { writeMultipleFiles, readDataFile } from '@/lib/github';
import { readFileSync } from 'fs';
import { join } from 'path';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';

function readLocal(filename: string) {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

export async function GET() {
  try {
    // Try GitHub first (always fresh), fall back to local
    try {
      const content = await readDataFile('categories.json');
      return NextResponse.json(JSON.parse(content));
    } catch {
      const content = readLocal('categories.json');
      return NextResponse.json(JSON.parse(content));
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { index, updates } = await request.json();
    // Read fresh data from GitHub (source of truth)
    const categories = JSON.parse(await readDataFile('categories.json'));

    if (index < 0 || index >= categories.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    if (updates.name !== undefined) categories[index].name = updates.name;
    if (updates.intro !== undefined) {
      if (!categories[index].intro) categories[index].intro = {};
      Object.assign(categories[index].intro, updates.intro);
    }

    await writeMultipleFiles(
      [{ path: CATEGORIES_PATH, content: JSON.stringify(categories, null, 2) }],
      `admin: update category "${categories[index].name}"`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    // Read fresh data from GitHub (source of truth)
    const categories = JSON.parse(await readDataFile('categories.json'));

    // Find next available position
    const maxPos = Math.max(...categories.map((c: { position: number }) => c.position));
    const newPos = maxPos + 1;
    const newId = newPos;

    categories.push({
      id: newId,
      name,
      position: newPos,
      intro: {},
    });

    const catFilePath = `israeli-stocks-site/public/data/cat-${newPos}.json`;

    await writeMultipleFiles(
      [
        { path: CATEGORIES_PATH, content: JSON.stringify(categories, null, 2) },
        { path: catFilePath, content: '[]' },
      ],
      `admin: add category "${name}"`
    );

    return NextResponse.json({ ok: true, position: newPos });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { fromIndex, toIndex } = await request.json();
    // Read fresh data from GitHub (source of truth)
    const categories = JSON.parse(await readDataFile('categories.json'));

    if (fromIndex < 0 || fromIndex >= categories.length || toIndex < 0 || toIndex >= categories.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    // Remove from old position, insert at new position
    const [moved] = categories.splice(fromIndex, 1);
    categories.splice(toIndex, 0, moved);

    await writeMultipleFiles(
      [{ path: CATEGORIES_PATH, content: JSON.stringify(categories, null, 2) }],
      `admin: reorder category "${moved.name}" from position ${fromIndex} to ${toIndex}`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { index } = await request.json();
    // Read fresh data from GitHub (source of truth)
    const categories = JSON.parse(await readDataFile('categories.json'));

    if (index < 0 || index >= categories.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const cat = categories[index];
    // Check if category has companies
    try {
      const companies = JSON.parse(await readDataFile(`cat-${cat.position}.json`));
      if (companies.length > 0) {
        return NextResponse.json(
          { error: 'לא ניתן למחוק קטגוריה שיש בה חברות' },
          { status: 400 }
        );
      }
    } catch {
      // Cat file doesn't exist, ok to delete
    }

    categories.splice(index, 1);

    await writeMultipleFiles(
      [{ path: CATEGORIES_PATH, content: JSON.stringify(categories, null, 2) }],
      `admin: delete category "${cat.name}"`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
