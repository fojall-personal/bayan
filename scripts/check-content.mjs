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

// ── Sun-letter orthography ──────────────────────────────────────────────────
//
// A sun letter assimilates the ل of ال, so the ل carries NO sukoon and the sun
// letter carries a shadda. Writing both — الْرَّجُلُ — claims the ل is pronounced
// and assimilated at once. All three examples in grammar-05 shipped that way,
// contradicting grammar-01, which spells الشَّمْسُ correctly two lessons earlier.
//
// Decidable from the codepoints alone, so it belongs here.
const LAM = 'ل';
const SUKUN = 'ْ';
const SHADDA = 'ّ';
const ALEF = 'ا';

function checkSunLetterSpelling(where, text) {
  if (typeof text !== 'string') return;
  for (let i = 0; i + 2 < text.length; i += 1) {
    if (text[i] !== ALEF || text[i + 1] !== LAM || text[i + 2] !== SUKUN) continue;
    const letter = text[i + 3];
    if (!letter || !SUN.has(letter)) continue; // moon letters take the sukoon
    fail(
      where,
      `"${text.slice(i, i + 6)}" puts a sukoon on the ل of ال before the sun ` +
        `letter ${letter}. A sun letter assimilates the ل: no sukoon, and a ` +
        `shadda on the ${letter}.`
    );
  }
  // The mirror error: a shadda on a moon letter directly after ال.
  for (let i = 0; i + 3 < text.length; i += 1) {
    if (text[i] !== ALEF || text[i + 1] !== LAM) continue;
    const letter = text[i + 2];
    if (!MOON.has(letter)) continue;
    if (text[i + 3] === SHADDA) {
      fail(
        where,
        `"${text.slice(i, i + 6)}" puts a shadda on the moon letter ${letter} ` +
          `right after ال. Moon letters do not assimilate the ل.`
      );
    }
  }
}

// ── Every Arabic string in a lesson, not just content.examples ──────────────
//
// The last round verified that each entry in content.examples occurs in the
// pinned text — and missed two spellings sitting in rules[].description, because
// nothing walked them: ذَٰلِكَ ٱلْكِتَابُ and كِتَابُهُ, both written with a full
// alef where the Quran uses a dagger alef. A check that only visits the field you
// remembered is a check you will outgrow.
const DIAC_SET = new Set([
  ...range(0x0610, 0x061a), ...range(0x064b, 0x065f), 0x0670, 0x0640,
  ...range(0x06d6, 0x06ed),
]);
function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i += 1) out.push(i);
  return out;
}
const FOLD = new Map([
  [0x0671, ALEF], [0x0623, ALEF], [0x0625, ALEF], [0x0622, ALEF], [0x0649, 'ي'],
]);
const normalise = (s) =>
  [...(s ?? '')]
    .filter((c) => !DIAC_SET.has(c.codePointAt(0)))
    .map((c) => FOLD.get(c.codePointAt(0)) ?? c)
    .join('');

let quranText = null;
try {
  quranText = normalise(await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8'));
} catch {
  // data/ is gitignored and regenerable, so a missing text is a skip, not a
  // failure — otherwise a fresh clone cannot run the gate at all.
  notes.push('data/quran-uthmani.txt not present — skipped Quranic occurrence checks');
}

const AR_RUN = /[؀-ۿݐ-ݿ]+(?:[ ‏]+[؀-ۿݐ-ݿ]+)*/g;

/** Walk every string in a lesson, remembering where it came from. */
function* strings(node, where) {
  if (typeof node === 'string') yield [where, node];
  else if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* strings(v, `${where}[${i}]`);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) yield* strings(v, where ? `${where}.${k}` : k);
  }
}

// Vocalised Arabic is a quotation; unvocalised Arabic is metalanguage. Lesson
// titles and grammatical terms — المضاف إليه, حروف شمسية, أسماء الإشارة — are
// written without harakat and are not claims about the text, so checking them
// produces twenty notes that bury the one that matters. A phrase carrying
// harakat is being presented as real Quranic Arabic, and that is checkable.
const HARAKAT = /[ً-ْٰ]/;

for (const lesson of Array.isArray(lessons) ? lessons : []) {
  const base = `grammar/${lesson.id ?? '?'}`;
  for (const [path, text] of strings(lesson, '')) {
    checkSunLetterSpelling(`${base} ${path}`, text);
  }
  if (!quranText) continue;

  // An example is a quotation unless it declares otherwise. grammar-03 and
  // grammar-05 teach case and word order with sentences of their own making;
  // those carry "quranic": false. Anything that forgets to declare it gets
  // checked — the default has to be the strict one, because the two spellings
  // this check exists to catch were both undeclared.
  for (const [i, ex] of (lesson.content?.examples ?? []).entries()) {
    if (ex.quranic === false) continue;
    const phrase = (ex.arabic ?? '').trim();
    if (!phrase || !HARAKAT.test(phrase)) continue;
    if (!quranText.includes(normalise(phrase))) {
      fail(
        `${base} example[${i}]`,
        `"${phrase}" does not occur in the pinned Quran text. Fix the spelling, ` +
          `or set "quranic": false if it is an authored teaching example.`
      );
    }
  }

  // Rules and exercise explanations cite Arabic too, and nothing walked them
  // before: ذَٰلِكَ ٱلْكِتَابُ and كِتَابُهُ both sat in rules[].description with a
  // full alef where the Quran writes a dagger alef, and both passed a check that
  // only ever looked at content.examples.
  for (const [path, text] of strings(
    {
      rules: lesson.content?.rules ?? [],
      exercises: (lesson.exercises ?? []).filter((e) => e.quranic !== false),
    },
    ''
  )) {
    for (const run of text.match(AR_RUN) ?? []) {
      const phrase = run.trim();
      if (!phrase.includes(' ') || !HARAKAT.test(phrase)) continue;
      const bare = normalise(phrase);
      if (bare.replace(/\s/g, '').length < 6) continue;
      if (!quranText.includes(bare)) {
        fail(
          `${base} ${path}`,
          `cites "${phrase}", which does not occur in the pinned Quran text`
        );
      }
    }
  }
}

// ── Exercise options that are really the same answer ───────────────────────
//
// Four generated items shipped with a distractor that was also correct — one
// offered "[the] people" against "(the) People", differing only in brackets. The
// authored exercises can drift the same way, and an item with two right answers
// looks perfectly well-formed from the outside.
const LEADING_FUNCTION =
  /^(?:and|or|then|so|but|for|with|in|on|at|to|of|from|by|the|a|an|is|are|was|were|be|been)\b\s*/;
function answerKey(s) {
  let out = String(s ?? '')
    .toLowerCase()
    .replace(/[[\]()]/g, ' ')
    .replace(/[^a-z؀-ۿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let prev;
  do {
    prev = out;
    out = out.replace(LEADING_FUNCTION, '').trim();
  } while (out !== prev);
  return out.replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

for (const lesson of Array.isArray(lessons) ? lessons : []) {
  for (const [i, exr] of (lesson.exercises ?? []).entries()) {
    const where = `grammar/${lesson.id}/exercise[${i}]`;
    const options = exr.options;
    if (!Array.isArray(options)) continue;
    if (new Set(options).size !== options.length) {
      fail(where, 'lists the same option twice');
    }
    const keys = options.map(answerKey);
    for (let a = 0; a < keys.length; a += 1) {
      for (let b = a + 1; b < keys.length; b += 1) {
        if (keys[a] && keys[a] === keys[b]) {
          fail(
            where,
            `options "${options[a]}" and "${options[b]}" mean the same thing, so ` +
              'the item has two right answers'
          );
        }
      }
    }
    if (Number.isInteger(exr.correct) && (exr.correct < 0 || exr.correct >= options.length)) {
      fail(where, `correct index ${exr.correct} is outside 0..${options.length - 1}`);
    }
  }
}

// ── Literacy lessons ────────────────────────────────────────────────────────
{
  const LETTERS = new Set('ابتثجحخدذرزسشصضطظعغفقكلمنهويأإآءؤئىةٱ'.split(''));
  let literacy = [];
  try {
    literacy = JSON.parse(await readFile(join(root, 'content/literacy/lessons.json'), 'utf-8'));
  } catch {
    literacy = [];
  }
  if (Array.isArray(literacy) && literacy.length > 0) {
    for (const lesson of literacy) {
      const where = `literacy/${lesson.id ?? '(no id)'}`;
      if (lesson.module !== 'literacy') fail(where, 'module must be literacy');
      for (const [, text] of strings(lesson, where)) {
        for (const ch of text) {
          if (!ARABIC.test(ch)) continue;
          if (/[ؐ-ًؚ-ٰٟۖ-ۭ]/.test(ch)) continue;
          if (!LETTERS.has(ch) && ch !== 'ـ') {
            fail(where, `example character ${ch} is outside the 28 letters + hamza carriers`);
          }
        }
      }
    }
    notes.push(`literacy lessons: ${literacy.length}`);
  }
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
