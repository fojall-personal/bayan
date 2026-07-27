#!/usr/bin/env node
/**
 * Ingest word-level recitation timings from cpfair/quran-align.
 *
 *   node scripts/ingest-timings.mjs            # emit SQL on stdout
 *   node scripts/ingest-timings.mjs --verify   # assert the source only
 *
 * ── Source ──────────────────────────────────────────────────────────────────
 *
 * https://github.com/cpfair/quran-align — word-accurate timestamps produced by forced
 * alignment, CC-BY 4.0. The release archive carries twelve reciters; two of them match
 * this app's everyayah.com paths exactly, which is the only reason this works: timings
 * belong to a recording, and a different encode is a different recording.
 *
 * Husary is deliberately skipped. quran-align has Husary at 64kbps; the app plays
 * 128kbps. Those may well be the same master, but "may well be" is not a basis for
 * highlighting a word — being told the wrong word is sounding is worse than no
 * highlight at all — so that reciter gets none until someone verifies it.
 *
 * ── Why the SHA is pinned ───────────────────────────────────────────────────
 *
 * Same reason as ingest-quran.mjs and ingest-translation.mjs: this is scripture-
 * adjacent data fetched over the network, and a silently changed file would put the
 * highlight on the wrong word across the whole app with nothing to notice it. The
 * digest below is of the release zip as downloaded on 2026-07-27.
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(root, 'data/quran-align');
const ZIP = join(root, 'data/quran-align.zip');

const PINNED_SHA256 =
  '5eeb045d8a7895208c94d2d7ec243567f8f550728835411527c4ffa1e789c9b7';

/**
 * Reciter path (as used by everyayah.com and by src/app/lib/ayah-audio.ts) → the
 * filename inside the archive. The key IS the audio path, so a mismatch between the
 * timings and the audio the app plays is impossible by construction.
 */
const RECITERS = {
  Alafasy_128kbps: 'Alafasy_128kbps.json',
  Minshawy_Murattal_128kbps: 'Minshawy_Murattal_128kbps.json',
};

const EXPECTED_AYAHS = 6236;

const fail = (msg) => {
  process.stderr.write(`✘ ${msg}\n`);
  process.exit(1);
};

// ── Verify the archive ──────────────────────────────────────────────────────
let zipBytes;
try {
  zipBytes = await readFile(ZIP);
} catch {
  fail(
    `${ZIP} is missing. Download it first:\n` +
      '  curl -sL -o data/quran-align.zip \\\n' +
      '    https://github.com/cpfair/quran-align/releases/download/release-2016-11-24/quran-align-data-2016-11-24.zip\n' +
      '  unzip -o -q data/quran-align.zip -d data/quran-align'
  );
}
const actual = createHash('sha256').update(zipBytes).digest('hex');
if (actual !== PINNED_SHA256) {
  fail(
    'quran-align archive does not match the pinned digest.\n' +
      `  expected ${PINNED_SHA256}\n  actual   ${actual}\n` +
      '  Refusing to ingest: a changed alignment would move the highlight onto the\n' +
      '  wrong word everywhere, and nothing downstream would notice.'
  );
}

const files = await readdir(DATA).catch(() =>
  fail(`${DATA} is missing — unzip the archive into it (see the message above)`)
);

const out = [];
const summary = [];

for (const [reciter, filename] of Object.entries(RECITERS)) {
  if (!files.includes(filename)) fail(`${filename} not present in ${DATA}`);
  const entries = JSON.parse(await readFile(join(DATA, filename), 'utf-8'));

  if (!Array.isArray(entries) || entries.length !== EXPECTED_AYAHS) {
    fail(
      `${filename}: expected ${EXPECTED_AYAHS} ayah entries, found ${
        Array.isArray(entries) ? entries.length : typeof entries
      }`
    );
  }

  let rows = 0;
  let widest = 0;
  for (const e of entries) {
    if (!Number.isInteger(e.surah) || !Number.isInteger(e.ayah)) {
      fail(`${filename}: an entry has no surah/ayah`);
    }
    for (const seg of e.segments ?? []) {
      // [word_start_index, word_end_index, start_ms, end_ms], 0-based, end exclusive.
      const [from, to, startMs, endMs] = seg;
      if (![from, to, startMs, endMs].every(Number.isInteger)) continue;
      if (endMs <= startMs) continue; // a zero-width segment cannot be highlighted
      widest = Math.max(widest, to - from);
      // A segment may span more than one word; every word it covers gets the span.
      // Better a shared highlight than a gap where a word lights up as silence.
      for (let w = from; w < Math.max(to, from + 1); w += 1) {
        out.push(
          `INSERT OR REPLACE INTO quran_word_timing ` +
            `(reciter, surah_id, ayah_id, word_index, start_ms, end_ms) VALUES ` +
            `('${reciter}', ${e.surah}, ${e.ayah}, ${w + 1}, ${startMs}, ${endMs});`
        );
        rows += 1;
      }
    }
  }

  if (rows < 50_000) {
    fail(`${filename}: only ${rows} word timings — expected tens of thousands`);
  }
  summary.push(`${reciter}: ${rows.toLocaleString()} rows, widest span ${widest} words`);
}

// ── Spot-checks against the text, before emitting anything ──────────────────
//
// 1:1 is the basmala: four words. If the alignment disagrees about that, the
// word_index convention is wrong and every highlight after it would be off by one.
const alafasy = JSON.parse(await readFile(join(DATA, RECITERS.Alafasy_128kbps), 'utf-8'));
const basmala = alafasy.find((e) => e.surah === 1 && e.ayah === 1);
if (!basmala || basmala.segments.length !== 4) {
  fail(
    `1:1 should align to 4 words (the basmala); found ${
      basmala ? basmala.segments.length : 'no entry'
    }`
  );
}
if (basmala.segments[0][2] < 0) fail('1:1 starts at a negative timestamp');

if (process.argv.includes('--verify')) {
  process.stderr.write(`✅ quran-align verified\n${summary.map((s) => `   ${s}\n`).join('')}`);
  process.exit(0);
}

process.stdout.write(
  '-- Word timings from cpfair/quran-align (CC-BY 4.0).\n' +
    '-- Generated by scripts/ingest-timings.mjs — do not edit by hand.\n' +
    `-- Source digest: ${PINNED_SHA256}\n` +
    out.join('\n') +
    '\n'
);
process.stderr.write(`${summary.map((s) => `   ${s}\n`).join('')}`);
