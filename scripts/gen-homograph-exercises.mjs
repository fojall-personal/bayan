#!/usr/bin/env node
/**
 * Homograph exercises: one spelling, two jobs — which one is this?
 *
 *   node scripts/gen-homograph-exercises.mjs > /tmp/homograph.sql
 *   node scripts/gen-homograph-exercises.mjs --check
 *   PER_SENSE=40 node scripts/gen-homograph-exercises.mjs > /tmp/homograph.sql
 *
 * Inputs:
 *   data/quranic-corpus-morphology-0.4.txt (128,219 segments — hand-verified)
 *   data/quran-uthmani.txt                 (6,236 verses — what the learner reads)
 *
 * Attribution, required wherever this surfaces: Quranic Arabic Corpus v0.4
 * (Kais Dukes, GNU GPL). Tanzil Uthmani text, CC-BY.
 *
 * ── Why this kind exists ────────────────────────────────────────────────────
 *
 * Every other kind in the bank asks what a word IS or DOES when the word itself
 * identifies it. This one asks a question you cannot answer from the word at all.
 * مَا is a relative pronoun 1,476 times and a negation 705 times; the letters are
 * identical and the grammar is opposite. Only the surrounding sentence decides,
 * which makes this the first kind in the bank that drills reading rather than
 * recognition — the learner has to parse to answer.
 *
 * Deliberate confusion-pairing is the point, not a side effect. The distractor is
 * never a random other tag: it is the SAME SPELLING in a role it genuinely takes
 * elsewhere in the Quran, so a learner who has merged the two senses is caught.
 *
 * ── Trust ───────────────────────────────────────────────────────────────────
 *
 * Unlike gen-syntax-exercises.mjs, nothing here touches the 95.7%-LAS treebank. The
 * answer is the `pos` tag on a hand-verified morphology segment, so an item can be
 * wrong only if Kais Dukes was wrong. No cross-check against a second source is
 * possible or needed.
 *
 * ── Three filters, each of which drops real candidates ──────────────────────
 *
 * 1. ONE OCCURRENCE PER AYAH. If مَا appears twice in an ayah in two different roles,
 *    the prompt cannot say which one it means — a learner reading "what job does مَا
 *    do here" has two honest answers. 2,958 of 7,480 candidate occurrences are
 *    dropped for this, which is 40%: homographs cluster, and pretending otherwise
 *    would produce items with no determinate answer.
 *
 * 2. SINGLE-SEGMENT WORDS ONLY. A word can carry a prefix (وَمَا, فَلَا), so the
 *    displayed word is not the particle alone. Highlighting it would point at more
 *    than the thing being asked about. Drops a further 1,778.
 *
 * 3. AT LEAST MIN_SENSE CLEAN ITEMS PER SENSE. مَا is attested as SUP 21 times, but
 *    only 5 survive the filters above — too few to sample across surahs, and a sense
 *    the learner meets almost never is noise in a drill about the common confusion.
 *    Senses below the floor are dropped from the option list too, so the options a
 *    learner sees are always senses this generator can actually quiz.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');
const CHECK = process.argv.includes('--check');

/** Clean items a sense needs before it is quizzable. See filter 3. */
const MIN_SENSE = 8;
/** Cap per (lemma, pos), spread across surahs rather than taking the first N. */
const PER_SENSE = Number(process.env.PER_SENSE ?? 40);

const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';
const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
const corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');

for (const [name, buf, want] of [
  ['text', textRaw, TEXT_SHA],
  ['corpus', corpusRaw, CORPUS_SHA],
]) {
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch\n  expected ${want}\n  got      ${got}`);
    process.exit(3);
  }
}
log('inputs verified by checksum');

// ── The mushaf text, word by word ──────────────────────────────────────────
//
// Displayed rather than reassembled from Buckwalter, matching gen-syntax-exercises.
const ayahWords = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahWords.set(`${+p[0]}:${+p[1]}`, p[2].trim().split(/\s+/));
}

// ── The morphology ─────────────────────────────────────────────────────────
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
/** How many segments each WORD has. A word with more than one carries a prefix. */
const segmentsPerWord = new Map();
/** Unrooted occurrences: the function words, which is all a homograph can be here. */
const occurrences = [];

for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  const [surah, ayah, word, seg] = [+m[1], +m[2], +m[3], +m[4]];
  const wordKey = `${surah}:${ayah}:${word}`;
  segmentsPerWord.set(wordKey, (segmentsPerWord.get(wordKey) ?? 0) + 1);
  // A homograph of interest carries no root: these are particles and pronouns.
  if (p[3].includes('ROOT:')) continue;
  const lemma = p[3].match(/LEM:([^|]+)/)?.[1]?.trim();
  if (!lemma) continue;
  occurrences.push({ surah, ayah, word, seg, lemma, pos: p[2], wordKey });
}

// ── Which lemmas are homographs at all ─────────────────────────────────────
//
// Derived, not hardcoded. A hardcoded list is a list that silently stops matching the
// corpus; this way a change in the data shows up as a change in the manifest.
const sensesByLemma = new Map();
for (const o of occurrences) {
  if (!sensesByLemma.has(o.lemma)) sensesByLemma.set(o.lemma, new Map());
  const s = sensesByLemma.get(o.lemma);
  s.set(o.pos, (s.get(o.pos) ?? 0) + 1);
}
/** Attested in 2+ roles, with the minority role appearing at least 20 times. */
const families = [...sensesByLemma.entries()]
  .filter(([, s]) => s.size >= 2 && Math.min(...s.values()) >= 20)
  .map(([lemma]) => lemma)
  .sort();

if (families.length === 0) {
  log('REFUSING: no homograph families found — the corpus or the parse changed');
  process.exit(3);
}
log(`homograph families: ${families.length} — ${families.join(', ')}`);

// ── Filter 1: one occurrence of this lemma per ayah ────────────────────────
const perAyahLemma = new Map();
for (const o of occurrences) {
  if (!families.includes(o.lemma)) continue;
  const k = `${o.surah}:${o.ayah}:${o.lemma}`;
  perAyahLemma.set(k, (perAyahLemma.get(k) ?? 0) + 1);
}

let droppedAmbiguous = 0;
let droppedPrefixed = 0;
const clean = [];
for (const o of occurrences) {
  if (!families.includes(o.lemma)) continue;
  if (perAyahLemma.get(`${o.surah}:${o.ayah}:${o.lemma}`) > 1) { droppedAmbiguous += 1; continue; }
  // Filter 2: the word must BE the particle, not carry it as a prefix.
  if (segmentsPerWord.get(o.wordKey) !== 1) { droppedPrefixed += 1; continue; }
  const words = ayahWords.get(`${o.surah}:${o.ayah}`);
  if (!words || o.word > words.length) continue;
  clean.push({ ...o, wordArabic: words[o.word - 1], words });
}
log(`candidates: ${clean.length} clean — dropped ${droppedAmbiguous} ambiguous, ${droppedPrefixed} prefixed`);

// ── Filter 3: senses with enough clean items to quiz ───────────────────────
const cleanBySense = new Map();
for (const c of clean) {
  const k = `${c.lemma}\u0000${c.pos}`;
  cleanBySense.set(k, (cleanBySense.get(k) ?? 0) + 1);
}
/** Quizzable senses per lemma, commonest first. Also the option list a learner sees. */
const quizzable = new Map();
for (const lemma of families) {
  const senses = [...sensesByLemma.get(lemma).keys()]
    .filter((pos) => (cleanBySense.get(`${lemma}\u0000${pos}`) ?? 0) >= MIN_SENSE)
    .sort((a, b) => (cleanBySense.get(`${lemma}\u0000${b}`) ?? 0) - (cleanBySense.get(`${lemma}\u0000${a}`) ?? 0));
  // A homograph question needs at least two live senses; one is not a confusion.
  if (senses.length >= 2) quizzable.set(lemma, senses);
}
for (const lemma of families) {
  if (!quizzable.has(lemma)) log(`  ${lemma}: dropped — fewer than 2 senses with ${MIN_SENSE}+ clean items`);
}

/**
 * What each tag means, in the words a learner would use.
 *
 * The raw values are corpus abbreviations and belong nowhere near a learner. Only tags
 * that actually occur on a quizzable sense are listed; an unmapped tag is a hard error
 * rather than a raw abbreviation leaking into an option list.
 */
const ROLE = {
  REL: 'a relative pronoun ("that which", "who")',
  NEG: 'a negation ("not")',
  INTG: 'a question word ("what?", "who?")',
  COND: 'a conditional ("if", "whoever")',
  SUB: 'a subordinating conjunction ("that")',
  PRO: 'a prohibition ("do not")',
  INT: 'an explanatory particle ("namely")',
  P: 'a preposition ("until", "up to")',
  INC: 'an inceptive particle — it starts a new clause',
  EXH: 'an exhortation ("if only", "why not")',
  SUP: 'a supplemental particle',
  PREV: 'a preventive particle — it stops the word before it governing',
};
const missingRoles = new Set();
for (const [, senses] of quizzable) for (const s of senses) if (!ROLE[s]) missingRoles.add(s);
if (missingRoles.size) {
  log(`REFUSING: no learner-facing wording for tag(s): ${[...missingRoles].join(', ')}`);
  process.exit(3);
}

/** Difficulty: how evenly the senses split. A 50/50 lemma is harder than a 95/5 one. */
function levelFor(lemma, pos) {
  const senses = quizzable.get(lemma);
  const counts = senses.map((s) => cleanBySense.get(`${lemma}\u0000${s}`) ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const share = (cleanBySense.get(`${lemma}\u0000${pos}`) ?? 0) / total;
  // The rare sense of a lopsided pair is the hardest thing here: it is the one a
  // learner has never had reason to notice.
  if (share <= 0.1) return 5;
  if (share <= 0.25) return 4;
  if (senses.length >= 3) return 4;
  return 3;
}

/**
 * 32-bit avalanche mix (splitmix32 finalizer).
 *
 * `Math.imul` rather than `*` because the intermediate products exceed 2^53 and plain
 * multiplication silently loses the low bits — which are the only bits that matter
 * once you take a modulus.
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

// ── Build the items ────────────────────────────────────────────────────────
const items = [];
for (const c of clean) {
  const senses = quizzable.get(c.lemma);
  if (!senses || !senses.includes(c.pos)) continue;

  // Options: the correct sense plus the commonest others, capped at 4. Every option
  // is a role THIS spelling genuinely takes, which is what makes it a homograph drill
  // rather than a vocabulary question with random foils.
  const others = senses.filter((s) => s !== c.pos).slice(0, 3);
  // Deterministic shuffle, keyed on the item's own location. Random ordering would
  // make the generator non-reproducible and break --check; leaving the answer first
  // would teach position instead of grammar.
  //
  // The seed is passed through an avalanche mix (splitmix32) rather than used raw.
  // The first attempt here was `j = (seed * (i + 7)) % (i + 1)`, which looks like a
  // Fisher-Yates and is not: on the last step i=1, `seed * 8` is always even, so j is
  // always 0 and positions 0 and 1 are ALWAYS swapped. Measured over the real corpus
  // that put the answer at position 1 in every two-option item — a learner could have
  // scored 100% on those without reading the ayah. Low bits of a linear seed are not
  // random; mixing them is the whole job.
  const ordered = [c.pos, ...others];
  const seed = c.surah * 1000003 + c.ayah * 1009 + c.word;
  for (let i = ordered.length - 1; i > 0; i -= 1) {
    const j = mix32(seed + i * 0x9e3779b9) % (i + 1);
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  const options = ordered.map((s) => ROLE[s]);
  if (options.length < 2) continue;

  // The ayah with the target word marked. The learner needs the sentence — that is
  // the entire skill — and needs to know which occurrence is being asked about.
  const marked = c.words
    .map((w, i) => (i === c.word - 1 ? `⟪${w}⟫` : w))
    .join(' ');

  items.push({
    id: `hom-${c.surah}-${c.ayah}-${c.word}`,
    kind: 'homograph',
    level: levelFor(c.lemma, c.pos),
    lemma: c.lemma,
    pos: c.pos,
    wordArabic: c.wordArabic,
    surah: c.surah,
    ayah: c.ayah,
    word: c.word,
    seg: c.seg,
    prompt: `In this ayah, what job does ⟪${c.wordArabic}⟫ do?\n\n${marked}`,
    answer: ROLE[c.pos],
    options,
    explanation:
      `Here ${c.wordArabic} is ${ROLE[c.pos]}. The same spelling is also ` +
      `${others.map((s) => ROLE[s]).join(', or ')} elsewhere in the Quran — only the ` +
      `sentence tells you which. Quranic Arabic Corpus v0.4 (${c.surah}:${c.ayah}).`,
  });
}

// ── Select: spread across surahs, not the first N ──────────────────────────
//
// Taking the first PER_SENSE rows would draw مَا/REL almost entirely from al-Baqarah.
// Round-robin by surah gives the learner the particle in varied contexts, which is the
// only way the drill teaches reading rather than one surah's habits.
function spreadAcrossSurahs(rows, cap) {
  const bySurah = new Map();
  for (const r of rows) {
    if (!bySurah.has(r.surah)) bySurah.set(r.surah, []);
    bySurah.get(r.surah).push(r);
  }
  const queues = [...bySurah.keys()].sort((a, b) => a - b).map((s) => bySurah.get(s));
  const out = [];
  let i = 0;
  while (out.length < cap && queues.some((q) => q.length)) {
    const q = queues[i % queues.length];
    if (q.length) out.push(q.shift());
    i += 1;
  }
  return out;
}

const bySense = new Map();
for (const it of items) {
  const k = `${it.lemma}\u0000${it.pos}`;
  if (!bySense.has(k)) bySense.set(k, []);
  bySense.get(k).push(it);
}
const chosen = [];
for (const k of [...bySense.keys()].sort()) {
  chosen.push(...spreadAcrossSurahs(bySense.get(k), PER_SENSE));
}
chosen.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah || a.word - b.word);

// ── Self-checks. A defect here means emitting nothing. ─────────────────────
const defects = [];
const seenIds = new Set();
for (const it of chosen) {
  if (seenIds.has(it.id)) defects.push(`duplicate id ${it.id}`);
  seenIds.add(it.id);
  if (!it.options.includes(it.answer)) defects.push(`${it.id}: answer not among options`);
  if (new Set(it.options).size !== it.options.length) defects.push(`${it.id}: duplicate options`);
  if (it.options.length < 2 || it.options.length > 4) defects.push(`${it.id}: ${it.options.length} options`);
  if (!it.wordArabic || !/[\u0600-\u06FF]/.test(it.wordArabic)) defects.push(`${it.id}: no Arabic in word`);
  if (!it.explanation.trim()) defects.push(`${it.id}: empty explanation`);
}
// Answer-position bias, checked per option-count.
//
// The original check only caught "the answer is ALWAYS first", which a broken shuffle
// walked straight past: it put the answer always SECOND instead. Any position that
// holds more than 60% of the answers for a given option-count is the same defect
// wearing a different hat — a learner can score without reading.
const byWidth = new Map();
for (const it of chosen) {
  const w = it.options.length;
  if (!byWidth.has(w)) byWidth.set(w, []);
  byWidth.get(w).push(it.options.indexOf(it.answer));
}
for (const [width, positions] of [...byWidth.entries()].sort()) {
  const counts = new Array(width).fill(0);
  for (const p of positions) counts[p] += 1;
  const worst = Math.max(...counts);
  const share = worst / positions.length;
  log(`  ${width}-option items: answer position spread ${counts.join('/')} (n=${positions.length})`);
  if (positions.length >= 20 && share > 0.6) {
    defects.push(
      `${width}-option items put the answer at one position ${(share * 100).toFixed(0)}% ` +
        `of the time (${counts.join('/')}) — the shuffle is biased`
    );
  }
}
if (defects.length) {
  log(`\n${defects.length} defect(s); refusing to emit.`);
  for (const d of defects.slice(0, 20)) log(`  ${d}`);
  process.exit(3);
}

const byKindSense = {};
for (const it of chosen) byKindSense[`${it.lemma}/${it.pos}`] = (byKindSense[`${it.lemma}/${it.pos}`] ?? 0) + 1;
log(`\nselected ${chosen.length} of ${items.length} items across ${Object.keys(byKindSense).length} senses`);
log(`  ${JSON.stringify(byKindSense)}`);
log(`  ${new Set(chosen.map((c) => c.surah)).size} surahs`);

// ── --check: compare against what is in the database ───────────────────────
if (CHECK) {
  const { DatabaseSync } = await import('node:sqlite');
  const { existsSync, readdirSync } = await import('node:fs');
  const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  if (!existsSync(dir)) {
    // Stated, not passed silently — the convention this repo already uses for
    // check-content and gen-root-lessons on a CI runner without the data.
    log('SKIPPED the database comparison: no local D1 (.wrangler is gitignored).');
    log('✅ structural checks passed; the DB comparison was NOT run.');
    process.exit(0);
  }
  const file = readdirSync(dir).find((f) => f.endsWith('.sqlite') && !f.includes('metadata'));
  const db = new DatabaseSync(join(dir, file));
  const row = db.prepare("SELECT COUNT(*) AS n FROM grammar_exercise_bank WHERE kind = 'homograph'").get();
  db.close();
  if (row.n !== chosen.length) {
    log(`✘ database holds ${row.n} homograph items; the generator produces ${chosen.length}.`);
    log('  Run: node scripts/gen-homograph-exercises.mjs > /tmp/homograph.sql and reseed.');
    process.exit(1);
  }
  log(`✅ database matches the generator (${row.n} homograph items)`);
  process.exit(0);
}

// ── Emit ───────────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Generated by scripts/gen-homograph-exercises.mjs. Do not edit.'];
out.push('-- Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL). Tanzil Uthmani text, CC-BY.');
out.push("DELETE FROM grammar_exercise_bank WHERE kind = 'homograph';");
for (const it of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, ' +
      'word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, ' +
      'word_index, segment_index, root) VALUES (' +
      [
        q(it.id), q(it.kind), it.level, q(it.wordArabic), q(it.lemma),
        q(it.prompt), q(it.answer), q(JSON.stringify(it.options)), q(it.explanation),
        it.surah, it.ayah, it.word, it.seg, 'NULL',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
