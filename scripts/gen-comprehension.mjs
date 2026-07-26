#!/usr/bin/env node
/**
 * Ingest word-level English glosses and derive comprehension exercises (F4).
 *
 *   node scripts/gen-comprehension.mjs > /tmp/comprehension.sql
 *   cd workers && npx wrangler d1 execute languagebuilder --local  --file=/tmp/comprehension.sql
 *
 * Source: quran.com v4 word-by-word translation, fetched per surah and cached in
 * data/wbw/ (gitignored, like the corpus and the Quran text). Pass --offline to
 * fail rather than fetch, for a reproducible run against an existing cache.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The morphology corpus has no English. Every one of the 754 exercises derived
 * from it asks a learner to LABEL something — which form, which case, which part
 * of speech — and not one asks what a word means. An app that tests whether you
 * can parse Arabic but never whether you can read it is only half built. That is
 * the F4 gap in the plan, and glosses are what closes it.
 *
 * Two exercise kinds, both grounded:
 *
 *   word_meaning  "What does {word} mean?"        — distractors are real glosses
 *   find_word     "Which word here means {gloss}?" — options are words from that
 *                                                    very ayah
 *
 * Distractors are always real glosses of real words, never invented. An invented
 * gloss would be both guessable and a claim about Arabic that no source supports.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, 'data/wbw');
const offline = process.argv.includes('--offline');
const log = (m) => process.stderr.write(m + '\n');

const EXPECTED_WORDS = 77429;

// ── Fetch or read cache ────────────────────────────────────────────────────
await mkdir(CACHE, { recursive: true });
const surahs = [];
for (let s = 1; s <= 114; s++) {
  const path = join(CACHE, `${s}.json`);
  if (!existsSync(path)) {
    if (offline) {
      log(`--offline given but ${path} is missing`);
      process.exit(1);
    }
    const url =
      `https://api.quran.com/api/v4/verses/by_chapter/${s}` +
      `?words=true&word_fields=text_uthmani,transliteration,translation&per_page=300`;
    const res = await fetch(url);
    if (!res.ok) {
      log(`fetch failed for surah ${s}: ${res.status}`);
      process.exit(1);
    }
    await writeFile(path, await res.text());
    await new Promise((r) => setTimeout(r, 350)); // be polite
  }
  surahs.push(JSON.parse(await readFile(path, 'utf-8')));
}
log(`loaded ${surahs.length} surahs from ${CACHE}`);

// ── Flatten to words ───────────────────────────────────────────────────────
const words = [];
for (const s of surahs) {
  for (const v of s.verses) {
    let pos = 0;
    for (const w of v.words) {
      if (w.char_type_name !== 'word') continue;
      pos++;
      const [su, ay] = v.verse_key.split(':').map(Number);
      words.push({
        surah: su,
        ayah: ay,
        position: pos,
        arabic: w.text_uthmani ?? w.text ?? '',
        translit: w.transliteration?.text ?? null,
        english: (w.translation?.text ?? '').trim(),
      });
    }
  }
}
log(`words: ${words.length}`);
if (words.length !== EXPECTED_WORDS) {
  log(`REFUSING: expected ${EXPECTED_WORDS} words, got ${words.length}`);
  process.exit(2);
}
if (words.some((w) => !w.arabic || !w.english)) {
  log('REFUSING: some words have no Arabic or no gloss');
  process.exit(2);
}

// ── Gloss quality ──────────────────────────────────────────────────────────
//
// Function words make terrible comprehension questions: "what does وَ mean?"
// answered by "and" teaches nothing, and glosses like "the" or "(be) to" collide
// across hundreds of words, making distractors ambiguous.
const FUNCTION_GLOSS = /^(\(?be\)?|the|and|of|to|in|for|a|an|is|are|it|that|then|but|or|so|not|no|O|and the|of the|to the|in the)$/i;
const cleanGloss = (g) => g.replace(/\s+/g, ' ').trim();

/**
 * The comparable core of a gloss, for deciding whether two options are really
 * the same answer.
 *
 * Comparing glosses by lowercased string let four items ship with a distractor
 * that was also correct: "and the sky" against "the sky", "the earth" against
 * "and the earth", and — worst — "[the] people" against "(the) People", which
 * differ only in bracket style. A learner cannot choose between those, so the
 * item has no right answer.
 *
 * Brackets, leading conjunctions and prepositions, and articles all carry
 * grammar rather than meaning, so they are exactly what must be ignored here.
 */
const LEADING_FUNCTION =
  /^(?:and|or|then|so|but|for|with|in|on|at|to|of|from|by|the|a|an|is|are|was|were|be|been)\b\s*/;

function glossKey(g) {
  let s = cleanGloss(g)
    .toLowerCase()
    .replace(/[[\]()]/g, ' ') // drop brackets, keeping what is inside
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Strip leading function words one at a time. A single pass with an anchored
  // regex is not enough: "(is) the Striking Calamity" becomes " is the striking
  // calamity", whose leading space defeats ^, so it survived as distinct from
  // "The Striking Calamity" — the collision this function exists to catch.
  let prev;
  do {
    prev = s;
    s = s.replace(LEADING_FUNCTION, '').trim();
  } while (s !== prev);
  return s.replace(/\b(?:the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
function isTeachable(w) {
  const g = cleanGloss(w.english);
  if (g.length < 3) return false;
  if (FUNCTION_GLOSS.test(g)) return false;
  // A gloss that is mostly parenthetical supplies more grammar than meaning.
  const bare = g.replace(/\([^)]*\)/g, '').trim();
  if (bare.length < 3) return false;
  return [...w.arabic].length >= 3;
}

/** Word frequency drives level, as it does for vocabulary and grammar. */
const DIAC = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const bare = (s) =>
  (s ?? '')
    .replace(DIAC, '')
    .replace(/[ٱأإ]/g, 'ا')
    .trim();
const freq = new Map();
for (const w of words) {
  const k = bare(w.arabic);
  freq.set(k, (freq.get(k) ?? 0) + 1);
}
const levelFor = (w) => {
  const n = freq.get(bare(w.arabic)) ?? 0;
  if (n >= 200) return 1;
  if (n >= 60) return 2;
  if (n >= 20) return 3;
  if (n >= 5) return 4;
  return 5;
};

function seededShuffle(items, seed) {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    [out[i], out[Math.abs(h) % (i + 1)]] = [out[Math.abs(h) % (i + 1)], out[i]];
  }
  return out;
}

// Pool of teachable glosses per surah, for contextually plausible distractors.
const bySurah = new Map();
for (const w of words) {
  if (!isTeachable(w)) continue;
  if (!bySurah.has(w.surah)) bySurah.set(w.surah, []);
  bySurah.get(w.surah).push(w);
}

const byAyah = new Map();
for (const w of words) {
  const k = `${w.surah}:${w.ayah}`;
  if (!byAyah.has(k)) byAyah.set(k, []);
  byAyah.get(k).push(w);
}

const exercises = [];

// ── 1. word_meaning ───────────────────────────────────────────────────────
for (const w of words) {
  if (!isTeachable(w)) continue;
  const answer = cleanGloss(w.english);
  const answerKey = glossKey(answer);
  const pool = (bySurah.get(w.surah) ?? []).filter(
    (o) => glossKey(o.english) !== answerKey
  );
  if (pool.length < 3) continue;
  const seed = `wm${w.surah}:${w.ayah}:${w.position}`;
  const picks = [];
  const pickKeys = new Set([answerKey]);
  for (const cand of seededShuffle(pool, seed)) {
    const g = cleanGloss(cand.english);
    const k = glossKey(g);
    if (!k || pickKeys.has(k)) continue; // never two options that mean the same
    pickKeys.add(k);
    picks.push(g);
    if (picks.length === 3) break;
  }
  if (picks.length < 3) continue;
  exercises.push({
    id: `word_meaning-${w.surah}-${w.ayah}-${w.position}`,
    kind: 'word_meaning',
    level: levelFor(w),
    wordArabic: w.arabic,
    wordBuckwalter: w.translit ?? '',
    prompt: `What does ${w.arabic} mean?`,
    answer,
    options: seededShuffle([answer, ...picks], seed + 'o'),
    explanation:
      `${w.arabic}${w.translit ? ` (${w.translit})` : ''} means “${answer}” ` +
      `at Quran ${w.surah}:${w.ayah}.`,
    surah: w.surah,
    ayah: w.ayah,
    word: w.position,
    seg: 1,
    root: null,
  });
}

// ── 2. find_word ──────────────────────────────────────────────────────────
for (const [key, group] of byAyah) {
  const teachable = group.filter(isTeachable);
  if (teachable.length < 4 || group.length > 12) continue; // long ayahs are a wall of text
  // Skip ayahs where two words mean the same thing — the question would have two
  // right answers. Compared on the gloss key, not the raw string, so "(the) Book"
  // and "[the] book" count as the collision they are.
  const glosses = teachable.map((w) => glossKey(w.english));
  if (new Set(glosses).size !== glosses.length) continue;

  // And skip ayahs that repeat a word. 17:72 says أَعْمَىٰ twice with two
  // different glosses, so the gloss check above passes while the options end up
  // listing the same Arabic twice — the learner is asked to pick between two
  // identical buttons, one of which is marked wrong.
  const forms = teachable.map((w) => bare(w.arabic));
  if (new Set(forms).size !== forms.length) continue;

  const [su, ay] = key.split(':').map(Number);
  const seed = `fw${key}`;
  // Not teachable[0]: always asking about the first word of the ayah makes every
  // item answerable by position rather than by meaning.
  const order = seededShuffle(teachable, seed + 't');
  const target = order[0];
  const others = order.slice(1, 4);
  if (others.length < 3) continue;
  exercises.push({
    id: `find_word-${su}-${ay}-${target.position}`,
    kind: 'find_word',
    level: levelFor(target),
    wordArabic: group.map((w) => w.arabic).join(' '),
    wordBuckwalter: '',
    prompt: `In this ayah, which word means “${cleanGloss(target.english)}”?`,
    answer: target.arabic,
    options: seededShuffle([target.arabic, ...others.map((w) => w.arabic)], seed),
    explanation:
      `${target.arabic} means “${cleanGloss(target.english)}” — word ` +
      `${target.position} of Quran ${su}:${ay}.`,
    surah: su,
    ayah: ay,
    word: target.position,
    seg: 1,
    root: null,
  });
}

// ── Balance ───────────────────────────────────────────────────────────────
//
// Candidates are generated in text order, so capping each bucket by taking the
// first N confined the whole bank to surahs 1–26, with 54% of it from surah 2
// alone — and nothing at all from Juz 30, which is what a beginner memorises
// first. Same mistake as the LIMIT 20000 in the tutor's word lookup: taking the
// head of an ordered list where a spread was needed.
//
// Round-robin over surahs instead. Deterministic, so reruns are reproducible.
const PER_BUCKET = 120;

function spreadAcrossSurahs(items, cap) {
  const queues = new Map();
  for (const e of items) {
    if (!queues.has(e.surah)) queues.set(e.surah, []);
    queues.get(e.surah).push(e);
  }
  const order = [...queues.keys()].sort((a, b) => a - b).map((s) => queues.get(s));
  const out = [];
  let i = 0;
  while (out.length < cap) {
    const live = order.filter((q) => q.length);
    if (!live.length) break;
    out.push(live[i % live.length].shift());
    i += 1;
  }
  return out;
}

const buckets = new Map();
for (const e of exercises) {
  const k = `${e.kind}|${e.level}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(e);
}
const chosen = [];
for (const k of [...buckets.keys()].sort()) {
  const picked = spreadAcrossSurahs(buckets.get(k), PER_BUCKET);
  if (picked.length < PER_BUCKET) {
    log(`               ${k}: only ${picked.length} of ${PER_BUCKET} available`);
  }
  chosen.push(...picked);
}
const byKind = {};
const byLevel = {};
for (const e of chosen) {
  byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  byLevel[e.level] = (byLevel[e.level] ?? 0) + 1;
}
log(`comprehension: ${exercises.length} candidates, ${chosen.length} selected`);
log(`               by kind: ${JSON.stringify(byKind)}`);
log(`               by level: ${JSON.stringify(byLevel)}`);
log(`               surahs covered: ${new Set(chosen.map((e) => e.surah)).size}/114`);

// ── Validate, then refuse ─────────────────────────────────────────────────
//
// Same shape as gen-vocabulary.mjs. Four items shipped with a distractor that was
// also correct, and one with the same Arabic listed twice, because nothing
// inspected the output after it was built — the filters were trusted to be right.
// Assert the properties instead. An item that cannot be answered is worse than a
// missing item, since it teaches the learner that they were wrong when they were
// not.
const defects = [];
for (const e of chosen) {
  const where = e.id;
  if (!e.options.includes(e.answer)) {
    defects.push(`${where}: the answer is not among the options`);
  }
  if (new Set(e.options).size !== e.options.length) {
    defects.push(`${where}: lists the same option twice`);
  }
  if (e.kind === 'word_meaning') {
    const keys = e.options.map(glossKey);
    for (let a = 0; a < keys.length; a += 1) {
      for (let b = a + 1; b < keys.length; b += 1) {
        if (keys[a] && keys[a] === keys[b]) {
          defects.push(
            `${where}: options “${e.options[a]}” and “${e.options[b]}” mean the ` +
              'same thing, so the item has two right answers'
          );
        }
      }
    }
  }
  if (e.options.length < 4) defects.push(`${where}: only ${e.options.length} options`);
}
// Coverage is a property of the whole bank, not of one item. Confining it to the
// front of the text is invisible per-item and obvious in aggregate.
const surahsCovered = new Set(chosen.map((e) => e.surah));
if (surahsCovered.size < 100) {
  defects.push(
    `only ${surahsCovered.size} of 114 surahs are represented — the cap is taking the ` +
      'head of an ordered list again rather than spreading'
  );
}
if (defects.length) {
  for (const d of defects.slice(0, 20)) process.stderr.write(`  ✘ ${d}\n`);
  process.stderr.write(`\n${defects.length} defect(s); refusing to emit.\n`);
  process.exit(1);
}
log(`               ${chosen.length} exercises validated`);

// ── Emit ──────────────────────────────────────────────────────────────────
const q = (v) =>
  v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const out = [];
out.push('-- Generated by scripts/gen-comprehension.mjs — do not edit by hand.');
out.push('-- Word glosses: quran.com v4 word-by-word. https://quran.com');
out.push('DELETE FROM quran_word_gloss;');
for (const w of words) {
  out.push(
    'INSERT OR REPLACE INTO quran_word_gloss (surah_id, ayah_id, position, arabic, transliteration, english) VALUES (' +
      [w.surah, w.ayah, w.position, q(w.arabic), q(w.translit), q(cleanGloss(w.english))].join(', ') +
      ');'
  );
}
out.push("DELETE FROM grammar_exercise_bank WHERE kind IN ('word_meaning','find_word');");
for (const e of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, word_index, segment_index, root) VALUES (' +
      [
        q(e.id), q(e.kind), e.level, q(e.wordArabic), q(e.wordBuckwalter),
        q(e.prompt), q(e.answer), q(JSON.stringify(e.options)), q(e.explanation),
        e.surah, e.ayah, e.word, e.seg, q(e.root),
      ].join(', ') + ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
log(`emitted ${words.length} glosses and ${chosen.length} comprehension exercises`);
