#!/usr/bin/env node
/**
 * The Arabic Rhetorical Device Taxonomy, as a device registry.
 *
 *   node scripts/ingest-ardt.mjs           # write content/grammar/ardt-devices.json
 *   node scripts/ingest-ardt.mjs --check   # fail if that file is out of date
 *
 * Source: Arabic Rhetorical Device Taxonomy v0.1.1, Encyclopedia of Arabic Rhetoric,
 *   github.com/Al-Balagha/Arabic-Rhetoric — CC BY 4.0.
 *
 * ── Why a taxonomy is worth ingesting when it contains no Quranic data ──────
 *
 * It contains no verse annotations, so it cannot produce a single exercise. What it
 * supplies is the one thing this project otherwise has to invent: the NAME of a device,
 * its place in the classical three-branch scheme, and a citable URL for each.
 *
 * That matters because balagha terminology is where a confident guess is most likely and
 * least visible. Calling a fronted object تقديم is right; calling it قصر would be wrong in
 * a way no gate here could catch, because it is a claim about a naming convention rather
 * than about the text. Taking the name from a published, versioned, CC-BY taxonomy removes
 * the guess: every device Bayan names now resolves to a device somebody else defined.
 *
 * It also bounds what may be claimed. check-balagha.mjs will not accept an example whose
 * device is absent from this file, so a lesson cannot quietly introduce a device that no
 * authority recognises.
 *
 * Parsed from taxonomy-index.md rather than the JSON exports, deliberately. The JSON is
 * Wikibase format — one file per device, 130 of them, where a label is three levels deep
 * and the hierarchy is expressed as property claims between Q-numbers. The index carries
 * the same names, the same domains and a stable URL per device in one file, and the parse
 * is checkable by eye. The JSON is the better source for a knowledge graph; this is the
 * better source for a device list.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const OUT = join(root, 'content/grammar/ardt-devices.json');
const SRC = join(root, 'data/ardt-taxonomy-index.md');
const log = (m) => process.stderr.write(m + '\n');

/** v0.1.1, released 20 November 2025. */
const SOURCE_SHA = '176c7f8ac708a0f809d61ae24aef13c09563baf84efcfbd95b8c68de92afdcbf';

/**
 * --check without the source still checks what it can.
 *
 * data/ is gitignored, so CI has no taxonomy file. Adding a gate that needs one would be
 * the mistake gen-root-lessons.mjs already made and paid two red builds for. Without the
 * source, the committed registry is checked for structure and for the devices this repo
 * actually cites; the re-parse is skipped and said to be skipped.
 */
let source = null;
try {
  source = await readFile(SRC, 'utf-8');
} catch {
  if (!check) {
    log(`✘ ${SRC} is missing. Fetch taxonomy-index.md from github.com/Al-Balagha/Arabic-Rhetoric.`);
    process.exit(1);
  }
}

if (source) {
  const got = createHash('sha256').update(source).digest('hex');
  if (got !== SOURCE_SHA) {
    log(`REFUSING: taxonomy checksum mismatch\n  expected ${SOURCE_SHA}\n  got      ${got}`);
    process.exit(3);
  }
}

/**
 * Devices Bayan itself names, and which ARDT device each maps to.
 *
 * Asserted rather than assumed. `fronting` and the Parse lens's حذف block were built
 * before this registry existed, using names taken from grammar textbooks — so the point of
 * this list is to force those names to resolve against a published taxonomy, and to fail
 * if a future ARDT release renumbers them.
 */
const CITED_BY_BAYAN = {
  'A-12': 'fronting — the exercise kind',
  'A-14': 'ellipsis — the حذف block in the Parse lens',
  'CA-1': 'jinas — the exercise kind',
};

function parse(md) {
  const devices = [];
  let domain = null;
  let subdomain = null;
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const dom = /^####\s*<a name="[^"]*">.*Domain ([A-D]):\s*([^(]+)\(([^)]*)\)/.exec(line);
    if (dom) {
      domain = { code: dom[1], name: dom[2].trim(), arabic: dom[3].trim() };
      subdomain = null;
      continue;
    }
    const sub = /^#####\s*.*Subdomain ([A-Z]+):\s*(.+?)\s*\(\d+ devices\)/.exec(line);
    if (sub) {
      subdomain = { code: sub[1], name: sub[2].trim() };
      continue;
    }
    // `* Device CA-1: Paronomasia (*al-jinās / al-tajnīs*)`
    //
    // The transliteration is taken as everything inside the final parentheses, with the
    // markdown emphasis stripped afterwards — NOT by matching `(*…*)`.
    //
    // That first, tighter pattern silently dropped two of the 95 devices, because the
    // asterisks do not reliably wrap the whole transliteration when a hamza apostrophe
    // sits next to one: A-7 reads `(*al-nidā*’)` with the closing asterisk before the
    // hamza, and CD-2 reads `(’*uslūb al-ḥakīm*)` with an opening hamza before it. Both
    // parse now, and the count assertion below is what surfaced them.
    const dev = /^\*\s*Device ([A-D][A-Z]?-\d+[a-z]?):\s*(.+?)\s*\(([^)]+)\)\s*$/.exec(line);
    if (!dev) continue;
    // The web link sits within the next few lines. Taken from the file rather than built
    // from the device name, because the URLs are percent-encoded and hand-titled.
    let url = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j += 1) {
      const m = /^🌐 \[Web\]\((https?:\/\/[^)]+)\)/.exec(lines[j]);
      if (m) {
        url = m[1];
        break;
      }
    }
    devices.push({
      code: dev[1],
      name: dev[2].trim(),
      transliteration: dev[3].replace(/\*/g, '').trim(),
      domain: domain?.code ?? null,
      domainName: domain?.name ?? null,
      subdomain: subdomain?.code ?? null,
      subdomainName: subdomain?.name ?? null,
      url,
    });
  }
  return devices;
}

/**
 * How many devices the taxonomy says it has.
 *
 * Every section header states its own count — "(3 devices)", "(11 devices)" — and they sum
 * to 95. Reading that instead of hardcoding a number means the file audits its own parse:
 * a device the regex cannot read shows up as a shortfall rather than as a silently smaller
 * registry, which is exactly how A-7 and CD-2 were found.
 */
function declaredCount(md) {
  return [...md.matchAll(/\((\d+) devices\)/g)].reduce((n, m) => n + Number(m[1]), 0);
}

function validate(devices, expected) {
  const problems = [];
  if (expected && devices.length !== expected) {
    problems.push(
      `parsed ${devices.length} devices, but the taxonomy's own section counts sum to ` +
        `${expected} — some device lines are not being read`
    );
  }
  const codes = new Set();
  for (const d of devices) {
    if (codes.has(d.code)) problems.push(`duplicate device code ${d.code}`);
    codes.add(d.code);
    if (!d.url) problems.push(`${d.code} has no source URL, so it cannot be cited`);
    if (!d.domain) problems.push(`${d.code} sits under no domain`);
    if (!d.transliteration) problems.push(`${d.code} has no Arabic name`);
  }
  for (const [code, why] of Object.entries(CITED_BY_BAYAN)) {
    if (!codes.has(code)) {
      problems.push(`${code} is absent, but this repo cites it: ${why}`);
    }
  }
  return problems;
}

if (check) {
  let committed;
  try {
    committed = JSON.parse(await readFile(OUT, 'utf-8'));
  } catch {
    log('✘ content/grammar/ardt-devices.json is missing. Run: node scripts/ingest-ardt.mjs');
    process.exit(1);
  }
  const problems = validate(committed.devices ?? [], source ? declaredCount(source) : null);
  if (problems.length > 0) {
    log(`✘ ${problems.length} problem(s) in the committed device registry:`);
    for (const p of problems.slice(0, 10)) log(`    ${p}`);
    process.exit(1);
  }
  if (!source) {
    log(
      `✅ ${committed.devices.length} ARDT devices are structurally sound and all ` +
        `${Object.keys(CITED_BY_BAYAN).length} devices this repo cites are present. ` +
        'Re-parse skipped: no taxonomy source, which is expected in CI.'
    );
    process.exit(0);
  }
  const fresh = parse(source);
  if (JSON.stringify(fresh) !== JSON.stringify(committed.devices)) {
    log('✘ ardt-devices.json disagrees with a fresh parse of the taxonomy.');
    log('  Run: node scripts/ingest-ardt.mjs');
    process.exit(1);
  }
  log(`✅ ${fresh.length} ARDT devices match a fresh parse of the pinned taxonomy`);
  process.exit(0);
}

const devices = parse(source);
const problems = validate(devices, declaredCount(source));
if (problems.length > 0) {
  log(`REFUSING: ${problems.length} problem(s):`);
  for (const p of problems.slice(0, 10)) log(`    ${p}`);
  process.exit(3);
}

const byDomain = {};
for (const d of devices) byDomain[d.domain] = (byDomain[d.domain] ?? 0) + 1;

await writeFile(
  OUT,
  JSON.stringify(
    {
      _comment:
        'GENERATED by scripts/ingest-ardt.mjs from the Arabic Rhetorical Device Taxonomy ' +
        'v0.1.1 (Encyclopedia of Arabic Rhetoric, CC BY 4.0). Do not hand-edit. This is a ' +
        'device VOCABULARY — it carries no Quranic annotation and produces no exercises.',
      source: 'https://github.com/Al-Balagha/Arabic-Rhetoric/tree/v0.1.1',
      licence: 'CC BY 4.0',
      version: '0.1.1',
      devices,
    },
    null,
    2
  ) + '\n',
  'utf-8'
);
log(`wrote content/grammar/ardt-devices.json — ${devices.length} devices ${JSON.stringify(byDomain)}`);
