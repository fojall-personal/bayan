#!/usr/bin/env node
/**
 * Exercises about what a word DOES, from the Extended Quranic Treebank.
 *
 *   node scripts/gen-syntax-exercises.mjs > /tmp/syntax.sql
 *   PER_BUCKET=600 node scripts/gen-syntax-exercises.mjs > /tmp/syntax.sql
 *
 * Inputs:
 *   data/quranic-treebank-eqtb.csv         (139,376 rows — the syntax layer)
 *   data/quranic-corpus-morphology-0.4.txt (128,219 segments — hand-verified)
 *   data/quran-uthmani.txt                 (6,236 verses — what the learner reads)
 *
 * Attribution, required wherever this surfaces: Extended Quranic Treebank, Nashir et al.,
 * Data in Brief 62:111940 (2025), doi:10.1016/j.dib.2025.111940, CC BY 4.0. Quranic Arabic
 * Corpus v0.4 (Kais Dukes, GNU GPL). Tanzil text, CC-BY.
 *
 * ── Separate from gen-derived-content.mjs on purpose ────────────────────────
 *
 * Every kind there is derived from HAND-VERIFIED morphology: an item can be wrong only if
 * Kais Dukes was wrong. Every kind here depends on a layer whose parser reports 95.7% LAS,
 * which is a different tier of trust and deserves a file whose header says so rather than
 * a section buried in a larger one. gen-comprehension.mjs is split off for the same
 * reason — it derives from glosses, not morphology.
 *
 * ── The rule that makes a 95.7% layer safe to teach from ────────────────────
 *
 * Nothing is emitted on the treebank's word alone. Traditional grammar fixes the case each
 * role takes — فاعل nominative, مفعول به accusative, مضاف إليه genitive, خبر nominative —
 * and case is read from the morphology, which the parser did not produce. So a candidate
 * survives only where the two AGREE, and the disagreements are discarded rather than
 * resolved in favour of either.
 *
 * That filter is not cosmetic. It rejects 0.9% of Subj, 1.7% of Pred, 3.8% of Poss and
 * 7.3% of Obj candidates. Whether each rejection is a parser error or a real grammatical
 * exception is exactly what this script cannot decide, which is why it drops them both.
 *
 * A learner therefore never sees an item whose answer rests on the parser being right, and
 * `scripts/ingest-treebank.mjs` refuses to load a release where the concurrence has
 * dropped. Two independent sources, both of which must say the same thing.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const TREEBANK_SHA = '38c82933b41bff10dfd65c26a71e1ac7e424a7142b3520ca5541cfea012818e1';
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';
const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';

const tbRaw = await readFile(join(root, 'data/quranic-treebank-eqtb.csv'));
const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');
const corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');

for (const [name, buf, want] of [
  ['treebank', tbRaw, TREEBANK_SHA],
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
// Displayed rather than reassembled from Buckwalter. The treebank's word_id counts
// space-separated words of this text, verified: 2:2 has 7 words in both.
const ayahWords = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahWords.set(`${+p[0]}:${+p[1]}`, p[2].trim().split(/\s+/));
}

// ── Hand-verified case and form frequency, from the morphology ─────────────
const caseByLoc = new Map();
const formFreq = new Map();
const formByLoc = new Map();
const lemmaByLoc = new Map();
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const m = LOCATION.exec(p[0].trim());
  if (!m) continue;
  const loc = `${+m[1]}:${+m[2]}:${+m[3]}:${+m[4]}`;
  const kase = ['NOM', 'ACC', 'GEN'].find((k) => p[3].includes(k)) ?? null;
  if (kase) caseByLoc.set(loc, kase);
  const lemma = p[3].match(/LEM:([^|]+)/)?.[1]?.trim() ?? null;
  if (lemma) lemmaByLoc.set(loc, lemma);
  formByLoc.set(loc, p[1]);
  formFreq.set(p[1], (formFreq.get(p[1]) ?? 0) + 1);
}

/**
 * Difficulty from how common the word is, identical to the other generators so that
 * "level 3" denotes one thing across all of them.
 */
const levelFromFreq = (n) => (n >= 300 ? 1 : n >= 120 ? 2 : n >= 50 ? 3 : n >= 15 ? 4 : 5);
const levelFor = (loc) => levelFromFreq((formFreq.get(formByLoc.get(loc)) ?? 0) * 6);

// ── The treebank ───────────────────────────────────────────────────────────
const tbText = tbRaw.toString('utf16le').replace(/^﻿/, '');
const tbLines = tbText.split(/\r?\n/).filter(Boolean);
const HEAD = tbLines[0].split('\t');
const cx = (n) => {
  const i = HEAD.indexOf(n);
  if (i < 0) {
    log(`REFUSING: treebank column "${n}" is missing`);
    process.exit(3);
  }
  return i;
};
const C = {
  sentence: cx('sentence_id'), token: cx('token_id'), head: cx('ref_token_id'),
  surah: cx('chapter_id'), ayah: cx('verse_id'), word: cx('word_id'), seg: cx('tok_id'),
  rel: cx('rel_label'), derived: cx('derived_nouns'), pos: cx('pos'),
};
const tokens = tbLines.slice(1).map((l) => l.split('\t'));
const blank = (v) => !v || v === '_' || v === '-';

/** Sentence-local. Joining these globally names a word in surah 7 as the head of one in 2:87. */
const byKey = new Map();
for (const t of tokens) byKey.set(`${t[C.sentence]}#${t[C.token]}`, t);
const headOf = (t) => byKey.get(`${t[C.sentence]}#${t[C.head]}`);

const real = tokens.filter((t) => Number(t[C.word]) >= 1);
const locOf = (t) => `${t[C.surah]}:${t[C.ayah]}:${t[C.word]}:${t[C.seg]}`;
const ayahOf = (t) => `${t[C.surah]}:${t[C.ayah]}`;

/**
 * Every ROLE a given word plays, across all its segments.
 *
 * Needed to exclude distractors: a question asking which word is the خبر must not offer a
 * second خبر as a wrong answer. gen-derived-content.mjs learnt this the same way — without
 * the exclusion an item can have two right answers, which is worse than having too few
 * options because the learner is told a correct answer was wrong.
 */
const rolesByWord = new Map();
for (const t of real) {
  const k = `${t[C.surah]}:${t[C.ayah]}:${t[C.word]}`;
  if (!rolesByWord.has(k)) rolesByWord.set(k, new Set());
  if (!blank(t[C.rel])) rolesByWord.get(k).add(t[C.rel]);
  if (!blank(t[C.derived])) rolesByWord.get(k).add(`d:${t[C.derived]}`);
}

/** Deterministic, so regenerating does not churn the bank. */
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

const exercises = [];
const seen = new Set();
/** Long ayat are a wall of text when the question concerns one word. */
const MAX_AYAH_WORDS = 14;

/**
 * Locate-the-role kinds: show the ayah, ask which word fills a grammatical role.
 *
 * @param kind      bank kind
 * @param rel       treebank relation
 * @param wantCase  the case traditional grammar requires of that role — the second source
 * @param prompt    (surah, ayah) => question
 * @param explain   (word, surah, ayah) => explanation
 */
function addRoleKind(kind, rel, wantCase, prompt, explain) {
  let candidates = 0;
  let rejectedByCase = 0;
  let emitted = 0;
  for (const t of real) {
    if (t[C.rel] !== rel) continue;
    candidates += 1;
    // THE filter. Case comes from the hand-verified morphology; the relation from a
    // 95.7%-accurate parser. Only where they agree does an item exist.
    if (caseByLoc.get(locOf(t)) !== wantCase) {
      rejectedByCase += 1;
      continue;
    }
    const words = ayahWords.get(ayahOf(t));
    if (!words || words.length > MAX_AYAH_WORDS) continue;
    const answer = words[Number(t[C.word]) - 1];
    if (!answer) continue;

    const key = `${kind}|${ayahOf(t)}|${t[C.word]}`;
    if (seen.has(key)) continue;

    const seenForm = new Set([answer]);
    const foils = [];
    for (let i = 0; i < words.length; i += 1) {
      const wi = i + 1;
      if (wi === Number(t[C.word])) continue;
      if (rolesByWord.get(`${ayahOf(t)}:${wi}`)?.has(rel)) continue; // two right answers
      if (seenForm.has(words[i])) continue;
      seenForm.add(words[i]);
      foils.push(words[i]);
    }
    if (foils.length < 3) continue;
    const picks = seededShuffle(foils, `${kind}${ayahOf(t)}${t[C.word]}`).slice(0, 3);

    seen.add(key);
    emitted += 1;
    exercises.push({
      id: `${kind}-${t[C.surah]}-${t[C.ayah]}-${t[C.word]}`,
      kind,
      level: levelFor(locOf(t)),
      wordArabic: words.join(' '),
      prompt: prompt(t[C.surah], t[C.ayah]),
      answer,
      options: seededShuffle([answer, ...picks], `${kind}o${ayahOf(t)}${t[C.word]}`),
      explanation: explain(answer, t[C.surah], t[C.ayah]),
      surah: Number(t[C.surah]),
      ayah: Number(t[C.ayah]),
      word: Number(t[C.word]),
    });
  }
  log(
    `${kind.padEnd(16)} ${String(emitted).padStart(5)} emitted — ` +
      `${candidates} candidates, ${rejectedByCase} dropped where case disagreed`
  );
}

addRoleKind(
  'mubtada_khabar',
  'Pred',
  'NOM',
  (su, ay) => `Which word is the predicate (خبر) in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} is the خبر of ${su}:${ay} — what the sentence asserts about its subject. The ` +
    'treebank marks it Pred and the morphology marks it nominative (مرفوع), which is the ' +
    'case a خبر takes; both had to agree for this question to exist.'
);
addRoleKind(
  'subject_word',
  'Subj',
  'NOM',
  (su, ay) => `Which word is the doer (فاعل) in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} is the فاعل of ${su}:${ay} — the one performing the verb. Marked Subj in the ` +
    'treebank and nominative (مرفوع) in the morphology, the case a فاعل always takes.'
);
addRoleKind(
  'object',
  'Obj',
  'ACC',
  (su, ay) => `Which word is the object (مفعول به) in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} is the مفعول به of ${su}:${ay} — what the verb is done to. Marked Obj in the ` +
    'treebank and accusative (منصوب) in the morphology, the case an object takes.'
);
addRoleKind(
  'idafa',
  'Poss',
  'GEN',
  (su, ay) => `In ${su}:${ay}, which word is the مضاف إليه — the possessor?`,
  (w, su, ay) =>
    `${w} is the مضاف إليه in ${su}:${ay}: the second half of an إضافة, which is why it ` +
    'is genitive (مجرور). The treebank marks the relation and the morphology the case.'
);

// ── Derived nouns — sarf, and nothing here could ask it before ─────────────
//
// Three options, not four, for the same reason `mood` has three: اسم فاعل, اسم مفعول and
// مصدر are what the annotation distinguishes, so a fourth would have to be invented.
//
// No case cross-check is possible — a derived noun takes whatever case its position gives
// it — so the second source here is the MORPHOLOGY's own part of speech: the word must be
// tagged a noun. That is weaker than the case check, and it is the reason this kind asks
// about the word's FORM (which the pattern shows on its face: مُفْعِل versus مُفْعَل) rather
// than about a syntactic role the parser inferred.
const DERIVED_LABEL = {
  ACT_PCPL: 'Active participle (اسم فاعل) — the one doing it',
  PASS_PCPL: 'Passive participle (اسم مفعول) — the one it is done to',
  VN: 'Verbal noun (مصدر) — the act itself',
};
{
  let emitted = 0;
  let rejected = 0;
  for (const t of real) {
    const d = t[C.derived];
    if (blank(d) || !DERIVED_LABEL[d]) continue;
    if (t[C.pos] !== 'N') {
      rejected += 1;
      continue;
    }
    const words = ayahWords.get(ayahOf(t));
    if (!words) continue;
    const word = words[Number(t[C.word]) - 1];
    if (!word) continue;
    const key = `derived_noun|${ayahOf(t)}|${t[C.word]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    emitted += 1;
    exercises.push({
      id: `derived_noun-${t[C.surah]}-${t[C.ayah]}-${t[C.word]}`,
      kind: 'derived_noun',
      level: levelFor(locOf(t)),
      wordArabic: word,
      prompt: `${word} is derived from a verb. Which kind of derived noun is it?`,
      answer: DERIVED_LABEL[d],
      options: seededShuffle(Object.values(DERIVED_LABEL), `dn${ayahOf(t)}${t[C.word]}`),
      explanation:
        `${word} at ${t[C.surah]}:${t[C.ayah]} is tagged ${d} — ` +
        `${DERIVED_LABEL[d].toLowerCase()}. All three are built from a root by a fixed ` +
        'pattern, which is what makes them recognisable without knowing the word.',
      surah: Number(t[C.surah]),
      ayah: Number(t[C.ayah]),
      word: Number(t[C.word]),
    });
  }
  log(`derived_noun      ${String(emitted).padStart(5)} emitted — ${rejected} dropped, not tagged a noun`);
}

// ── Fronting — the one rhetorical device a treebank can see ────────────────
//
// ʿilm al-maʿānī, the branch of balagha concerned with word order, emphasis and ellipsis.
// Arabic default order puts the verb before its object and the subject before its
// predicate; a departure is تقديم, and it is done for a reason — most often exclusivity.
//
// Derivable precisely because it is STRUCTURAL. Nothing here claims what the fronting
// MEANS in a given ayah: that is interpretation, and no annotation supplies it. The
// question is which word was moved, which the dependency direction settles.
//
// This is the whole of what Bayan can honestly offer for balagha. Simile, metaphor and
// wordplay need a source that annotates them, and the published Quranic rhetoric corpus
// covers Surah Ibrahim verses 1–2 — 41 words.
/**
 * إيّا — the detached object pronoun, and the reason case is not the only second source.
 *
 * The case cross-check cannot see إيّاكَ: the morphology marks no case on any pronoun, so
 * 1:5 إِيَّاكَ نَعْبُدُ — the example every balagha course opens with — was dropped by the
 * filter along with 121 others, leaving 18 items.
 *
 * The rule is "two independent sources must agree", not "case must agree", and for this
 * family the morphology attests something stronger than a case: إيّا exists ONLY as a
 * detached object pronoun. Its lemma therefore confirms the parser's Obj by itself, and
 * confirms it more firmly than an accusative ending would, since a lemma is not a reading
 * of a diacritic. Attached pronouns cannot be fronted at all, being suffixes, so this
 * family is the whole of the exception.
 */
const DETACHED_OBJECT_PRONOUN = '<iy~aA';
{
  let emitted = 0;
  const dropped = { order: 0, headPos: 0, case: 0, length: 0, foils: 0 };
  for (const t of real) {
    const rel = t[C.rel];
    if (rel !== 'Obj' && rel !== 'Pred') continue;
    const h = headOf(t);
    if (!h || h === t) continue;
    // Fronted means it precedes what it depends on. Order is read off the text, not
    // inferred — it is the one part of this that needs no corroboration.
    if (Number(t[C.token]) >= Number(h[C.token])) {
      dropped.order += 1;
      continue;
    }
    // An object is fronted past its VERB; a predicate past its subject. Requiring the
    // head's part of speech keeps this to the two constructions grammarians name.
    if (rel === 'Obj' && h[C.pos] !== 'V') {
      dropped.headPos += 1;
      continue;
    }
    const wantCase = rel === 'Obj' ? 'ACC' : 'NOM';
    const corroborated =
      caseByLoc.get(locOf(t)) === wantCase ||
      (rel === 'Obj' && lemmaByLoc.get(locOf(t)) === DETACHED_OBJECT_PRONOUN);
    if (!corroborated) {
      dropped.case += 1;
      continue;
    }

    const words = ayahWords.get(ayahOf(t));
    if (!words || words.length > MAX_AYAH_WORDS) {
      dropped.length += 1;
      continue;
    }
    const answer = words[Number(t[C.word]) - 1];
    const headWord = words[Number(h[C.word]) - 1];
    if (!answer || !headWord) continue;

    const key = `fronting|${ayahOf(t)}|${t[C.word]}`;
    if (seen.has(key)) continue;

    const seenForm = new Set([answer]);
    const foils = [];
    for (let i = 0; i < words.length; i += 1) {
      const wi = i + 1;
      if (wi === Number(t[C.word])) continue;
      if (rolesByWord.get(`${ayahOf(t)}:${wi}`)?.has(rel)) continue;
      if (seenForm.has(words[i])) continue;
      seenForm.add(words[i]);
      foils.push(words[i]);
    }
    /**
     * Three options are allowed here, where every other locate-a-word kind needs four.
     *
     * Fronting happens in short, emphatic ayat, and the fronted element is often repeated —
     * so the ayah cannot supply four DISTINCT words that are not themselves the same role.
     * 1:5 إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ is exactly this: four words, of which the second
     * إيّاك is also an object and must be excluded, leaving two distractors. Requiring four
     * dropped the single example every course on balagha opens with.
     *
     * Cheap, because the remaining options are the ayah's real words either way: a learner
     * still has to find which one moved.
     */
    if (foils.length < 2) {
      dropped.foils += 1;
      continue;
    }
    seen.add(key);
    emitted += 1;
    exercises.push({
      id: `fronting-${t[C.surah]}-${t[C.ayah]}-${t[C.word]}`,
      kind: 'fronting',
      level: levelFor(locOf(t)),
      wordArabic: words.join(' '),
      prompt: `In ${t[C.surah]}:${t[C.ayah]} the usual word order is broken. Which word has been brought forward (تقديم)?`,
      answer,
      options: seededShuffle(
        [answer, ...seededShuffle(foils, `fr${ayahOf(t)}`).slice(0, 3)],
        `fro${ayahOf(t)}${t[C.word]}`
      ),
      explanation:
        `${answer} stands before ${headWord}, which it depends on. Arabic normally puts ` +
        `${rel === 'Obj' ? 'the verb before its object' : 'the subject before its predicate'}` +
        `, so ${answer} has been fronted — تقديم. Grammarians read the fronting as ` +
        'emphasis or exclusivity; which of those applies here is interpretation, and this ' +
        'question asks only what moved.',
      surah: Number(t[C.surah]),
      ayah: Number(t[C.ayah]),
      word: Number(t[C.word]),
    });
  }
  // Reported per reason, because "18 items" invites a hunt for a bug that is not there.
  // Fronting is RARE — it is a departure from the default order — so a small number is the
  // finding, and this line says which filter each rejection met.
  log(
    `fronting          ${String(emitted).padStart(5)} emitted — dropped: ` +
      `${dropped.order} not fronted, ${dropped.headPos} head not a verb, ` +
      `${dropped.case} uncorroborated, ${dropped.length} ayah too long, ` +
      `${dropped.foils} too few distractors`
  );
}

// ── Validate, then refuse ──────────────────────────────────────────────────
const defects = [];
for (const e of exercises) {
  if (!e.options.includes(e.answer)) defects.push(`${e.id}: answer is not among its options`);
  if (new Set(e.options).size !== e.options.length) defects.push(`${e.id}: repeated option`);
  // derived_noun is legitimately three-way — those are the categories the annotation has.
  // fronting can be, because the ayat that front are short; see the note at its foil check.
  const min = e.kind === 'derived_noun' || e.kind === 'fronting' ? 3 : 4;
  if (e.options.length < min) defects.push(`${e.id}: ${e.options.length} options, expected ${min}`);
  if (!e.explanation || e.explanation.length < 40) defects.push(`${e.id}: no real explanation`);
  if (!e.wordArabic) defects.push(`${e.id}: nothing to display`);
}
if (defects.length) {
  for (const d of defects.slice(0, 15)) log(`  ✘ ${d}`);
  log(`\n${defects.length} defect(s); refusing to emit.`);
  process.exit(3);
}

// ── Cap per (kind, level), spread across surahs ────────────────────────────
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 150);
function spreadAcrossSurahs(items, cap) {
  const queues = new Map();
  for (const e of items) {
    if (!queues.has(e.surah)) queues.set(e.surah, []);
    queues.get(e.surah).push(e);
  }
  const order = [...queues.keys()].sort((a, b) => a - b).map((k) => queues.get(k));
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
  chosen.push(...spreadAcrossSurahs(buckets.get(k), PER_BUCKET));
}

const kinds = [...new Set(chosen.map((e) => e.kind))].sort();
const byKind = {};
for (const e of chosen) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
log(`\nselected ${chosen.length} of ${exercises.length} across ${kinds.length} kinds`);
log(`  by kind: ${JSON.stringify(byKind)}`);
const surahs = new Set(chosen.map((e) => e.surah)).size;
log(`  ${buckets.size} buckets, ${surahs} surahs`);

// ── Emit ───────────────────────────────────────────────────────────────────
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const out = ['-- Generated by scripts/gen-syntax-exercises.mjs. Do not edit.'];
out.push('-- Extended Quranic Treebank, Nashir et al. 2025, doi:10.1016/j.dib.2025.111940 (CC BY 4.0).');
// Derived from the kinds actually emitted, so a removed kind clears its rows instead of
// leaving them behind for a filter that no longer produces anything.
out.push(`DELETE FROM grammar_exercise_bank WHERE kind IN (${kinds.map(q).join(',')});`);
for (const e of chosen) {
  out.push(
    'INSERT OR REPLACE INTO grammar_exercise_bank (id, kind, level, word_arabic, ' +
      'word_buckwalter, prompt, answer, options, explanation, surah_id, ayah_id, ' +
      'word_index, segment_index, root) VALUES (' +
      [
        q(e.id), q(e.kind), e.level, q(e.wordArabic), q(''),
        q(e.prompt), q(e.answer), q(JSON.stringify(e.options)), q(e.explanation),
        e.surah, e.ayah, e.word, 1, 'NULL',
      ].join(', ') +
      ');'
  );
}
process.stdout.write(out.join('\n') + '\n');
