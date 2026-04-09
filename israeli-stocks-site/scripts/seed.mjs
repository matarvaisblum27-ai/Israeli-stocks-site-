// Seed Supabase with data from unified.json and _index.json.
// Usage: node scripts/seed.mjs
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const unified = JSON.parse(fs.readFileSync(path.join(__dirname, '_unified.json'), 'utf8'));
const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, '_index.json'), 'utf8'));

async function run() {
  console.log('Clearing existing data...');
  await sb.from('interesting_index').delete().neq('id', 0);
  await sb.from('interesting_preamble').delete().neq('year', '');
  await sb.from('companies').delete().neq('id', 0);
  await sb.from('categories').delete().neq('id', 0);

  console.log(`Inserting ${unified.length} categories...`);
  const catRows = unified.map((c, i) => ({
    name: c.name,
    position: i,
    intro: c.intro && typeof c.intro === 'object' ? c.intro : null,
  }));
  const { data: cats, error: catErr } = await sb
    .from('categories')
    .insert(catRows)
    .select();
  if (catErr) throw catErr;

  const nameToId = new Map(cats.map((c) => [c.name, c.id]));

  const compRows = [];
  for (const cat of unified) {
    const cid = nameToId.get(cat.name);
    (cat.companies || []).forEach((co, i) => {
      compRows.push({
        category_id: cid,
        name: co.name,
        position: i,
        reviews: co.reviews || {},
      });
    });
  }
  console.log(`Inserting ${compRows.length} companies (in batches)...`);
  for (let i = 0; i < compRows.length; i += 200) {
    const batch = compRows.slice(i, i + 200);
    const { error } = await sb.from('companies').insert(batch);
    if (error) throw error;
    process.stdout.write(`  ${Math.min(i + 200, compRows.length)}/${compRows.length}\r`);
  }
  console.log('');

  console.log('Inserting interesting index...');
  const preRows = [];
  const idxRows = [];
  for (const [year, obj] of Object.entries(indexData)) {
    preRows.push({ year, preamble: obj.preamble || '' });
    (obj.companies || []).forEach((c) => {
      idxRows.push({
        year,
        num: c.num,
        name: c.name,
        html: c.html || '',
      });
    });
  }
  if (preRows.length) {
    const { error } = await sb.from('interesting_preamble').insert(preRows);
    if (error) throw error;
  }
  for (let i = 0; i < idxRows.length; i += 200) {
    const batch = idxRows.slice(i, i + 200);
    const { error } = await sb.from('interesting_index').insert(batch);
    if (error) throw error;
  }

  console.log('✓ Seed complete.');
  console.log(`  Categories: ${catRows.length}`);
  console.log(`  Companies: ${compRows.length}`);
  console.log(`  Interesting years: ${preRows.length}`);
  console.log(`  Interesting entries: ${idxRows.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
