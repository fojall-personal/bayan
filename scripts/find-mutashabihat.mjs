#!/usr/bin/env node
/**
 * Detect near-duplicate (mutashabihat) ayah pairs — verses that differ by only a
 * word or two, the classic hifz confusion. Auto-derived from the pinned Uthmani
 * text; nothing here is hand-authored.
 *
 *   node scripts/find-mutashabihat.mjs > /tmp/mutashabihat-pairs.json
 *
 * Writes to stdout, same convention as gen-syntax-exercises.mjs's own
 * `> /tmp/syntax.sql` — data/ is gitignored wholesale (checked directly:
 * `git check-ignore data/mutashabihat-pairs.json` matched before this was fixed),
 * so a file written there is exactly as transient as data/quran-uthmani.txt
 * itself, regenerated from the pinned corpus rather than committed. Task 6 (the
 * exercise generator that consumes this) redirects to wherever it needs the file.
 *
 * ── Method ────────────────────────────────────────────────────────────────────
 *
 * Normalize every ayah (strip diacritics, fold alef variants — same rule
 * workers/src/lib/tutor-grounding.ts uses; reimplemented here rather than
 * imported because scripts/ runs on plain node with no access to that TS module,
 * and because this repo has already had one real bug from an inline Arabic regex
 * character class, so the codepoint-arithmetic version is copied verbatim rather
 * than re-derived by hand).
 *
 * Bucket by normalized word count (±1) before comparing — 6,236 ayahs is 19M+
 * unordered pairs at O(n²), which a naive full scan would still finish, but
 * bucketing cuts the real comparison count by roughly two orders of magnitude and
 * the script logs exactly how many pairs it actually compared, so that number is
 * checkable rather than asserted.
 *
 * A pair is mutashabih if character-level edit distance is <=15% of the SHORTER
 * ayah's normalized length, and the two are not identical. Identical ayahs (Ar-
 * Rahman's refrain, repeated dozens of times) are a different phenomenon — refrain
 * repetition, not the one-word-different confusion this drill targets — and are
 * explicitly excluded, not just an accidental distance-0 filter.
 *
 * The 15% threshold is a starting point to validate against a manual sample, not
 * asserted as correct. See the commit message for the false-positive rate actually
 * observed on inspection.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

// Same file, same pin, as gen-syntax-exercises.mjs — one pinned copy of the truth.
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';

const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
const actualSha = createHash('sha256').update(textRaw).digest('hex');
if (actualSha !== TEXT_SHA) {
  log(`✘ data/quran-uthmani.txt does not match the pinned SHA — refusing to run.`);
  log(`  expected ${TEXT_SHA}\n  got      ${actualSha}`);
  process.exit(1);
}

// ── normaliseArabic, ported verbatim from workers/src/lib/tutor-grounding.ts ──
const DIACRITIC_RANGES = [
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x06d6, 0x06ed],
];
const FOLD = {
  'ٱ': 'ا',
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ى': 'ي',
};
function normaliseArabic(input) {
  let out = '';
  for (const ch of input ?? '') {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0670 || cp === 0x0640) continue; // dagger alef, tatweel
    if (DIACRITIC_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) continue;
    out += FOLD[ch] ?? ch;
  }
  return out.replace(/ا+/g, 'ا').trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// ── Parse + normalize ──────────────────────────────────────────────────────────
// Minimum real word count. Below this, short disconnected-letter openers (الٓمٓ,
// الٓمٓصٓ...) trivially "near-match" each other by sheer brevity.
const MIN_WORDS = 4;

// A surah's first ayah is, in this text's own convention, prefixed with the
// basmalah ("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ") for every surah but one — so
// raising MIN_WORDS alone was not enough: "بسملة + short opener" pairs (e.g. 7:1
// vs 19:1, differing only in which disconnected letters or short theme-word
// follows) still cleared the threshold on brevity, not real similarity. Excluded
// outright, checked directly against this run's own output (5 such pairs sat at
// the very top of the tail before this filter, all sharing that exact shape).
// Real cost, stated rather than hidden: this also drops any genuine mutashabihat
// pair that happens to involve a surah's own first ayah — a real but small loss,
// preferred over a detector that mislabels basmalah-prefix brevity as confusable
// recitation.
const ayat = textRaw
  .trim()
  .split('\n')
  .map((line) => {
    const [surah, ayah, text] = line.split('|');
    const norm = normaliseArabic(text);
    return {
      surah: Number(surah),
      ayah: Number(ayah),
      text,
      norm,
      wordCount: norm.split(/\s+/).filter(Boolean).length,
    };
  })
  .filter((a) => a.wordCount >= MIN_WORDS && a.ayah !== 1);

log(`parsed ${ayat.length} ayahs with >=${MIN_WORDS} words, excluding surah-opening ayahs`);

// ── Bucket by word count (±1) ───────────────────────────────────────────────────
const byCount = new Map();
for (const a of ayat) {
  if (!byCount.has(a.wordCount)) byCount.set(a.wordCount, []);
  byCount.get(a.wordCount).push(a);
}

const THRESHOLD_PCT = 0.15;
const pairs = [];
let compared = 0;

const counts = [...byCount.keys()].sort((x, y) => x - y);
for (const count of counts) {
  // Compare within this bucket and against the adjacent one (±1 word), each pair
  // visited once: adjacent-bucket comparisons happen when processing the LOWER
  // count, against the bucket for count+1.
  const bucket = byCount.get(count);
  const neighbour = byCount.get(count + 1) ?? [];
  const candidates = [
    ...bucket.flatMap((a, i) => bucket.slice(i + 1).map((b) => [a, b])),
    ...bucket.flatMap((a) => neighbour.map((b) => [a, b])),
  ];
  for (const [a, b] of candidates) {
    compared++;
    if (a.norm === b.norm) continue; // refrain repetition, not this drill's target
    const dist = levenshtein(a.norm, b.norm);
    const shorter = Math.min(a.norm.length, b.norm.length);
    if (shorter === 0) continue;
    const pct = dist / shorter;
    if (pct <= THRESHOLD_PCT) {
      pairs.push({
        a: { surah: a.surah, ayah: a.ayah, text: a.text },
        b: { surah: b.surah, ayah: b.ayah, text: b.text },
        editDistance: dist,
        pct: Math.round(pct * 1000) / 1000,
      });
    }
  }
}

pairs.sort((x, y) => x.pct - y.pct);

log(`compared ${compared.toLocaleString('en-US')} candidate pairs across ${counts.length} word-count buckets`);
log(`found ${pairs.length} mutashabihat pairs at <=${THRESHOLD_PCT * 100}% edit distance`);

process.stdout.write(
  JSON.stringify(
    {
      _comment:
        'GENERATED by scripts/find-mutashabihat.mjs from the pinned Uthmani text. ' +
        'Do not hand-edit; redirect stdout to regenerate.',
      thresholdPct: THRESHOLD_PCT,
      pairCount: pairs.length,
      pairs,
    },
    null,
    2
  ) + '\n'
);
