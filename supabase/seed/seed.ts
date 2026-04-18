import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

type Row = Record<string, unknown>;

async function loadJson<T extends Row>(file: string): Promise<T[]> {
  const raw = await readFile(resolve(__dirname, file), 'utf8');
  return JSON.parse(raw) as T[];
}

function withWordCount<T extends { body: string }>(rows: T[]) {
  return rows.map((r) => ({
    ...r,
    word_count: r.body.trim().split(/\s+/).length,
  }));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment',
    );
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const words = await loadJson('./words.json');
  const idioms = await loadJson('./idioms.json');
  const passages = withWordCount(await loadJson<{ body: string } & Row>('./passages.json'));

  const tasks: Array<[string, Row[], string]> = [
    ['words', words, 'lemma'],
    ['idioms', idioms, 'phrase'],
    ['passages', passages, 'slug'],
  ];

  for (const [table, rows, onConflict] of tasks) {
    const { error, count } = await supabase
      .from(table)
      .upsert(rows, { onConflict, count: 'exact' });
    if (error) {
      console.error(`Failed to upsert ${table}:`, error.message);
      process.exit(1);
    }
    console.log(`Upserted ${count ?? rows.length} rows into ${table}`);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
