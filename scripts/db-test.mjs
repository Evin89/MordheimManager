// Applies every migration to an in-process Postgres (PGlite, no install
// needed) on top of a small Supabase stand-in, then runs supabase/db-tests/*.sql.
//
//   npm run db:test              all tests
//   npm run db:test -- rls       only files whose name contains "rls"
//
// Each test file runs against a fresh database. A test fails by raising — use
// `select t.ok(<condition>, '<label>')`; `t.login(uuid)` / `t.logout()` switch
// between a signed-in user (role authenticated, auth.uid()), anon (null) and
// the superuser that owns the migrations.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const testsDir = join(root, 'supabase', 'db-tests');
const filter = process.argv[2] ?? '';

const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const tests = readdirSync(testsDir)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('_') && f.includes(filter))
  .sort();

async function freshDatabase() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(join(testsDir, '_shim.sql'), 'utf8'));
  for (const file of migrations) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (err) {
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
  return db;
}

let failed = 0;
for (const file of tests) {
  const notices = [];
  const db = await freshDatabase();
  try {
    await db.exec(readFileSync(join(testsDir, file), 'utf8'), {
      onNotice: (n) => notices.push(n.message),
    });
    const oks = notices.filter((m) => m.startsWith('ok - '));
    console.log(`PASS ${file} (${oks.length} checks)`);
    if (process.env.VERBOSE) for (const m of oks) console.log(`  ${m}`);
  } catch (err) {
    failed++;
    for (const m of notices.filter((n) => n.startsWith('ok - '))) console.log(`  ${m}`);
    console.log(`FAIL ${file}: ${err.message}`);
  } finally {
    await db.close();
  }
}
console.log(`${migrations.length} migrations, ${tests.length} test files, ${failed} failed`);
process.exit(failed ? 1 : 0);
