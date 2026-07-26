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
  const pool = (bySurah.get(w.surah) ?? []).filter((o) => {
    const g = cleanGloss(o.english);
    return g !== answer && g.toLowerCase() !== answer.toLowerCase();
  });
  if (pool.length < 3) continue;
  const seed = `wm${w.surah}:${w.ayah}:${w.position}`;
  const picks = [];
  for (const cand of seededShuffle(pool, seed)) {
    const g = cleanGloss(cand.english);
    if (picks.some((p) => p.toLowerCase() === g.toLowerCase())) continue;
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
  // Skip ayahs where two words share a gloss — the question would be ambiguous.
  const glosses = teachable.map((w) => cleanGloss(w.english).toLowerCase());
  if (new Set(glosses).size !== glosses.length) continue;

  const [su, ay] = key.split(':').map(Number);
  const target = teachable[0];
  const others = teachable.filter((w) => w !== target).slice(0, 3);
  if (others.length < 3) continue;
  const seed = `fw${key}`;
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
const PER_BUCKET = 120;
const seen = new Map();
const chosen = [];
for (const e of exercises) {
  const k = `${e.kind}|${e.level}`;
  const n = seen.get(k) ?? 0;
  if (n >= PER_BUCKET) continue;
  seen.set(k, n + 1);
  chosen.push(e);
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
