#!/usr/bin/env node
/**
 * Apply a SQL file to remote D1 through the QUERY api.
 *
 *   node scripts/seed-remote-d1.mjs scripts/seed-lessons.sql
 *
 * Needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and D1_DATABASE_ID in the
 * environment.
 *
 * ── Why the query api rather than `wrangler d1 execute --file` ─────────────
 *
 * `--file` uploads through the IMPORT api, which needs the file staged; the query api
 * takes statements directly and accepts several per request (verified: two SELECTs
 * return two result sets), so a generated seed goes in a few batches with no staging.
 *
 * It does NOT get around a permission problem, and an earlier version of this comment
 * claimed it did. The repository's CI token returns code 7403 on every D1 route —
 * import, query via wrangler, and query via direct REST with the owning account pinned.
 * 7403 is authorization for the D1 service on the account, so endpoint choice is
 * irrelevant; the token needs D1:Edit, which Cloudflare requires explicitly for HTTP
 * API writes. Until then this runs from a machine whose credential has that permission.
 *
 * How that mistake happened, since it wasted two pushes: I probed the token with
 * `continue-on-error: true` steps and read each step's `.conclusion`, which GitHub forces
 * to "success" for such steps. Both probes had failed. Read `.outcome`.
 */

import { readFile } from 'node:fs/promises';

const file = process.argv[2];
if (!file) {
  process.stderr.write('usage: node scripts/seed-remote-d1.mjs <file.sql>\n');
  process.exit(1);
}

const { CLOUDFLARE_API_TOKEN: token, D1_DATABASE_ID: database } = process.env;

/**
 * The account that owns this D1 database.
 *
 * Pinned rather than read from CLOUDFLARE_ACCOUNT_ID. An earlier comment here claimed
 * the secret held a different account and that this was the fix for a 403 — both wrong.
 * The mismatch note below never fired in CI, so the secret's account is correct, and the
 * 403 was the token lacking D1 access entirely (code 7403, service authorization).
 *
 * Still pinned, because an account id is an identifier rather than a credential — it
 * appears in the workflow, the README and Cloudflare's error text — and keeping it beside
 * the database id leaves one fewer thing that can be configured wrongly.
 */
const OWNING_ACCOUNT = '26f84481311bd42e09b8bdca6804661d';
const account = OWNING_ACCOUNT;

if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== OWNING_ACCOUNT) {
  // Reported, not silently overridden, so the discrepancy is visible to whoever set it.
  process.stderr.write(
    '  note: CLOUDFLARE_ACCOUNT_ID differs from the account that owns this database; ' +
      'using the owner.\n'
  );
}

for (const [name, value] of Object.entries({
  CLOUDFLARE_API_TOKEN: token,
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
//
// Counts every statement, not just INSERTs: the derived-content seed opens with a DELETE
// that clears the kinds it is about to write, and counting inserts alone made the check
// fire on a file that was perfectly correct — a refusal is only useful if it means
// something is actually wrong.
const expected = (sql.match(/^\s*(?:INSERT|DELETE|UPDATE)\b/gim) ?? []).length;
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
