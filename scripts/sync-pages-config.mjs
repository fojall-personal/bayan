#!/usr/bin/env node
/**
 * Reconcile the Cloudflare Pages project with infra/pages-config.json.
 *
 *   node scripts/sync-pages-config.mjs           apply the config
 *   node scripts/sync-pages-config.mjs --check   report drift, exit 1, change nothing
 *
 * Needs CLOUDFLARE_API_TOKEN (Pages:Edit) and CLOUDFLARE_ACCOUNT_ID.
 *
 * ── Why this is not wrangler.toml ───────────────────────────────────────────
 *
 * Pages does support bindings in a wrangler.toml carrying pages_build_output_dir.
 * We do not use it because CI deploys with the output directory as a positional
 * argument (`pages deploy src/app/out`), which conflicts with that key — and the
 * deploy pipeline is the one thing that must not break. Revisit if the deploy
 * command is ever restructured.
 *
 * The --check mode is the point. Bindings live in the Pages project, not in the
 * repo, so they can be removed by anyone with dashboard access and no diff will
 * ever show it. Exactly that happened: the D1 binding was missing, auth worked,
 * /health returned 200, and every data route 500'd. --check turns that from a
 * silent production failure into a red build.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const check = process.argv.includes('--check');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;

const log = (m) => process.stdout.write(m + '\n');
const fail = (m) => {
  process.stderr.write(m + '\n');
  process.exitCode = 1;
};

if (!token || !account) {
  fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set.');
  process.exit(1);
}

const cfg = JSON.parse(await readFile(join(root, 'infra/pages-config.json'), 'utf-8'));
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${cfg.projectName}`;

async function cf(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(
      `${init.method ?? 'GET'} ${url} failed: ${JSON.stringify(body.errors)}`
    );
  }
  return body.result;
}

/** Compare only the fields we declare; Cloudflare echoes back extra keys. */
function diffEnv(envName, live) {
  const problems = [];

  const liveD1 = live.d1_databases ?? {};
  for (const [binding, want] of Object.entries(cfg.d1_databases)) {
    const got = liveD1[binding];
    if (!got) problems.push(`${envName}: D1 binding "${binding}" is MISSING`);
    else if (got.id !== want.id)
      problems.push(`${envName}: D1 "${binding}" points at ${got.id}, expected ${want.id}`);
  }

  const liveR2 = live.r2_buckets ?? {};
  for (const [binding, want] of Object.entries(cfg.r2_buckets)) {
    const got = liveR2[binding];
    if (!got) problems.push(`${envName}: R2 binding "${binding}" is MISSING`);
    else if (got.name !== want.name)
      problems.push(`${envName}: R2 "${binding}" is ${got.name}, expected ${want.name}`);
  }

  // Names only. Values are secrets and are never read or compared.
  const liveVars = live.env_vars ?? {};
  for (const name of cfg.requiredEnvVarNames) {
    if (!liveVars[name]) problems.push(`${envName}: env var "${name}" is MISSING`);
  }

  return problems;
}

const project = await cf(base);
const configs = project.deployment_configs ?? {};

const problems = [];
for (const envName of cfg.environments) {
  problems.push(...diffEnv(envName, configs[envName] ?? {}));
}

if (problems.length === 0) {
  log(`✅ Pages project "${cfg.projectName}" matches infra/pages-config.json`);
  for (const envName of cfg.environments) {
    const live = configs[envName] ?? {};
    log(
      `   ${envName}: d1=[${Object.keys(live.d1_databases ?? {})}] ` +
        `r2=[${Object.keys(live.r2_buckets ?? {})}] ` +
        `vars=[${Object.keys(live.env_vars ?? {})}]`
    );
  }
  process.exit(0);
}

for (const p of problems) process.stderr.write(`  ✘ ${p}\n`);

if (check) {
  fail(
    `\n${problems.length} drift(s) between the Pages project and infra/pages-config.json.\n` +
      'Run `node scripts/sync-pages-config.mjs` to reconcile.\n' +
      'A missing D1 binding does not fail the build — it makes every data route\n' +
      'return 500 in production while /health still returns 200.'
  );
  process.exit(1);
}

// Apply. Env vars are never written here: values are secrets, so a missing one
// is reported for a human to set with `wrangler pages secret put`.
const missingVars = problems.filter((p) => p.includes('env var'));
if (missingVars.length) {
  process.stderr.write(
    '\nNot fixing env vars — their values are secrets. Set them with:\n' +
      `  npx wrangler pages secret put <NAME> --project-name=${cfg.projectName}\n`
  );
}

const patch = { deployment_configs: {} };
for (const envName of cfg.environments) {
  patch.deployment_configs[envName] = {
    d1_databases: Object.fromEntries(
      Object.entries(cfg.d1_databases).map(([b, v]) => [b, { id: v.id }])
    ),
    r2_buckets: Object.fromEntries(
      Object.entries(cfg.r2_buckets).map(([b, v]) => [b, { name: v.name }])
    ),
  };
}

log('\nApplying bindings…');
const updated = await cf(base, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(patch),
});

for (const envName of cfg.environments) {
  const live = updated.deployment_configs?.[envName] ?? {};
  log(
    `   ${envName}: d1=[${Object.keys(live.d1_databases ?? {})}] ` +
      `r2=[${Object.keys(live.r2_buckets ?? {})}]`
  );
}
log('\nBindings take effect on the NEXT deployment, not retroactively.');
if (missingVars.length) process.exitCode = 1;
