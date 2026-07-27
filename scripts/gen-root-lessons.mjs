#!/usr/bin/env node
/**
 * Generate one lesson per high-frequency root, entirely from the corpus.
 *
 *   node scripts/gen-root-lessons.mjs            # write content/grammar/root-lessons.json
 *   node scripts/gen-root-lessons.mjs --check    # fail if the file is out of date
 *   ROOT_LESSONS=80 node scripts/gen-root-lessons.mjs
 *
 * ── Why generated lessons are safe here and would not be in general ─────────
 *
 * Ten authored lessons carry 21 exercises between them, and the reason there are not
 * fifty is the reason this project keeps insisting on derivation: hand-authored Arabic
 * is how a moon letter ended up in the sun-letter list, and how ٱلْكِتَابُ came to be
 * labelled a sun letter in the lesson a beginner sees first.
 *
 * So nothing here is authored. Every sentence of prose is a template whose every FACT
 * is read from quran_word_morphology and quran_word_gloss: how often a root occurs,
 * which words are built on it, what those words are glossed as, and where they appear.
 * A generated lesson can be wrong only if the corpus is wrong, and the corpus is the
 * same source the exercise bank, the coverage model and the tutor already answer from.
 *
 * What is deliberately NOT generated: any claim about grammar the annotation does not
 * record. No lesson here explains why a form takes a case, what a construction means,
 * or when to use one pattern over another — that is the authored lessons' job, and
 * templating it would produce confident sentences nobody checked. These lessons teach
 * vocabulary in root families, which is exactly what the corpus can support.
 *
 * Kept in their own file rather than merged into lessons.json so that authored and
 * generated content stay tellable apart — by the pedagogy gate, by the review document,
 * and by whoever reads them next.
 */

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const OUT = join(root, 'content/grammar/root-lessons.json');
const HOW_MANY = Number(process.env.ROOT_LESSONS ?? 60);

const BW_TO_AR = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ',
  A: 'ا', b: 'ب', p: 'ة', t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ',
  d: 'د', '*': 'ذ', r: 'ر', z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض',
  T: 'ط', Z: 'ظ', E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك', l: 'ل',
  m: 'م', n: 'ن', h: 'ه', w: 'و', y: 'ي', Y: 'ى', '`': 'ٰ',
};
/** Joined with nothing, so the shaping engine connects the letters. */
const toArabic = (bw) => [...bw].map((c) => BW_TO_AR[c] ?? c).join('');
const spelled = (bw) => [...bw].map((c) => BW_TO_AR[c] ?? c).join(' ');

async function localDbPath() {
  const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = await readdir(dir).catch(() => []);
  const f = files.find((x) => x.endsWith('.sqlite'));
  return f ? join(dir, f) : null;
}

const dbPath = await localDbPath();

/**
 * --check without a corpus still checks what it can.
 *
 * CI has neither data/ nor .wrangler/ — both are gitignored, being large and
 * regenerable — so a check that requires the corpus cannot run there. I added this gate
 * to CI without thinking that through and it failed on the first push for exactly that
 * reason.
 *
 * The corpus comparison genuinely needs the corpus. The rest does not: the committed
 * JSON can be checked for structure, for gradable exercises, for answer indices in
 * range, and for the answer-position distribution — which is the check that caught a
 * real bug, and it reads the file alone. So without a database, run those and say
 * plainly that the comparison was skipped rather than passing silently.
 */
if (check && !dbPath) {
  const payload = JSON.parse(await readFile(OUT, 'utf-8').catch(() => 'null'));
  if (!payload?.lessons?.length) {
    process.stderr.write('✘ content/grammar/root-lessons.json is missing or empty\n');
    process.exit(1);
  }
  const problems = [];
  const positions = new Map();
  let mcq = 0;
  for (const l of payload.lessons) {
    const gradable = (l.exercises ?? []).filter((e) =>
      ['multiple_choice', 'fill_blank', 'match'].includes(e.type)
    );
    if (gradable.length < 2) problems.push(`${l.id}: only ${gradable.length} gradable`);
    if (!l.content?.explanation) problems.push(`${l.id}: no explanation`);
    for (const e of l.exercises ?? []) {
      if (e.type !== 'multiple_choice') continue;
      mcq += 1;
      if (!Array.isArray(e.options) || e.options.length < 2) {
        problems.push(`${l.id}: a multiple choice with fewer than 2 options`);
      } else if (!(Number(e.correct) >= 0 && Number(e.correct) < e.options.length)) {
        problems.push(`${l.id}: correct index ${e.correct} is outside its options`);
      }
      positions.set(e.correct, (positions.get(e.correct) ?? 0) + 1);
    }
  }
  if (mcq >= 20) {
    const share = Math.max(...positions.values()) / mcq;
    if (share > 0.5) {
      problems.push(
        `${Math.round(share * 100)}% of correct answers sit at one option position — ` +
          'scoreable without reading the question'
      );
    }
  }
  if (problems.length > 0) {
    process.stderr.write(
      `✘ ${problems.length} problem(s) in the generated lessons:\n` +
        problems.slice(0, 10).map((x) => `    ${x}\n`).join('')
    );
    process.exit(1);
  }
  process.stdout.write(
    `✅ ${payload.lessons.length} generated lessons are structurally sound ` +
      `(${mcq} questions, answers spread across positions). Corpus comparison skipped: ` +
      'no local database, which is expected in CI.\n'
  );
  process.exit(0);
}

if (!dbPath) {
  process.stderr.write('✘ no local D1 database found — ingest the corpus first\n');
  process.exit(1);
}
const db = new DatabaseSync(dbPath);

/**
 * Deterministic shuffle, so regenerating does not reorder everything.
 *
 * Math.imul is load-bearing, not a stylistic choice. The first version used plain `*`
 * for the FNV step, which overflows past 2^53 and becomes Infinity; `Infinity &
 * 0x7fffffff` is 0, so every sort key collapsed to `i * 7919` — strictly increasing,
 * making the shuffle an identity function. The result was that 98% of correct answers
 * sat at option 0, and a learner could have scored 98% by always clicking the first
 * one. It looked like a shuffle, ran without error, and taught nothing.
 */
function seededShuffle(items, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return items
    .map((v, i) => {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      return { v, k: (h ^ Math.imul(i, 2654435761)) >>> 0 };
    })
    .sort((a, b) => a.k - b.k)
    .map((x) => x.v);
}

const roots = db
  .prepare(
    `SELECT root, COUNT(*) AS occurrences
       FROM quran_word_morphology
      WHERE root IS NOT NULL AND LENGTH(root) >= 2
      GROUP BY root
      ORDER BY occurrences DESC
      LIMIT ?`
  )
  .all(HOW_MANY);

/** A pool of glossed words from OTHER roots, for distractors. */
const glossPool = db
  .prepare(
    `SELECT DISTINCT g.arabic, g.english, m.root
       FROM quran_word_gloss g
       JOIN quran_word_morphology m
         ON m.surah_id = g.surah_id AND m.ayah_id = g.ayah_id AND m.word_index = g.position
      WHERE g.english IS NOT NULL AND g.english <> '' AND m.root IS NOT NULL
        AND LENGTH(g.arabic) > 3
      LIMIT 4000`
  )
  .all();

const lessons = [];
const skipped = [];

for (let i = 0; i < roots.length; i += 1) {
  const { root: bw, occurrences } = roots[i];
  const arabic = toArabic(bw);

  // Words actually built on this root, with a gloss and a location.
  const words = db
    .prepare(
      `SELECT DISTINCT g.arabic, g.english, g.surah_id, g.ayah_id
         FROM quran_word_gloss g
         JOIN quran_word_morphology m
           ON m.surah_id = g.surah_id AND m.ayah_id = g.ayah_id AND m.word_index = g.position
        WHERE m.root = ? AND g.english IS NOT NULL AND g.english <> ''
        ORDER BY g.surah_id, g.ayah_id
        LIMIT 60`
    )
    .all(bw);

  // Distinct parts of speech and verb forms the corpus attests for this root.
  const shapes = db
    .prepare(
      `SELECT DISTINCT pos, verb_form FROM quran_word_morphology
        WHERE root = ? AND pos IS NOT NULL`
    )
    .all(bw);

  // Three exercises need at least four distinct glossed words to build from.
  const distinct = [];
  const seenWord = new Set();
  for (const w of words) {
    if (seenWord.has(w.arabic)) continue;
    seenWord.add(w.arabic);
    distinct.push(w);
  }
  if (distinct.length < 4) {
    skipped.push(`${bw} (${distinct.length} glossed words)`);
    continue;
  }

  // Level from frequency, the same rule the exercise bank uses: a root you meet
  // constantly is a beginner's word regardless of what it means.
  const level = occurrences >= 500 ? 1 : occurrences >= 200 ? 2 : occurrences >= 80 ? 3 : 4;

  const picks = seededShuffle(distinct, bw);
  const target = picks[0];
  const otherRootWords = seededShuffle(
    glossPool.filter((g) => g.root !== bw && g.arabic !== target.arabic),
    `d${bw}`
  );

  // ── Exercise 1: which word belongs to this root ──────────────────────────
  const belongOptions = seededShuffle(
    [target.arabic, ...otherRootWords.slice(0, 3).map((g) => g.arabic)],
    `b${bw}`
  );
  // ── Exercise 2: what does an attested word mean ───────────────────────────
  const meaningWord = picks[1];
  const meaningOptions = seededShuffle(
    [
      meaningWord.english,
      ...otherRootWords
        .filter((g) => g.english !== meaningWord.english)
        .slice(3, 6)
        .map((g) => g.english),
    ],
    `m${bw}`
  );
  if (meaningOptions.length < 4 || belongOptions.length < 4) {
    skipped.push(`${bw} (not enough distractors)`);
    continue;
  }

  const posList = [...new Set(shapes.map((s) => s.pos))].filter(Boolean);
  const forms = [...new Set(shapes.map((s) => s.verb_form))].filter(Boolean);

  lessons.push({
    id: `root-${bw}`,
    // The Arabic is the title; the spelled-out letters help a beginner read it.
    title: `The root ${arabic} (${spelled(bw)})`,
    module: 'grammar',
    level,
    // Chained by frequency so they unlock in the order they pay off. The first has no
    // prerequisite; each later one follows the previous, which keeps the path linear
    // and means the pedagogy gate can walk it.
    prerequisites: lessons.length === 0 ? [] : [lessons[lessons.length - 1].id],
    content: {
      // Every number and every word in this paragraph is read from the corpus.
      explanation:
        `The root ${arabic} occurs ${occurrences.toLocaleString('en-US')} times in the ` +
        `Quran. Arabic builds words from three-letter roots, so learning one root ` +
        `unlocks every word derived from it — this one appears in ${distinct.length} ` +
        `distinct glossed word${distinct.length === 1 ? '' : 's'}` +
        (posList.length > 0
          ? `, tagged in the corpus as ${posList.join(', ')}`
          : '') +
        (forms.length > 0
          ? `, in verb form${forms.length === 1 ? '' : 's'} ${forms.join(', ')}`
          : '') +
        `. The words below are attested occurrences with their word-by-word glosses.`,
      examples: picks.slice(0, 6).map((w) => ({
        arabic: w.arabic,
        transliteration: '',
        meaning: w.english,
        rule: `${w.surah_id}:${w.ayah_id}`,
      })),
      rules: [
        {
          name: `Words on ${arabic}`,
          description:
            `Attested in the Quranic Arabic Corpus. Each is a real occurrence rather ` +
            `than a constructed example, and the reference is where to find it.`,
          examples: picks.slice(0, 8).map((w) => w.arabic),
        },
      ],
    },
    exercises: [
      {
        type: 'multiple_choice',
        question: `Which of these words is built on the root ${arabic}?`,
        options: belongOptions,
        correct: belongOptions.indexOf(target.arabic),
        explanation:
          `${target.arabic} — glossed "${target.english}" at ${target.surah_id}:` +
          `${target.ayah_id} — carries the root ${arabic}. The others come from ` +
          `different roots.`,
      },
      {
        type: 'multiple_choice',
        question: `What does ${meaningWord.arabic} mean?`,
        options: meaningOptions,
        correct: meaningOptions.indexOf(meaningWord.english),
        explanation:
          `"${meaningWord.english}", from the word-by-word gloss at ` +
          `${meaningWord.surah_id}:${meaningWord.ayah_id}.`,
      },
      {
        type: 'fill_blank',
        question: `Type the root of ${picks[2].arabic} in Arabic (three letters).`,
        correct: arabic,
        explanation:
          `${arabic}. Diacritics are ignored when checking, so ${spelled(bw)} is enough.`,
      },
    ],
  });
}

db.close();

// ── Answer position must not be predictable ────────────────────────────────
//
// A broken shuffle put 98% of correct answers at option 0, which is scoreable without
// reading the question. It ran clean and produced plausible-looking lessons, so the
// only thing that would have caught it is this: assert the distribution rather than
// trusting the shuffle.
{
  const positions = new Map();
  let mcq = 0;
  for (const l of lessons) {
    for (const e of l.exercises) {
      if (e.type !== 'multiple_choice') continue;
      mcq += 1;
      positions.set(e.correct, (positions.get(e.correct) ?? 0) + 1);
    }
  }
  if (mcq >= 20) {
    const worst = Math.max(...positions.values());
    const share = worst / mcq;
    // Four options, so ~25% each. Half of everything in one slot is a broken shuffle,
    // not bad luck.
    if (share > 0.5) {
      process.stderr.write(
        `✘ ${Math.round(share * 100)}% of correct answers sit at one option position ` +
          `(${mcq} questions). That is scoreable without reading the question — the ` +
          'shuffle is not shuffling.\n'
      );
      process.exit(1);
    }
    process.stderr.write(
      `  answer positions: ${[...positions.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => `${k}:${Math.round((v / mcq) * 100)}%`)
        .join(' ')}\n`
    );
  }
}

const payload = {
  _comment:
    'GENERATED by scripts/gen-root-lessons.mjs from the corpus. Do not hand-edit — every ' +
    'fact here is read from quran_word_morphology and quran_word_gloss, and editing it ' +
    'by hand reintroduces exactly the risk generation removes.',
  generatedFrom: 'Quranic Arabic Corpus v0.4 (GNU GPL) + quran.com word-by-word glosses',
  lessons,
};
const serialised = JSON.stringify(payload, null, 2) + '\n';

if (check) {
  const current = await readFile(OUT, 'utf-8').catch(() => '');
  if (current !== serialised) {
    process.stderr.write(
      '✘ content/grammar/root-lessons.json is out of date with the corpus.\n' +
        '  Run: node scripts/gen-root-lessons.mjs\n'
    );
    process.exit(1);
  }
  process.stdout.write(`✅ ${lessons.length} generated root lessons match the corpus\n`);
  process.exit(0);
}

await writeFile(OUT, serialised, 'utf-8');
process.stdout.write(
  `wrote ${lessons.length} root lessons (${lessons.length * 3} exercises) to ` +
    'content/grammar/root-lessons.json\n'
);
if (skipped.length > 0) {
  // Reported rather than silently dropped: a root with too few glossed words cannot
  // support three exercises, and pretending otherwise is how empty options ship.
  process.stderr.write(
    `  skipped ${skipped.length} root(s) with too little glossed data: ` +
      `${skipped.slice(0, 6).join(', ')}${skipped.length > 6 ? ' …' : ''}\n`
  );
}
