#!/usr/bin/env node
/**
 * Check the authored content for the errors a human eye slides over.
 *
 *   node scripts/check-content.mjs
 *
 * Exits non-zero on any finding, so CI can gate on it. Same shape as
 * scripts/gen-vocabulary.mjs: validate, report every problem, then refuse.
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * The first of five grammar lessons shipped with five separate factual errors,
 * and the app has been teaching them:
 *
 *   - the sun-letter list had 13 of 14 letters (ض missing)
 *   - الكتاب was labelled a sun-letter example, but ك is a MOON letter, and the
 *     entry's own transliteration "al-kitābu" shows the ل being pronounced
 *   - all three sun-letter examples — العين، الوجه، الماء — begin with moon
 *     letters
 *
 * None of that is a matter of taste. Sun and moon letters are a closed set of
 * 14 each, so membership is decidable, and an example either starts with a
 * letter from its own class or it does not. Anything decidable belongs in a
 * check rather than in a reviewer's patience.
 *
 * This deliberately only asserts what is mechanically decidable. It has no
 * opinion on whether an explanation is well written.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The closed sets. 14 each; together they are the 28 letters of the alphabet. */
const SUN = new Set('تثدذرزسشصضطظلن'.split(''));
const MOON = new Set('ابجحخعغفقكمهوي'.split(''));

const ARABIC = /[ء-غف-ي]/;
const DIACRITIC = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const AR_QUESTION = '؟'; // ؟
const LAT_QUESTION = '?';

const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const strip = (s) => (s ?? '').replace(DIACRITIC, '');

/** Letters of a word with the definite article removed, diacritics dropped. */
function afterAl(word) {
  const bare = strip(word).replace(/^[وف]?/, ''); // optional wa-/fa-
  const m = bare.match(/^(?:ال)(.+)$/); // alef-lam
  return m ? m[1] : null;
}

// ── Grammar lessons ─────────────────────────────────────────────────────────
const lessons = JSON.parse(
  await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8')
);
if (!Array.isArray(lessons)) {
  fail('grammar/lessons.json', 'expected a top-level array');
}

for (const lesson of Array.isArray(lessons) ? lessons : []) {
  const where = `grammar/${lesson.id ?? '(no id)'}`;
  for (const field of ['id', 'title', 'module', 'level']) {
    if (lesson[field] === undefined) fail(where, `missing "${field}"`);
  }

  const rules = lesson.content?.rules ?? [];
  for (const rule of rules) {
    const name = rule.name ?? '';
    const isSun = /sun letter/i.test(name) || name.includes('شمسية');
    const isMoon = /moon letter/i.test(name) || name.includes('قمرية');
    if (!isSun && !isMoon) continue;

    const expected = isSun ? SUN : MOON;
    const label = isSun ? 'sun' : 'moon';

    // The listed letters must be exactly the closed set.
    if (typeof rule.letters === 'string') {
      const listed = rule.letters.split(/\s+/).filter(Boolean);
      const missing = [...expected].filter((l) => !listed.includes(l));
      const extra = listed.filter((l) => !expected.has(l));
      if (listed.length !== expected.size) {
        fail(
          `${where} rule "${name}"`,
          `lists ${listed.length} ${label} letters, there are ${expected.size}`
        );
      }
      if (missing.length) {
        fail(`${where} rule "${name}"`, `missing ${label} letter(s): ${missing.join(' ')}`);
      }
      if (extra.length) {
        fail(`${where} rule "${name}"`, `lists non-${label} letter(s): ${extra.join(' ')}`);
      }
    }

    // Each example must actually begin with a letter of its own class.
    for (const ex of rule.examples ?? []) {
      const first = afterAl(ex)?.[0];
      if (!first) {
        fail(`${where} rule "${name}"`, `example ${ex} has no ال to test`);
        continue;
      }
      if (!expected.has(first)) {
        const actual = SUN.has(first) ? 'sun' : MOON.has(first) ? 'moon' : 'unknown';
        fail(
          `${where} rule "${name}"`,
          `example ${ex} starts with ${first}, which is a ${actual} letter, not ${label}`
        );
      }
    }
  }

  // Examples carrying their own "Sun letter"/"Moon letter" annotation.
  for (const ex of lesson.content?.examples ?? []) {
    const note = ex.rule ?? '';
    const claimsSun = /sun letter/i.test(note);
    const claimsMoon = /moon letter/i.test(note);
    if (!claimsSun && !claimsMoon) continue;
    const first = afterAl(ex.arabic ?? '')?.[0];
    if (!first) continue;
    const actual = SUN.has(first) ? 'sun' : MOON.has(first) ? 'moon' : 'unknown';
    const claimed = claimsSun ? 'sun' : 'moon';
    if (actual !== claimed) {
      fail(
        `${where} example ${ex.arabic}`,
        `annotated as a ${claimed} letter case but starts with ${first}, a ${actual} letter`
      );
    }
    // A sun letter assimilates the ل, so the transliteration must not show "al-"
    // followed by that letter unassimilated.
    const tr = (ex.transliteration ?? '').toLowerCase();
    if (actual === 'sun' && /^al-/.test(tr)) {
      fail(
        `${where} example ${ex.arabic}`,
        `sun letter, so the ل assimilates, but the transliteration is "${ex.transliteration}"`
      );
    }
  }
}

// ── Question marks ──────────────────────────────────────────────────────────
// ؟ is a mirrored glyph. In an English sentence it reads as a backwards "?".
function checkQuestionMarks(where, text) {
  if (typeof text !== 'string') return;
  const arabicCount = (text.match(/[ء-ي]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  if (text.includes(AR_QUESTION) && latinCount > arabicCount) {
    fail(where, `uses the Arabic ؟ in a Latin-majority string: "${text.slice(0, 70)}"`);
  }
  if (text.includes(LAT_QUESTION) && arabicCount > 0 && latinCount === 0) {
    fail(where, `uses a Latin ? in an all-Arabic string: "${text.slice(0, 70)}"`);
  }
}

const assessment = JSON.parse(
  await readFile(join(root, 'content/assessments/placement-test.json'), 'utf-8')
);
for (const mod of assessment.modules ?? []) {
  for (const q of mod.questions ?? []) {
    const where = `assessment/${mod.id ?? '?'}/${q.id ?? '?'}`;
    checkQuestionMarks(where, q.instruction);
    if (!q.options?.length) fail(where, 'has no options');
    const correct = (q.options ?? []).filter((o) => o.correct).length;
    if (correct !== 1) fail(where, `has ${correct} correct options, expected exactly 1`);
    // Arabic shown to the learner must contain Arabic.
    if (q.display && !ARABIC.test(q.display)) {
      notes.push(`${where}: display "${q.display}" contains no Arabic`);
    }
  }
}

for (const lesson of Array.isArray(lessons) ? lessons : []) {
  checkQuestionMarks(`grammar/${lesson.id}/explanation`, lesson.content?.explanation);
  for (const exr of lesson.exercises ?? []) {
    checkQuestionMarks(`grammar/${lesson.id}/exercise`, exr.question ?? exr.prompt);
  }
}

// ── Vocabulary ──────────────────────────────────────────────────────────────
const vocab = JSON.parse(
  await readFile(join(root, 'content/vocabulary/core-100.json'), 'utf-8')
);
const seen = new Set();
for (const [i, e] of vocab.entries()) {
  const where = `vocabulary[${i}] ${e.word ?? '(no word)'}`;
  if (!e.word || !ARABIC.test(e.word)) fail(where, 'word contains no Arabic');
  if (!e.meaning) fail(where, 'missing meaning');
  if (seen.has(e.word)) fail(where, 'duplicate word');
  seen.add(e.word);
  if (!Number.isInteger(e.frequency_rank)) fail(where, 'frequency_rank must be an integer');
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const n of notes) process.stdout.write(`  note  ${n}\n`);

if (problems.length === 0) {
  process.stdout.write(
    `✅ content checks pass — ${lessons.length} lessons, ` +
      `${(assessment.modules ?? []).reduce((n, m) => n + (m.questions?.length ?? 0), 0)} questions, ` +
      `${vocab.length} vocabulary entries\n`
  );
  process.exit(0);
}

for (const p of problems) process.stderr.write(`  ✘ ${p}\n`);
process.stderr.write(`\n${problems.length} content problem(s). These are factual, not stylistic.\n`);
process.exit(1);
