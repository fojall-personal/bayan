#!/usr/bin/env node
/**
 * Keep the endpoint list in AGENTS.md honest.
 *
 *   node scripts/gen-api-docs.mjs           # rewrite the fenced block
 *   node scripts/gen-api-docs.mjs --check   # fail if it is out of date
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * AGENTS.md is the file an agent reads first, and its API list has already been
 * wrong once: it named five endpoints that never existed and omitted a dozen that
 * did. It was then rewritten by hand from the source, which fixed that instance
 * and left the same hazard in place — and sure enough, four endpoints added later
 * (`/api/quran/ayah/:s/:a`, coverage, the root loop, calibration) were missing
 * again, because nothing failed when they were.
 *
 * A hand-maintained mirror of a route table drifts for the same reason a
 * hand-maintained mirror of a palette drifts. So this reads the route files and
 * how index.ts mounts them, and --check makes staleness a red build.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const ROUTES_DIR = join(root, 'workers/src/routes');
const AGENTS = join(root, 'AGENTS.md');

const index = await readFile(join(root, 'workers/src/index.ts'), 'utf-8');

// app.route('/api/grammar', grammarRoutes) → which prefix each router is mounted on.
const mounts = new Map();
for (const m of index.matchAll(/app\.route\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
  mounts.set(m[2], m[1]);
}

const files = (await readdir(ROUTES_DIR)).filter((f) => f.endsWith('.ts'));
const endpoints = [];

for (const file of files) {
  const src = await readFile(join(ROUTES_DIR, file), 'utf-8');
  // The exported router name, so it can be matched against how index.ts mounts it.
  const exported = /export const (\w+)\s*=\s*new Hono/.exec(src)?.[1];
  if (!exported) continue;
  const prefix = mounts.get(exported);
  if (!prefix) continue; // defined but not mounted — nothing serves it

  // `routerName.get('/path'` and the chained `.get('/path'` form both appear.
  for (const m of src.matchAll(
    /(?:^|\n)\s*(?:\w+\s*)?\.?(get|post|put|patch|delete)\(\s*'([^']*)'/gi
  )) {
    const method = m[1].toUpperCase();
    const path = m[2];
    // Skip Hono middleware registrations and anything that is not a route literal.
    if (!path.startsWith('/')) continue;
    const full = (prefix + (path === '/' ? '' : path)).replace(/\/+$/, '') || prefix;
    endpoints.push({ method, path: full });
  }
}

// /health is registered directly on the app rather than in a router.
for (const m of index.matchAll(/app\.(get|post)\(\s*'(\/[^']*)'/g)) {
  if (m[2].startsWith('/api/')) continue;
  endpoints.push({ method: m[1].toUpperCase(), path: m[2] });
}

const seen = new Set();
const list = endpoints
  .filter((e) => {
    const k = `${e.method} ${e.path}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  })
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

/** Notes worth keeping beside a path. Only for things a reader cannot infer. */
const NOTES = {
  '/api/grammar/root/:root': 'corpus-derived root family, Arabic script',
  '/api/grammar/exercises': '4,950-item graded bank; ?level=1-5 &kind=',
  '/api/tutor/history': 'last 50 turns; the chat restores the most recent three',
  '/api/tutor/suggested-exercises': 'weak lessons by accuracy over answered questions',
  '/api/memorization/curriculum': '908 ordered units; ?level=1-6 &limit &offset',
  '/api/quran/ayah/:surah/:ayah': 'one ayah: text, words + gloss + parse + known flag, tajweed',
  '/api/progress/coverage': 'ayahs readable from known roots; 400 roots is half the Quran',
  '/api/progress/roots/:root/known': 'POST records, DELETE undoes; POST returns the delta',
  '/api/progress/calibration': 'GET twelve sampled roots, POST records answers + opt-in band',
};

const width = Math.max(...list.map((e) => e.path.length));
const body = list
  .map((e) => {
    const line = `${e.method.padEnd(6)} ${e.path}`;
    const note = NOTES[e.path];
    return note ? `${line.padEnd(width + 6)}(${note})` : line;
  })
  .join('\n');

const block = '```\n' + body + '\n```';

// ── Pages, and whether anything links to them ──────────────────────────────
//
// No doc listed the app's routes at all, and that let /dashboard go unreachable
// unnoticed when the nav went from eight items to six — the same state /advanced
// had been in, where the only way to open it was to type the URL. A route nobody
// can reach is either dead code or a lost feature, and both deserve to be visible.
const APP_DIR = join(root, 'src/app/app');
async function findPages(dir, base = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      out.push(...(await findPages(join(dir, entry.name), `${base}/${entry.name}`)));
    } else if (entry.name === 'page.tsx') {
      out.push(base === '' ? '/' : base);
    }
  }
  return out;
}
const pages = (await findPages(APP_DIR)).sort();

// Inbound links: the nav, plus any href in a component or page.
const linkSources = [];
for (const dir of ['src/app/components', 'src/app/app']) {
  const walk = async (d) => {
    for (const e of await readdir(join(root, d), { withFileTypes: true })) {
      if (e.isDirectory()) await walk(join(d, e.name));
      else if (e.name.endsWith('.tsx')) linkSources.push(await readFile(join(root, d, e.name), 'utf-8'));
    }
  };
  await walk(dir);
}
const allSource = linkSources.join('\n');
const pageRows = pages.map((p) => {
  if (p === '/') return { path: p, links: 1, note: 'entry — routes by profile' };
  // Plain substring matching rather than a regex: the quoting forms are a small
  // closed set, and building a pattern that survives a backtick inside a template
  // literal is more fragile than listing them.
  const QUOTES = ['"', "'", '`'];
  let links = 0;
  for (const q of QUOTES) {
    // Three forms in this codebase: href="/read", href={`/read?s=1`}, and the nav's
    // object literal `{ href: '/progress', label: … }`. Missing the third marked
    // /progress and /tutor as orphans when both are in the nav — a detector that
    // cries wolf is worse than none, so all three are matched.
    for (const open of [`href=${q}`, `href={${q}`, `href: ${q}`]) {
      let i = 0;
      for (;;) {
        i = allSource.indexOf(open + p, i);
        if (i === -1) break;
        // The next character must end the path, or this is a longer route that
        // merely starts with the same text (/read vs /reader).
        const next = allSource[i + open.length + p.length];
        if (next === undefined || '?"\'`}/&#'.includes(next)) links += 1;
        i += 1;
      }
    }
  }
  return { path: p, links, note: links === 0 ? 'ORPHAN — nothing links here' : '' };
});
const orphans = pageRows.filter((r) => r.links === 0);

// Endpoints nothing calls. Deleting /dashboard orphaned GET /api/progress/dashboard
// and the page gate said nothing, because it only looked at routes. A served
// endpoint with no caller is either dead code or a lost feature — the same argument
// that applied to the page.
const apiOrphans = list
  .filter((e) => e.path.startsWith('/api/'))
  .filter((e) => {
    // Auth and identity are called by the middleware or by curl during setup, not
    // from a component, so absence of a fetch() is expected for those.
    if (e.path.startsWith('/api/auth/')) return false;
    // Clients build parameterised URLs by interpolation —
    // `/api/progress/roots/${encodeURIComponent(root)}/known` — so the full literal
    // never appears. Match the static prefix up to the first parameter instead.
    // Stripping the parameters and matching the remainder reported seventeen
    // orphans, most of which are called: a detector that cries wolf is worse than
    // none.
    const prefix = e.path.split('/:')[0];
    return !allSource.includes(prefix);
  })
  .map((e) => `${e.method} ${e.path}`);

const pw = Math.max(...pageRows.map((r) => r.path.length));
const pagesBlock =
  '```\n' +
  pageRows
    .map((r) => `${r.path.padEnd(pw + 2)}${r.note ? `(${r.note})` : ''}`.trimEnd())
    .join('\n') +
  '\n```';

// ── README counts ──────────────────────────────────────────────────────────
//
// The status table in README.md claimed "10 routes", "36 endpoints", "7 links"
// and "9 migrations" while the real numbers were 13, 49, 6 and 18. Four numbers,
// four wrong, for the same reason the endpoint list was wrong: a human retypes
// them and nothing objects. This script already counts routes and endpoints, so
// it owns those rows now.
const README = join(root, 'README.md');
const migrationCount = (await readdir(join(root, 'workers/src/db/migrations'))).filter(
  (f) => f.endsWith('.sql')
).length;
// The suite count drifts for the same reason: README said "39 cases" twice while
// vitest was reporting 157. Counting it() and test() calls agrees with vitest's own
// total, so it is derivable rather than remembered.
let testCount = 0;
for (const f of await readdir(join(root, 'workers/test'))) {
  if (!f.endsWith('.ts')) continue;
  const src = await readFile(join(root, 'workers/test', f), 'utf-8');
  testCount += [...src.matchAll(/^\s*(?:it|test)\(/gm)].length;
}

const nav = await readFile(join(root, 'src/app/components/layout/Nav.tsx'), 'utf-8');
// The nav array only — `isActive(href: string)` and other mentions must not count.
const navCount = [...nav.matchAll(/\{\s*href:\s*'\/[^']*',\s*label:/g)].length;

const README_ROWS = [
  [/\| Frontend \(\d+ routes\) \|/, `| Frontend (${pages.length} routes) |`],
  [/\| Navigation \(\d+ links\) \|/, `| Navigation (${navCount} links) |`],
  [/\| API \(\d+ endpoints\) \|/, `| API (${list.length} endpoints) |`],
  [
    /\| Database \(D1\) \| ✅ \d+ migrations applied, seeded \|/,
    `| Database (D1) | ✅ ${migrationCount} migrations applied, seeded |`,
  ],
  [
    /\| Tests \| Vitest \(\d+ cases\)/,
    `| Tests | Vitest (${testCount} cases)`,
  ],
  [/# \d+ vitest cases/, `# ${testCount} vitest cases`],
  // The prose sentence immediately above the table repeats two of them.
  [/All \d+ API endpoints resolve, all \d+\n?pages render/, null],
];

let readme = await readFile(README, 'utf-8');
const readmeBefore = readme;
for (const [pattern, replacement] of README_ROWS) {
  if (replacement === null) continue;
  readme = readme.replace(pattern, replacement);
}
// The prose sentence wraps, so match across the newline and rewrite both numbers.
readme = readme.replace(
  /All \d+ API endpoints resolve, all \d+(\s+)pages render/,
  `All ${list.length} API endpoints resolve, all ${pages.length}$1pages render`
);

const agents = await readFile(AGENTS, 'utf-8');
const START = '## API Endpoints (Live)';
const startIdx = agents.indexOf(START);
if (startIdx === -1) {
  process.stderr.write(`✘ AGENTS.md has no "${START}" section\n`);
  process.exit(1);
}
const fenceStart = agents.indexOf('```', startIdx);
const fenceEnd = agents.indexOf('```', fenceStart + 3);
if (fenceStart === -1 || fenceEnd === -1) {
  process.stderr.write('✘ could not find the fenced endpoint block\n');
  process.exit(1);
}
let updated = agents.slice(0, fenceStart) + block + agents.slice(fenceEnd + 3);

// The Pages section sits immediately after the endpoint list. Created on first run.
const PAGES_HEADING = '## Pages (Live)';
const pagesSection =
  `${PAGES_HEADING}\n\n` +
  'Generated by `scripts/gen-api-docs.mjs`. An orphan is reachable only by typing\n' +
  'the URL, which is how `/dashboard` went unnoticed after the nav shrank.\n\n' +
  pagesBlock + '\n';
if (updated.includes(PAGES_HEADING)) {
  const pStart = updated.indexOf(PAGES_HEADING);
  const pFenceStart = updated.indexOf('```', pStart);
  const pFenceEnd = updated.indexOf('```', pFenceStart + 3);
  updated = updated.slice(0, pStart) + pagesSection + updated.slice(pFenceEnd + 4);
} else {
  const after = updated.indexOf('\n', updated.indexOf('```', fenceStart) + block.length);
  updated = updated.slice(0, after + 1) + '\n' + pagesSection + updated.slice(after + 1);
}

if (check) {
  if (readme !== readmeBefore) {
    process.stderr.write(
      '✘ README.md status table is out of date — it should read ' +
        `${pages.length} routes, ${navCount} nav links, ${list.length} endpoints, ` +
        `${migrationCount} migrations, ${testCount} tests.\n` +
        '  Run: node scripts/gen-api-docs.mjs\n'
    );
    process.exit(1);
  }
  // An endpoint with no caller is dead code or a lost feature, and this repo has now
  // had both: /api/progress/dashboard outlived the page it served, while
  // /api/tutor/history and /api/grammar/mastery were working features no screen ever
  // opened. Thirteen had accumulated silently because this only *reported* them.
  // Reaching zero is the easy part; staying there needs a red build.
  if (apiOrphans.length > 0) {
    process.stderr.write(
      `✘ ${apiOrphans.length} endpoint(s) served with no caller:\n` +
        apiOrphans.map((o) => `    ${o}\n`).join('') +
        '  Wire it to a screen, or delete it. If it is genuinely called in a way this\n' +
        '  script cannot see, add it to the exemption in scripts/gen-api-docs.mjs.\n'
    );
    process.exit(1);
  }
  if (updated !== agents) {
    const current = agents.slice(fenceStart, fenceEnd + 3);
    const currentPaths = new Set([...current.matchAll(/^\w+\s+(\/\S+)/gm)].map((m) => m[1]));
    const livePaths = new Set(list.map((e) => e.path));
    const missing = [...livePaths].filter((p) => !currentPaths.has(p));
    const phantom = [...currentPaths].filter((p) => !livePaths.has(p));
    process.stderr.write('✘ AGENTS.md endpoint list is out of date.\n');
    if (missing.length) process.stderr.write(`  live but undocumented: ${missing.join(', ')}\n`);
    if (phantom.length) process.stderr.write(`  documented but not served: ${phantom.join(', ')}\n`);
    if (orphans.length) {
      process.stderr.write(`  orphaned pages: ${orphans.map((o) => o.path).join(', ')}\n`);
    }
    if (apiOrphans.length) {
      process.stderr.write(`  endpoints nothing calls: ${apiOrphans.join(', ')}\n`);
    }
    process.stderr.write('  Run: node scripts/gen-api-docs.mjs\n');
    process.exit(1);
  }
  process.stdout.write(
    `✅ AGENTS.md documents ${list.length} endpoints and ${pages.length} pages; ` +
      `README counts agree (${navCount} nav links, ${migrationCount} migrations)` +
      (orphans.length ? ` (${orphans.length} orphaned page: ${orphans.map((o) => o.path).join(', ')})` : '') +
      (apiOrphans.length ? ` (${apiOrphans.length} uncalled: ${apiOrphans.join(', ')})` : '') +
      '\n'
  );
  process.exit(0);
}

await writeFile(AGENTS, updated, 'utf-8');
if (readme !== readmeBefore) await writeFile(README, readme, 'utf-8');
process.stdout.write(
  `wrote ${list.length} endpoints and ${pages.length} pages into AGENTS.md\n` +
    `  README: ${pages.length} routes, ${navCount} nav links, ${list.length} endpoints, ` +
    `${migrationCount} migrations, ${testCount} tests\n`
);
if (orphans.length) {
  process.stdout.write(`  orphaned pages: ${orphans.map((o) => o.path).join(', ')}\n`);
}
if (apiOrphans.length) {
  process.stdout.write(`  endpoints nothing calls: ${apiOrphans.join(', ')}\n`);
}
