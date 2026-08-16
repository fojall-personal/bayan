#!/usr/bin/env node
/**
 * Mutashabihat discrimination: two near-identical ayahs, which is the real one here?
 *
 *   node scripts/find-mutashabihat.mjs | node scripts/gen-mutashabihat-exercises.mjs > /tmp/mutashabihat.sql
 *   node scripts/find-mutashabihat.mjs | node scripts/gen-mutashabihat-exercises.mjs --check
 *
 * Reads the pairs JSON from stdin rather than recomputing detection inline —
 * find-mutashabihat.mjs's own 2M-comparison pass is a real, separate cost, and
 * piping keeps the two scripts independently testable (same "separate on
 * purpose" reasoning gen-syntax-exercises.mjs gives for splitting off from
 * gen-derived-content.mjs).
 *
 * ── Why "which is real" rather than "what's the differing word" ─────────────
 *
 * The more targeted drill (highlight the single differing word, ask what it is)
 * needs a reliable word-level alignment between the two ayahs — insertions and
 * deletions shift every position after them, and a buggy alignment would show
 * the WRONG word as "the difference": a factual error about a specific ayah,
 * not a UX rough edge. "Which of these two full texts is the real one at
 * surah:ayah" needs no alignment at all — the answer is simply whichever
 * candidate is the corpus's own stored text at that exact location, which is
 * checkable by construction. Simpler and cannot be wrong in that specific way.
 *
 * Two items per pair (asking about each side in turn), since each direction is
 * a genuinely distinct, valid question — a learner may know one ayah cold and
 * confuse it FOR the other without the reverse being true.
 */

const log = (m) => process.stderr.write(m + '\n');
const CHECK = process.argv.includes('--check');

// ── Read pairs from stdin ────────────────────────────────────────────────────
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
if (!raw.trim()) {
  log('REFUSING: no input on stdin. Pipe find-mutashabihat.mjs into this script.');
  process.exit(3);
}
let input;
try {
  input = JSON.parse(raw);
} catch {
  log('REFUSING: stdin was not valid JSON.');
  process.exit(3);
}
const pairs = input.pairs ?? [];
if (pairs.length === 0) {
  log('REFUSING: zero pairs in input — the detector found nothing or was not run.');
  process.exit(3);
}
log(`read ${pairs.length} candidate pairs`);

/**
 * 32-bit avalanche mix (splitmix32 finalizer), same as gen-homograph-exercises.mjs.
 * Low bits of a linear seed are not random on their own; a real shuffle needs this,
 * not `(seed * n) % k`, which biased homograph's answer position until it was fixed.
 */
function mix32(n) {
  let x = n >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}

/** Difficulty from how close the pair is — closer text is a harder discrimination. */
function levelFor(pct) {
  if (pct <= 0.03) return 5;
  if (pct <= 0.06) return 4;
  if (pct <= 0.1) return 3;
  return 2;
}

// ── Build two items per pair, one per direction ──────────────────────────────
const targetCounter = new Map(); // "surah:ayah" -> how many items already target it
const items = [];

function cleanText(s) {
  return String(s ?? '').replace(/\r/g, '');
}

function buildItem(target, other, pct) {
  const key = `${target.surah}:${target.ayah}`;
  const n = (targetCounter.get(key) ?? 0) + 1;
  targetCounter.set(key, n);

  const targetText = cleanText(target.text);
  const otherText = cleanText(other.text);
  const firstWord = targetText.trim().split(/\s+/)[0] ?? targetText;

  // Deterministic shuffle of the two options, keyed on the item's own location —
  // same reasoning as homograph: random ordering breaks --check reproducibility,
  // and a fixed order would teach position instead of recognition.
  const seed = target.surah * 1000003 + target.ayah * 1009 + other.surah * 97 + other.ayah;
  const swap = mix32(seed) % 2 === 1;
  const options = swap ? [otherText, targetText] : [targetText, otherText];

  items.push({
    id: `mutashabihat-${target.surah}-${target.ayah}-${other.surah}-${other.ayah}`,
    kind: 'mutashabihat',
    level: levelFor(pct),
    wordArabic: firstWord,
    prompt:
      `Which of these is the real text of ${target.surah}:${target.ayah}? ` +
      `The other is from a very similar ayah elsewhere in the Quran.`,
    answer: targetText,
    options,
    explanation:
      `${target.surah}:${target.ayah} reads: ${targetText}\n` +
      `The confusable text is ${other.surah}:${other.ayah}: ${otherText}`,
    surah: target.surah,
    ayah: target.ayah,
    // No single word is "the point" here — segment_index carries a per-target
    // counter instead, since the schema's UNIQUE(kind, surah_id, ayah_id,
    // word_index, segment_index) needs a real differentiator for the rare ayah
    // that is confusable with more than one other.
    word: 1,
    seg: n,
  });
}

for (const p of pairs) {
  buildItem(p.a, p.b, p.pct);
  buildItem(p.b, p.a, p.pct);
}

// ── Self-checks. A defect here means emitting nothing. ───────────────────────
/**
 * Codepoint arithmetic, not a regex character class — this repo has already had a
 * real bug from an inline Arabic regex character class (it once swallowed the
 * letters themselves), so detection here uses the same discipline
 * normaliseArabic() does: compare codePointAt() against numeric bounds directly.
 */
function hasArabicLetter(s) {
  for (const ch of s ?? '') {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06ff) return true;
  }
  return false;
}

const defects = [];
const seenIds = new Set();
for (const it of items) {
  if (seenIds.has(it.id)) defects.push(`duplicate id ${it.id}`);
  seenIds.add(it.id);
  if (!it.options.includes(it.answer)) defects.push(`${it.id}: answer not among options`);
  if (new Set(it.options).size !== it.options.length) defects.push(`${it.id}: duplicate options`);
  if (it.options.length !== 2) defects.push(`${it.id}: expected 2 options, got ${it.options.length}`);
  if (!hasArabicLetter(it.wordArabic)) defects.push(`${it.id}: no Arabic in word`);
  if (!it.explanation.trim()) defects.push(`${it.id}: empty explanation`);
}
// Answer-position bias — same check as homograph, sized for 2-option items.
const positions = items.map((it) => it.options.indexOf(it.answer));
const counts = [0, 0];
for (const p of positions) counts[p] += 1;
const worst = Math.max(...counts);
const share = worst / positions.length;
log(`answer position spread: ${counts.join('/')} (n=${positions.length})`);
if (positions.length >= 20 && share > 0.6) {
  defects.push(
    `answer sits at one position ${(share * 100).toFixed(0)}% of the time ` +
      `(${counts.join('/')}) — the shuffle is biased`
  );
}
if (defects.length) {
  log(`\n${defects.length} defect(s); refusing to emit.`);
  for (const d of defects.slice(0, 20)) log(`  ${d}`);
  process.exit(3);
}

log(`built ${items.length} items from ${pairs.length} pairs`);

// ── --check: compare against what is in the database ─────────────────────────
if (CHECK) {
  const { DatabaseSync } = await import('node:sqlite');
  const { existsSync, readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!existsSync(dir)) {
    log('SKIPPED the database comparison: no local D1 (.wrangler is gitignored).');
    log('✅ structural checks passed; the DB comparison was NOT run.');
    process.exit(0);
  }
  const file = readdirSync(dir).find((f) => f.endsWith('.sqlite') && !f.includes('metadata'));
  const db = new DatabaseSync(join(dir, file));
  const row = db.prepare("SELECT COUNT(*) AS n FROM grammar_exercise_bank WHERE kind = 'mutashabihat'").get();
  db.close();
  if (row.n !== items.length) {
    log(`✘ database holds ${row.n} mutashabihat items; the generator produces ${items.length}.`);
    process.exit(1);
  }
  log(`✅ database matches the generator (${row.n} mutashabihat items)`);
  process.exit(0);
}

// ── Emit ───────────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Generated by scripts/gen-mutashabihat-exercises.mjs. Do not edit.'];
out.push('-- Source: Tanzil Uthmani text, CC-BY, via scripts/find-mutashabihat.mjs.');
out.push("DELETE FROM grammar_exercise_bank WHERE kind = 'mutashabihat';");
for (const it of items) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, ' +
      'word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, ' +
      'word_index, segment_index, root) VALUES (' +
      [
        q(it.id), q(it.kind), it.level, q(it.wordArabic), 'NULL',
        q(it.prompt), q(it.answer), q(JSON.stringify(it.options)), q(it.explanation),
        it.surah, it.ayah, it.word, it.seg, 'NULL',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
