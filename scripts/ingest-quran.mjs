#!/usr/bin/env node
/**
 * Ingest the Quran text + tajweed annotations into the `quran_verses` table.
 *
 * Emits SQL on stdout:
 *
 *   node scripts/ingest-quran.mjs --text path/to/quran-uthmani.txt > /tmp/quran.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --local  --file=/tmp/quran.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --remote --file=/tmp/quran.sql
 *
 * ── The alignment gate ──────────────────────────────────────────────────────
 *
 * Tajweed annotations are (rule, start, end) offsets in Unicode CODEPOINTS,
 * relative to each ayah. They are only valid against the exact text they were
 * generated from: the Tanzil Uthmani file as of ca. 6 Apr 2017, pinned at
 *   https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt
 * Tanzil's encoding has changed since. A different copy does not fail loudly —
 * it silently colours the wrong letters.
 *
 * So this script refuses to emit anything until the offsets demonstrably land on
 * the right characters. It checks the five rules whose target letter is
 * determined by definition (hamzat wasl on an alef, lam shamsiyyah on a lam,
 * ghunnah on noon or meem, iqlab on noon or a tanween mark, qalqalah on one of
 * ق ط ب ج د) and requires MIN_ALIGNMENT. This is not a formality: a substitute
 * text from risan/quran-json scored 82.3%, i.e. about one mark in six would have
 * been attached to the wrong letter. Measured against the pinned text the gate
 * scores 100.00% (25,327 checks) and still rejects that substitute at 82.30%.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const TAJWEED_URL =
  'https://raw.githubusercontent.com/cpfair/quran-tajweed/master/output/tajweed.hafs.uthmani-pause-sajdah.json';

/** Below this, refuse to emit. 0.995 leaves room for genuine edge cases only. */
const MIN_ALIGNMENT = 0.995;

/**
 * SHA-256 of the pinned Tanzil Uthmani file.
 *
 * The alignment gate is the real defence, but it is statistical: it samples the
 * five rules whose target letter is fixed by definition. This is exact. A text
 * that differs at all is rejected before any offset is examined, which turns
 * "swapped file" from a 60,057-annotation misalignment risk (plan risk R5) into
 * a one-line failure.
 *
 * Override with --allow-unpinned when deliberately testing another text.
 */
const PINNED_SHA256 =
  'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';

/** Letters each rule must, by definition, sit on or beside. */
const EXPECTED_LETTERS = {
  hamzat_wasl: new Set(['ٱ', 'ا']), // ٱ ا
  lam_shamsiyyah: new Set(['ل']), // ل
  ghunnah: new Set(['ن', 'م']), // ن م
  // Iqlab triggers on noon saakin OR tanween followed by ب. Tanween is written
  // as a diacritic on the carrying letter rather than as the letter ن, so the
  // three tanween marks belong here: without them the gate scored the PINNED
  // text at 99.07% and refused it, because 236 of 562 iqlab annotations
  // legitimately start on ً ٌ ٍ. Every one of the 562 has a ب within four
  // codepoints, which is the rule's defining condition.
  iqlab: new Set(['ن', 'م', 'ً', 'ٌ', 'ٍ']), // ن م + fathatan/dammatan/kasratan
  qalqalah: new Set(['ق', 'ط', 'ب', 'ج', 'د']), // ق ط ب ج د
};

const args = process.argv.slice(2);
const textPath = args[args.indexOf('--text') + 1];
const tajweedPath = args.includes('--tajweed')
  ? args[args.indexOf('--tajweed') + 1]
  : null;
const force = args.includes('--force');
const allowUnpinned = args.includes('--allow-unpinned');

const log = (m) => process.stderr.write(m + '\n');

if (!textPath || textPath.startsWith('--')) {
  log('usage: node scripts/ingest-quran.mjs --text <quran-uthmani.txt> [--tajweed <tajweed.json>] [--force]');
  log('');
  log('  --text     the PINNED Tanzil Uthmani file (see the comment at the top');
  log('             of this script for the exact URL — a different copy will');
  log('             fail the alignment gate)');
  log('  --tajweed  local annotations file; downloaded if omitted');
  log('  --force    emit even if alignment is below the threshold (do not)');
  process.exit(1);
}

/** Tanzil "text with aya numbers": `surah|ayah|text` per line. */
function parseTanzil(raw) {
  const verses = new Map();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split('|');
    if (parts.length < 3) continue;
    const surah = Number(parts[0]);
    const ayah = Number(parts[1]);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah)) continue;
    verses.set(`${surah}:${ayah}`, parts.slice(2).join('|').trim());
  }
  return verses;
}

/** Strip diacritics for a searchable/simple column. */
function toSimple(text) {
  return text
    .normalize('NFC')
    .replace(/[ً-ْٰـۖ-ࣰۭ-ࣳ]/g, '')
    .replace(/ٱ/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkAlignment(verses, annotated) {
  let aligned = 0;
  let checked = 0;
  let outOfRange = 0;
  const samples = [];

  for (const entry of annotated) {
    const text = verses.get(`${entry.surah}:${entry.ayah}`);
    if (text === undefined) continue;
    const cps = [...text];
    for (const a of entry.annotations) {
      const expected = EXPECTED_LETTERS[a.rule];
      if (!expected) continue;
      checked++;
      if (a.start >= cps.length) {
        outOfRange++;
        continue;
      }
      // Allow +/-1: some annotations legitimately begin on a diacritic that
      // belongs to the target letter.
      const window = cps.slice(Math.max(0, a.start - 1), a.start + 2);
      if (window.some((c) => expected.has(c))) aligned++;
      else if (samples.length < 5) {
        samples.push(
          `${entry.surah}:${entry.ayah} ${a.rule} @${a.start} -> ${JSON.stringify(cps[a.start])}`
        );
      }
    }
  }
  return { aligned, checked, outOfRange, samples, ratio: checked ? aligned / checked : 0 };
}

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

async function main() {
  const raw = await readFile(textPath, 'utf-8');
  const sha = createHash('sha256').update(raw).digest('hex');
  const verses = parseTanzil(raw);
  log(`text:    ${verses.size} verses parsed from ${textPath}`);
  log(`         sha256 ${sha}`);

  if (sha !== PINNED_SHA256 && !allowUnpinned) {
    log('');
    log('REFUSING TO EMIT — this is not the pinned text.');
    log(`  expected ${PINNED_SHA256}`);
    log(`  got      ${sha}`);
    log('');
    log('Tajweed offsets are only valid against the exact file they were');
    log('generated from. Download it from the URL at the top of this script,');
    log('or pass --allow-unpinned if you are deliberately testing another copy.');
    process.exit(3);
  }
  if (sha !== PINNED_SHA256) {
    log('--allow-unpinned given: checksum mismatch ignored. The alignment gate');
    log('is now the only thing standing between you and mis-coloured tajweed.');
  }
  if (verses.size !== 6236) {
    log(`WARNING: expected 6236 verses, got ${verses.size} — is this the "text with aya numbers" format?`);
  }

  let annotated;
  if (tajweedPath) {
    annotated = JSON.parse(await readFile(tajweedPath, 'utf-8'));
  } else {
    log(`tajweed: downloading ${TAJWEED_URL}`);
    const res = await fetch(TAJWEED_URL);
    if (!res.ok) throw new Error(`tajweed download failed: ${res.status}`);
    annotated = await res.json();
  }
  const annCount = annotated.reduce((n, e) => n + e.annotations.length, 0);
  log(`tajweed: ${annotated.length} ayahs, ${annCount} annotations`);

  const a = checkAlignment(verses, annotated);
  log('');
  log(`alignment gate: ${a.aligned}/${a.checked} = ${(a.ratio * 100).toFixed(2)}% (threshold ${(MIN_ALIGNMENT * 100).toFixed(1)}%)`);
  if (a.outOfRange) log(`                ${a.outOfRange} offsets past end of ayah`);
  for (const s of a.samples) log(`                misaligned: ${s}`);

  if (a.ratio < MIN_ALIGNMENT && !force) {
    log('');
    log('REFUSING TO EMIT. The offsets do not line up with this text, which means');
    log('tajweed colouring would be attached to the wrong letters. Use the pinned');
    log('Apr-2017 Tanzil file named at the top of this script.');
    process.exit(2);
  }
  if (a.ratio < MIN_ALIGNMENT) {
    log('--force given: emitting despite misalignment. Colouring will be wrong.');
  }

  const byKey = new Map(annotated.map((e) => [`${e.surah}:${e.ayah}`, e.annotations]));
  const out = [
    '-- Generated by scripts/ingest-quran.mjs — do not edit by hand.',
    `-- source text sha256: ${sha}`,
    `-- alignment: ${(a.ratio * 100).toFixed(2)}%`,
    'DELETE FROM quran_verses;',
  ];

  for (const [key, text] of verses) {
    const [surah, ayah] = key.split(':').map(Number);
    const tags = byKey.get(key) ?? [];
    out.push(
      `INSERT INTO quran_verses (surah, ayah, text_uthmani, text_simple, tajweed_tags) VALUES (` +
        `${surah}, ${ayah}, ${q(text)}, ${q(toSimple(text))}, ${q(JSON.stringify(tags))});`
    );
  }

  process.stdout.write(out.join('\n') + '\n');
  log('');
  log(`emitted ${verses.size} INSERT statements`);
}

main().catch((err) => {
  log(String(err.stack || err));
  process.exit(1);
});
