import { NextResponse } from 'next/server';
import { writeMultipleFiles, readDataFile } from '@/lib/github';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PREFIX = 'israeli-stocks-site/public/data/';

function yearPath(year: string) {
  return `${PREFIX}interesting-${year}.json`;
}

const YEARS_PATH = `${PREFIX}interesting-years.json`;

function readLocal(filename: string): string {
  return readFileSync(join(process.cwd(), 'public', 'data', filename), 'utf-8');
}

async function readFromGitHubOrLocal(filename: string): Promise<string> {
  try {
    return await readDataFile(filename);
  } catch {
    const localPath = join(process.cwd(), 'public', 'data', filename);
    if (existsSync(localPath)) {
      return readFileSync(localPath, 'utf-8');
    }
    throw new Error(`File not found: ${filename}`);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const year = url.searchParams.get('year');

    if (type === 'years') {
      try {
        const content = await readFromGitHubOrLocal('interesting-years.json');
        return NextResponse.json(JSON.parse(content));
      } catch {
        return NextResponse.json([]);
      }
    }

    if (year) {
      try {
        const content = await readFromGitHubOrLocal(`interesting-${year}.json`);
        return NextResponse.json(JSON.parse(content));
      } catch {
        return NextResponse.json({ preamble: '', companies: [] });
      }
    }

    return NextResponse.json({ error: 'year or type=years required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { year, preamble, companyIndex, company } = await request.json();
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

    // Read fresh data from GitHub (source of truth)
    const data = JSON.parse(await readDataFile(`interesting-${year}.json`));

    if (preamble !== undefined) {
      data.preamble = preamble;
    }

    if (companyIndex !== undefined && company) {
      if (companyIndex < 0 || companyIndex >= data.companies.length) {
        return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
      }
      data.companies[companyIndex] = {
        ...data.companies[companyIndex],
        name: company.name,
        html: company.html,
      };
    }

    const files = [{ path: yearPath(year), content: JSON.stringify(data, null, 2) }];
    const msg = preamble !== undefined
      ? `admin: update interesting ${year} preamble`
      : `admin: update interesting ${year} company "${company?.name}"`;
    await writeMultipleFiles(files, msg);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { year, company, createYear } = await request.json();
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

    if (createYear) {
      // Create a new year file and add to years list
      const newData = { preamble: '', companies: [] };

      let years: string[] = [];
      try {
        years = JSON.parse(await readDataFile('interesting-years.json'));
      } catch {
        // No years file yet
      }

      if (!years.includes(year)) {
        years.unshift(year);
        years.sort((a: string, b: string) => Number(b) - Number(a));
      }

      const files = [
        { path: yearPath(year), content: JSON.stringify(newData, null, 2) },
        { path: YEARS_PATH, content: JSON.stringify(years) },
      ];
      await writeMultipleFiles(files, `admin: create interesting year ${year}`);

      return NextResponse.json({ ok: true });
    }

    if (company) {
      // Add a new company to an existing year
      const data = JSON.parse(await readDataFile(`interesting-${year}.json`));

      const maxId = data.companies.length > 0
        ? Math.max(...data.companies.map((c: { id: number }) => c.id))
        : -1;
      const maxNum = data.companies.length > 0
        ? Math.max(...data.companies.map((c: { num: number }) => c.num))
        : 0;

      data.companies.push({
        id: maxId + 1,
        year,
        num: maxNum + 1,
        name: company.name,
        html: company.html || '',
      });

      const files = [{ path: yearPath(year), content: JSON.stringify(data, null, 2) }];
      await writeMultipleFiles(files, `admin: add interesting ${year} company "${company.name}"`);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'company or createYear required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { year, companyIndex, deleteYear } = await request.json();
    if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

    if (deleteYear) {
      // Remove year from years list and delete the year file
      let years: string[] = [];
      try {
        years = JSON.parse(await readDataFile('interesting-years.json'));
      } catch {
        // No years file
      }

      years = years.filter((y: string) => y !== year);

      // Write empty content to the year file to effectively delete it,
      // and update the years list
      const emptyData = { preamble: '', companies: [] };
      const files = [
        { path: yearPath(year), content: JSON.stringify(emptyData, null, 2) },
        { path: YEARS_PATH, content: JSON.stringify(years) },
      ];
      await writeMultipleFiles(files, `admin: delete interesting year ${year}`);

      return NextResponse.json({ ok: true });
    }

    if (companyIndex !== undefined) {
      // Remove a company from the year
      const data = JSON.parse(await readDataFile(`interesting-${year}.json`));

      if (companyIndex < 0 || companyIndex >= data.companies.length) {
        return NextResponse.json({ error: 'Invalid company index' }, { status: 400 });
      }

      const removed = data.companies.splice(companyIndex, 1)[0];

      const files = [{ path: yearPath(year), content: JSON.stringify(data, null, 2) }];
      await writeMultipleFiles(files, `admin: remove interesting ${year} company "${removed.name}"`);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'companyIndex or deleteYear required' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
