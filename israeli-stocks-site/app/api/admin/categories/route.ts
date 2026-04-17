import { NextResponse } from 'next/server';
import { readFile, writeMultipleFiles } from '@/lib/github';
import { readFileSync } from 'fs';
import { join } from 'path';

const CATEGORIES_PATH = 'israeli-stocks-site/public/data/categories.json';

function readLocal(filename: string) {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

export async function GET() {
  try {
    const content = readLocal('categories.json');
    return NextResponse.json(JSON.parse(content));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { index, updates } = await request.json();
    // updates can include: name, intro (per year)
    const categories = JSON.parse(readLocal('categories.json'));

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

    const categories = JSON.parse(readLocal('categories.json'));

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

export async function DELETE(request: Request) {
  try {
    const { index } = await request.json();
    const categories = JSON.parse(readLocal('categories.json'));

    if (index < 0 || index >= categories.length) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const cat = categories[index];
    // Check if category has companies
    try {
      const companies = JSON.parse(readLocal(`cat-${cat.position}.json`));
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
