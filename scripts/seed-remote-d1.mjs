#!/usr/bin/env node
/**
 * Apply a SQL file to remote D1 through the QUERY api.
 *
 *   node scripts/seed-remote-d1.mjs scripts/seed-lessons.sql
 *
 * Needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID in the
 * environment.
 *
 * ── Why not `wrangler d1 execute --file` ────────────────────────────────────
 *
 * Because it cannot run in CI, and the reason is narrower than it first looked.
 *
 * `--file` uploads through the IMPORT api (/d1/database/:id/import), which returns
 * "Authentication error [code: 10000]" for the repository's token. I concluded from that
 * one error that the token had no D1 write permission, told the user so, and reverted the
 * automation. That was an inference from a single endpoint, not a measurement.
 *
 * Two probes in CI proved it wrong: the same token reads D1 and WRITES to it happily
 * through the query api (/d1/database/:id/query). Only the import path is closed. So
 * seeding needs no permission change at all — it needs the other endpoint.
 *
 * The query endpoint accepts several statements in one `sql` string (verified: two
 * SELECTs return two result sets), so the file is sent in batches rather than one
 * statement at a time.
 */

import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) {
  process.stderr.write('usage: node scripts/seed-remote-d1.mjs <file.sql>\n');
  process.exit(1);
}

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, D1_DATABASE_ID: database } =
  process.env;

for (const [name, value] of Object.entries({
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID: account,
  D1_DATABASE_ID: database,
})) {
  if (!value) {
    process.stderr.write(`✘ ${name} is not set\n`);
    process.exit(1);
  }
}

const sql = await readFile(file, 'utf-8');

/**
 * Split into statements on semicolons that end a line.
 *
 * Deliberately not a general SQL parser. Every file this is used on is GENERATED — one
 * INSERT OR REPLACE per line, ending in ";\n" — so the simple rule is exact for the
 * real input. A hand-written file with a semicolon inside a string literal would break
 * it, which is why it refuses anything that does not look generated.
 */
if (!/^-- Generated/m.test(sql)) {
  process.stderr.write(
    `✘ ${file} does not begin with a "-- Generated" marker.\n` +
      '  This splitter assumes one generated statement per line and is not a SQL parser.\n'
  );
  process.exit(1);
}

const statements = sql
  .split(/;\s*$/m)
  // Strip leading comment LINES rather than discarding any part that begins with one.
  //
  // The first version filtered out anything starting with '--', which threw away the
  // file's header comments — and the first INSERT along with them, because the header
  // and statement one land in the same split part. It applied 69 of 70 statements and
  // said nothing: grammar-01 would never have been seeded, and the count check below is
  // the only reason that surfaced before this shipped.
  .map((part) =>
    part
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim()
  )
  .filter((s) => s.length > 0)
  .map((s) => `${s};`);

// The file is generated one statement per line, so the count is knowable. Asserting it
// turns a silent partial apply into a refusal.
const expected = (sql.match(/INSERT OR REPLACE/g) ?? []).length;
if (expected > 0 && statements.length !== expected) {
  process.stderr.write(
    `✘ split produced ${statements.length} statement(s) but the file has ${expected} ` +
      'INSERTs — refusing to apply a partial seed.\n'
  );
  process.exit(1);
}

if (statements.length === 0) {
  process.stderr.write(`✘ no statements found in ${file}\n`);
  process.exit(1);
}

// Batched to keep each request well inside the api's body limits while staying to a
// handful of round trips.
const BATCH = 25;
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`;

let applied = 0;
for (let i = 0; i < statements.length; i += BATCH) {
  const chunk = statements.slice(i, i + BATCH);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: chunk.join('\n') }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    process.stderr.write(
      `✘ batch ${Math.floor(i / BATCH) + 1} failed (HTTP ${res.status})\n` +
        `  ${JSON.stringify(body?.errors ?? body).slice(0, 300)}\n`
    );
    process.exit(1);
  }
  applied += chunk.length;
  process.stderr.write(`  applied ${applied}/${statements.length}\n`);
}

process.stdout.write(
  `✅ applied ${applied} statement(s) from ${file} to D1 via the query api\n`
);
