#!/usr/bin/env node
/**
 * Generate the derived grammar exercise bank and memorization curriculum.
 *
 *   PER_BUCKET=600 node scripts/gen-derived-content.mjs > /tmp/derived.sql
 *   node -e 'require("node:sqlite");…' # apply to the local file — see below
 *   node scripts/seed-remote-d1.mjs /tmp/derived.sql
 *
 * PER_BUCKET=600 is not optional if you intend the result to match what shipped. The
 * default of 150 is a quarter of the bank and every count in every doc would disagree.
 *
 * ── Applying locally: NOT `cd workers && wrangler d1 execute --local` ───────
 *
 * That is what this header said, and it writes to a database nothing serves. `wrangler
 * pages dev` runs from the REPO ROOT with `--d1 DB=languagebuilder` (see
 * .claude/launch.json), so it creates its local D1 keyed by that NAME under
 * ./.wrangler/. Run from workers/, `wrangler d1 execute` resolves the same name through
 * workers/wrangler.toml's database_id instead, which hashes to a different file — 26,517
 * inserts landed in it before the row count gave the game away. Every script here reads
 * ./.wrangler/, so apply the SQL to that file directly with node:sqlite's db.exec().
 *
 * Inputs, both already pinned by checksum elsewhere in this repo:
 *   data/quranic-corpus-morphology-0.4.txt  (128,219 annotated segments)
 *   data/quran-uthmani.txt                  (6,236 verses)
 *
 * Nothing here is authored. Every exercise names the corpus row it came from, so
 * a wrong item can be traced and disproved — which is precisely what the five
 * hand-written grammar errors could not be.
 *
 * Distractors are only ever drawn from values ATTESTED elsewhere in the corpus.
 * Inventing them would make questions answerable by elimination and would assert
 * facts the corpus does not support.
 *
 * Attribution: Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL) — a visible link
 * to corpus.quran.com is required wherever this is surfaced. Tanzil text, CC-BY.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const CORPUS_SHA = 'a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46';
const TEXT_SHA = 'abe6447a5d29bb126383ba9120628060cf96dc9ef5b402a506fc251f6ed0b9a2';

// ── Buckwalter → Arabic (mirrors workers/src/lib/buckwalter.ts) ─────────────
const BW = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', '{': 'ٱ',
  A: 'ا', b: 'ب', p: 'ة', t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ', d: 'د',
  '*': 'ذ', r: 'ر', z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط', Z: 'ظ',
  E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن', h: 'ه',
  w: 'و', Y: 'ى', y: 'ي', _: 'ـ', F: 'ً', N: 'ٌ', K: 'ٍ', a: 'َ', u: 'ُ',
  i: 'ِ', '~': 'ّ', o: 'ْ', '`': 'ٰ',
  // Extended Buckwalter for the mushaf's annotation marks. Derived empirically
  // by diffing corpus words against the pinned Tanzil text — see
  // workers/src/lib/buckwalter.ts for the method and the confidence figures.
  '^': 'ٓ', '@': '۟', ',': 'ۥ', '.': 'ۦ', '[': 'ۢ', '#': 'ٔ',
  ']': 'ۭ', '"': '۠', ':': 'ۜ', '-': '۪', '+': '۫', '!': 'ۨ',
  '%': '۬', ';': 'ۣ',
};
const toArabic = (s) => [...(s ?? '')].map((c) => BW[c] ?? c).join('');
const rootArabic = (r) => (r ? [...r].map((c) => BW[c] ?? c).join(' ') : null);

/** Deterministic shuffle, so regenerating does not churn the whole bank. */
function seededShuffle(items, seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Load and verify inputs ─────────────────────────────────────────────────
const corpusRaw = await readFile(join(root, 'data/quranic-corpus-morphology-0.4.txt'), 'utf-8');
const textRaw = await readFile(join(root, 'data/quran-uthmani.txt'), 'utf-8');

for (const [name, raw, want] of [
  ['corpus', corpusRaw, CORPUS_SHA],
  ['text', textRaw, TEXT_SHA],
]) {
  const got = createHash('sha256').update(raw).digest('hex');
  if (got !== want) {
    log(`REFUSING: ${name} checksum mismatch\n  expected ${want}\n  got      ${got}`);
    process.exit(3);
  }
}
log('inputs verified by checksum');

/**
 * The mushaf text, keyed "surah:ayah".
 *
 * Until sentence_type there was nothing here that needed a whole ayah, so this file was
 * checksummed and never parsed — the Buckwalter renderer supplied every word the bank
 * showed. An ayah assembled from corpus segments would render nearly right, but "nearly"
 * is not a standard to display scripture at, and the pinned Tanzil text is already here.
 */
const ayahText = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.replace(/\r$/, '').split('|');
  if (p.length < 3) continue;
  ayahText.set(`${+p[0]}:${+p[1]}`, p[2].trim());
}
if (ayahText.size !== 6236) {
  log(`REFUSING: parsed ${ayahText.size} ayat from the text, expected 6236`);
  process.exit(3);
}

// ── Parse the corpus ───────────────────────────────────────────────────────
const LOCATION = /^\((\d+):(\d+):(\d+):(\d+)\)$/;
const ROMAN = /\((I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)/;
const segments = [];
for (const line of corpusRaw.split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const p = line.replace(/\r$/, '').split('\t');
  if (p.length < 4) continue;
  const loc = LOCATION.exec(p[0].trim());
  if (!loc) continue;
  const f = p[3];
  segments.push({
    surah: +loc[1], ayah: +loc[2], word: +loc[3], seg: +loc[4],
    form: p[1], tag: p[2],
    lemma: f.match(/LEM:([^|]+)/)?.[1]?.trim() ?? null,
    root: f.match(/ROOT:([^|]+)/)?.[1]?.trim() ?? null,
    pos: f.match(/POS:([A-Z]+)/)?.[1] ?? null,
    verbForm: ROMAN.exec(f)?.[1] ?? null,
    aspect: ['PERF', 'IMPF', 'IMPV'].find((k) => f.includes(k)) ?? null,
    kase: ['NOM', 'ACC', 'GEN'].find((k) => f.includes(k)) ?? null,
    // ── Fields the ingest captured and this generator never read ────────────
    //
    // Roughly 108,000 annotated facts sat unused because the parser stopped at eight
    // fields. Each is read straight off the feature string, whose syntax was checked
    // against the file rather than assumed:
    //
    //   MOOD:JUS          mood, on imperfect verbs only
    //   PASS              voice — ACTIVE IS UNMARKED, so absence is the signal
    //   INDEF             indefiniteness, on the stem
    //   3MS / 2MP / 1P    person, gender and number fused into one token
    //
    // Definiteness is not here: the article is its own DET prefix SEGMENT, so it is a
    // property of the word rather than of this segment, and it is assembled below.
    mood: f.match(/MOOD:([A-Z]+)/)?.[1] ?? null,
    passive: /\|PASS(\||$)/.test(f),
    indef: /\|INDEF(\||$)/.test(f),
    // 3MS, 2FP, 1P, 2MS … person digit, optional gender letter, then number.
    pgn: f.match(/\|([123])(M|F)?(S|D|P)(?=\||$)/)?.slice(1) ?? null,
  });
}
log(`corpus: ${segments.length} segments`);

/** Root frequency drives difficulty: a common root is an easier question. */
const rootFreq = new Map();
for (const s of segments) if (s.root) rootFreq.set(s.root, (rootFreq.get(s.root) ?? 0) + 1);

function levelFromFreq(n) {
  if (n >= 300) return 1;
  if (n >= 120) return 2;
  if (n >= 50) return 3;
  if (n >= 15) return 4;
  return 5;
}

/**
 * How often this exact word form occurs. Needed because three of the five kinds
 * are not about roots at all, and were given a CONSTANT level as a result:
 * pos_id was always 1, aspect always 2, case_ending 2 or 3. Only 13 of the 25
 * (kind, level) buckets were reachable, so a learner who picked "Level 5 — rare
 * roots" got 34 verb_form items and nothing else, while level 1 offered three
 * kinds out of five. The label promised a difficulty ramp the bank did not have.
 *
 * A word you have met a thousand times is easier to parse than one you have met
 * twice, whatever is being asked about it — so form frequency ramps every kind.
 */
const formFreq = new Map();
for (const s of segments) {
  formFreq.set(s.form, (formFreq.get(s.form) ?? 0) + 1);
}
const levelFromForm = (form) => levelFromFreq((formFreq.get(form) ?? 0) * 6);

const VERB_FORMS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const CASE_LABEL = { NOM: 'Nominative (مرفوع)', ACC: 'Accusative (منصوب)', GEN: 'Genitive (مجرور)' };
const ASPECT_LABEL = { PERF: 'Perfect — past (ماضي)', IMPF: 'Imperfect — present (مضارع)', IMPV: 'Imperative (أمر)' };
const POS_LABEL = {
  N: 'Noun', V: 'Verb', ADJ: 'Adjective', PN: 'Proper noun', P: 'Preposition',
  PRON: 'Pronoun', DET: 'Determiner', CONJ: 'Conjunction', REL: 'Relative pronoun',
  DEM: 'Demonstrative', NEG: 'Negative particle', INTG: 'Interrogative',
};

const exercises = [];
const seenKey = new Set();

/**
 * Only ask about segments that ARE a whole word.
 *
 * A stem whose prefix was split off does not stand alone: bi+smi leaves "smi",
 * which renders as سْمِ — a letter followed by a sukun, a form no learner will
 * ever meet on its own. A first attempt filtered words STARTING with a diacritic,
 * which missed this exactly: سْمِ starts with a letter. Showing the fragment is
 * unfair regardless of what it starts with.
 *
 * 35,336 of the 77,429 words are single-segment, which is ample for a bank of
 * this size. The alternative — render the whole word and highlight one segment
 * inside it — is a better feature but a bigger one.
 */
const segmentsPerWord = new Map();
for (const seg of segments) {
  const k = `${seg.surah}:${seg.ayah}:${seg.word}`;
  segmentsPerWord.set(k, (segmentsPerWord.get(k) ?? 0) + 1);
}
function isWholeWord(s) {
  return segmentsPerWord.get(`${s.surah}:${s.ayah}:${s.word}`) === 1;
}

function add(kind, s, { level, prompt, answer, options, explanation, display }) {
  const key = `${kind}|${s.surah}|${s.ayah}|${s.word}|${s.seg}`;
  if (seenKey.has(key)) return;
  // The whole-word rule exists to protect what is DISPLAYED — a bare stem like سْمِ is
  // unfair to show — so a caller that supplies its own display has already taken that
  // responsibility and this must not apply. Discovered by sentence_type's balance
  // assertion: it displays the ayah, but every opening word carrying a pronoun suffix was
  // being dropped here, seven of them verbal, which tilted the bank to 58% nominal.
  // `undefined`, not falsy: sentence_type passes '' to mean "show nothing above the
  // prompt", and reading that as "no display supplied" put the rule back in force and
  // dropped 63 of its 252 items — enough to fail the balance assertion at 39%.
  if (display === undefined && !isWholeWord(s)) return;
  seenKey.add(key);
  exercises.push({
    id: `${kind}-${s.surah}-${s.ayah}-${s.word}-${s.seg}`,
    kind, level,
    // `display` overrides what the runner shows above the prompt. Only sentence_type
    // uses it, because that question is about a whole ayah rather than about one word.
    wordArabic: display ?? toArabic(s.form),
    wordBuckwalter: s.form,
    prompt, answer,
    options: seededShuffle(options, key),
    explanation,
    surah: s.surah, ayah: s.ayah, word: s.word, seg: s.seg,
    root: s.root,
  });
}

// Forms attested per root, so verb-form distractors are always real.
const formsByRoot = new Map();
for (const s of segments) {
  if (s.pos !== 'V' || !s.root) continue;
  const form = s.verbForm ?? 'I'; // Form I is unmarked — it IS the bare triliteral
  if (!formsByRoot.has(s.root)) formsByRoot.set(s.root, new Set());
  formsByRoot.get(s.root).add(form);
}

// ── 1. Verb form (F9) ──────────────────────────────────────────────────────
for (const s of segments) {
  if (s.pos !== 'V' || !s.root) continue;
  const answer = s.verbForm ?? 'I';
  const attested = [...(formsByRoot.get(s.root) ?? [])].filter((f) => f !== answer);
  if (attested.length < 2) continue; // fewer than 3 options is not a question
  const options = [answer, ...attested.slice(0, 3)].map((f) => `Form ${f}`);
  add('verb_form', s, {
    // Was root frequency, which left level 5 with 34 items out of a possible 150.
    // 1,580 level-5 candidates existed by that measure, but a rare root rarely has
    // the three attested forms this question needs for real distractors, so nearly
    // all of them were filtered out downstream. Form frequency asks the same
    // question of a rare WORD from a well-attested root — which supplies plenty,
    // and means "level" denotes one thing across all five kinds instead of five.
    level: levelFromForm(s.form),
    prompt: `Which derived form is ${toArabic(s.form)}?`,
    answer: `Form ${answer}`,
    options,
    explanation:
      `${toArabic(s.form)} is Form ${answer} of the root ${rootArabic(s.root)}. ` +
      `The corpus attests Form${attested.length ? 's' : ''} ` +
      `${[answer, ...attested].sort((a, b) => VERB_FORMS.indexOf(a) - VERB_FORMS.indexOf(b)).join(', ')} for this root ` +
      `(${s.surah}:${s.ayah}).`,
  });
}

// ── 2. Case ending (i'rab) ─────────────────────────────────────────────────
for (const s of segments) {
  if (!s.kase || !['N', 'ADJ', 'PN'].includes(s.pos ?? '')) continue;
  const others = Object.keys(CASE_LABEL).filter((k) => k !== s.kase);
  add('case_ending', s, {
    level: levelFromForm(s.form),
    prompt: `What is the case of ${toArabic(s.form)}?`,
    answer: CASE_LABEL[s.kase],
    options: [CASE_LABEL[s.kase], ...others.map((k) => CASE_LABEL[k])],
    explanation:
      `${toArabic(s.form)} at ${s.surah}:${s.ayah} is ${CASE_LABEL[s.kase]}` +
      (s.root ? `, from the root ${rootArabic(s.root)}` : '') + '.',
  });
}

// ── 3. Root identification ─────────────────────────────────────────────────
// Distractors must be real roots a learner could plausibly confuse, so they come
// from roots attested at least 5 times. The ANSWER may be rarer than that — which
// is the whole point of level 5.
const commonRoots = [...rootFreq.entries()]
  .filter(([, n]) => n >= 5)
  .map(([r]) => r);
for (const s of segments) {
  if (!s.root || !s.lemma) continue;
  // Was `< 20 continue`, which made level 5 unreachable by construction:
  // levelFromFreq calls anything under 15 level 5, so the filter excluded exactly
  // the band that defines the level. 3 is the floor at which a root is attested
  // rather than incidental.
  if ((rootFreq.get(s.root) ?? 0) < 3) continue;
  // Distractors: other common roots sharing a letter, so it is not a shape game.
  const near = commonRoots.filter(
    (r) => r !== s.root && r.length === s.root.length && [...r].some((c) => s.root.includes(c))
  );
  if (near.length < 3) continue;
  const picks = seededShuffle(near, `root${s.surah}${s.ayah}${s.word}`).slice(0, 3);
  add('root_id', s, {
    level: levelFromFreq(rootFreq.get(s.root) ?? 0),
    prompt: `What is the root of ${toArabic(s.form)}?`,
    answer: rootArabic(s.root),
    options: [rootArabic(s.root), ...picks.map(rootArabic)],
    explanation:
      `${toArabic(s.form)} derives from ${rootArabic(s.root)}, which occurs ` +
      `${rootFreq.get(s.root)} times in the Quran (${s.surah}:${s.ayah}).`,
  });
}

// ── 4. Part of speech ──────────────────────────────────────────────────────
for (const s of segments) {
  if (!s.pos || !POS_LABEL[s.pos]) continue;
  if (!['N', 'V', 'ADJ', 'P', 'PRON', 'CONJ'].includes(s.pos)) continue;
  const others = ['N', 'V', 'ADJ', 'P', 'PRON', 'CONJ'].filter((p) => p !== s.pos);
  const picks = seededShuffle(others, `pos${s.surah}${s.ayah}${s.word}${s.seg}`).slice(0, 3);
  add('pos_id', s, {
    level: levelFromForm(s.form),
    prompt: `What part of speech is ${toArabic(s.form)}?`,
    answer: POS_LABEL[s.pos],
    options: [POS_LABEL[s.pos], ...picks.map((p) => POS_LABEL[p])],
    explanation: `${toArabic(s.form)} at ${s.surah}:${s.ayah} is tagged ${POS_LABEL[s.pos]} in the corpus.`,
  });
}

// ── 5. Verb aspect ─────────────────────────────────────────────────────────
for (const s of segments) {
  if (s.pos !== 'V' || !s.aspect) continue;
  const others = Object.keys(ASPECT_LABEL).filter((a) => a !== s.aspect);
  add('aspect', s, {
    level: levelFromForm(s.form),
    prompt: `Is ${toArabic(s.form)} past, present or imperative?`,
    answer: ASPECT_LABEL[s.aspect],
    options: [ASPECT_LABEL[s.aspect], ...others.map((a) => ASPECT_LABEL[a])],
    explanation: `${toArabic(s.form)} at ${s.surah}:${s.ayah} is ${ASPECT_LABEL[s.aspect]}.`,
  });
}

// ── Cap per (kind, level) so the bank is balanced, not 40k of one thing ────
//
// Raised from 60. There are 63,835 valid candidates, so the cap is about balance
// and payload size rather than scarcity. Buckets that cannot fill report short
// instead of being padded — level 5 verb_form is genuinely thin because rare
// roots do not supply enough whole-word verbs.
// Items per (kind, level) bucket.
//
// Configurable because the right number is a question about the corpus, not a constant:
// raising it until buckets report short is how you find where the annotation runs out.
// 150 gave 3,750 derived items across 25 buckets with every bucket full, so there was
// clearly headroom.
// ══ Kinds 6–10: annotation the ingest captured and this generator never read ══
//
// Roughly 108,000 annotated facts sat unused. These five read them. Each pool is smaller
// than the original five, because the whole-word rule above excludes any word whose
// prefix was split off — so the generators will report short buckets rather than pad.

const PGN_SUBJECT = {
  '1S': 'I', '1P': 'we',
  '2MS': 'you (m.)', '2FS': 'you (f.)', '2MD': 'you two (m.)', '2FD': 'you two (f.)',
  '2MP': 'you (m. pl.)', '2FP': 'you (f. pl.)',
  '3MS': 'he', '3FS': 'she', '3MD': 'they two (m.)', '3FD': 'they two (f.)',
  '3MP': 'they (m.)', '3FP': 'they (f.)',
};
const MOOD_LABEL = {
  IND: 'Indicative (مرفوع)',
  SUBJ: 'Subjunctive (منصوب)',
  JUS: 'Jussive (مجزوم)',
};
const VOICE_LABEL = { ACT: 'Active (معلوم)', PASS: 'Passive (مجهول)' };
const DEF_LABEL = { DEF: 'Definite (معرفة)', INDEF: 'Indefinite (نكرة)' };

/** The 15 person/gender/number tokens, for distractors that are real options. */
const PGN_KEYS = Object.keys(PGN_SUBJECT);

// ── 6. Subject agreement ───────────────────────────────────────────────────
//
// Not "what gender is this word", which tests a label read off the ending and teaches
// nothing about reading. The corpus fuses person, gender and number into one token, which
// supports the question a reader actually needs: who did this? Distractors are drawn from
// the other real tokens, so every option is a subject Arabic can express.
for (const s of segments) {
  if (s.pos !== 'V' || !s.pgn) continue;
  const key = s.pgn.filter(Boolean).join('');
  const answer = PGN_SUBJECT[key];
  if (!answer) continue;
  const others = seededShuffle(
    PGN_KEYS.filter((k) => k !== key).map((k) => PGN_SUBJECT[k]),
    `pgn${s.surah}${s.ayah}${s.word}`
  ).slice(0, 3);
  add('subject_agreement', s, {
    level: levelFromForm(s.form),
    prompt: `Who is the subject of ${toArabic(s.form)}?`,
    answer,
    options: [answer, ...others],
    explanation:
      `The corpus tags ${toArabic(s.form)} at ${s.surah}:${s.ayah} as ${key} — ` +
      `"${answer}". Nothing but the ending carries that` +
      (s.root ? `; the root ${rootArabic(s.root)} says only what the action is.` : '.'),
  });
}

// ── 7. Mood ────────────────────────────────────────────────────────────────
//
// Only on imperfect verbs, and only ever JUS or SUBJ in the annotation — the indicative
// is UNMARKED, so an imperfect verb with no MOOD is indicative. That asymmetry is why the
// answer is derived from absence as well as presence.
for (const s of segments) {
  if (s.pos !== 'V' || s.aspect !== 'IMPF') continue;
  const mood = s.mood ?? 'IND';
  if (!MOOD_LABEL[mood]) continue;
  const others = Object.keys(MOOD_LABEL).filter((m) => m !== mood);
  add('mood', s, {
    level: levelFromForm(s.form),
    prompt: `What mood is ${toArabic(s.form)}?`,
    answer: MOOD_LABEL[mood],
    options: [MOOD_LABEL[mood], ...others.map((m) => MOOD_LABEL[m])],
    explanation:
      mood === 'IND'
        ? `${toArabic(s.form)} at ${s.surah}:${s.ayah} carries no mood marker, and an ` +
          'unmarked imperfect verb is indicative. Jussive and subjunctive are governed ' +
          'by a preceding particle.'
        : `The corpus marks ${toArabic(s.form)} at ${s.surah}:${s.ayah} as ` +
          `${MOOD_LABEL[mood]}, which a preceding particle governs.`,
  });
}

// ── 8. Voice ───────────────────────────────────────────────────────────────
//
// Asked as "which of these is passive" rather than "is this active or passive", because
// the annotation is binary and a two-option question is a coin flip. Four verbs, one
// passive, so answering means reading all four.
//
// Active is unmarked here: only PASS appears, so the actives are verbs WITHOUT it. A
// missing field means active rather than unknown — treating absence as no-data would have
// discarded every active verb.
const activeVerbs = segments.filter(
  (s) => s.pos === 'V' && s.aspect && !s.passive && isWholeWord(s)
);
for (const s of segments) {
  if (s.pos !== 'V' || !s.passive || !s.aspect) continue;
  const answer = toArabic(s.form);
  // Deduplicated by RENDERED form: different Buckwalter can render identically once
  // diacritics are mapped, so filtering on `form` alone still produced repeated options.
  const seenForm = new Set([answer]);
  const foils = [];
  for (const v of seededShuffle(activeVerbs, `voice${s.surah}${s.ayah}${s.word}`)) {
    const rendered = toArabic(v.form);
    if (seenForm.has(rendered)) continue;
    seenForm.add(rendered);
    foils.push(v);
    if (foils.length === 3) break;
  }
  if (foils.length < 3) continue;
  add('voice', s, {
    level: levelFromForm(s.form),
    prompt: 'Which of these verbs is passive?',
    answer,
    options: [answer, ...foils.map((v) => toArabic(v.form))],
    explanation:
      `${answer} at ${s.surah}:${s.ayah} is marked PASS in the corpus — the subject is ` +
      'not the one acting. The others carry no passive marking, and only the passive is ' +
      'marked.',
  });
}

// ── 9. Find-the-word kinds: negation, relative pronoun, demonstrative, conditional ──
//
// One implementation, four kinds. The negation version came first and the other three
// would have been copies of it — same tagged-word lookup, same neighbour distractors, same
// dedupe on the RENDERED string because different Buckwalter renders identically once
// diacritics map. Four copies is four places for that dedupe to be forgotten.
//
// Every one asks which word in the ayah does a job, and the distractors are its own
// neighbours, so the question is about recognising the word rather than spotting the odd
// one out of a list assembled from elsewhere.
/**
 * Every word of every ayah, reassembled, for use as a DISTRACTOR.
 *
 * Distractors do not have to be single-segment. The whole-word rule exists so the word
 * being ASKED about is never a fragment like سْمِ — a distractor rendered as its complete
 * word is perfectly fair, and restricting them to single-segment words was starving the
 * find-the-word kinds: relative_pronoun came out at 652 of 2,202 available, because many
 * ayahs simply do not contain three single-segment words besides the answer.
 */
const wordsByAyah = new Map();
{
  const byWord = new Map();
  for (const seg of segments) {
    const wk = `${seg.surah}:${seg.ayah}:${seg.word}`;
    if (!byWord.has(wk)) byWord.set(wk, []);
    byWord.get(wk).push(seg);
  }
  for (const [wk, group] of byWord) {
    const sorted = [...group].sort((a, b) => a.seg - b.seg);
    const [surah, ayah, word] = wk.split(':').map(Number);
    const k = `${surah}:${ayah}`;
    if (!wordsByAyah.has(k)) wordsByAyah.set(k, []);
    wordsByAyah.get(k).push({
      surah, ayah, word,
      // The complete word, so a multi-segment neighbour reads correctly.
      rendered: sorted.map((x) => toArabic(x.form)).join(''),
      // Any segment's POS is enough to exclude a neighbour that shares the answer's role.
      roles: new Set(sorted.map((x) => x.pos).filter(Boolean)),
    });
  }
}

/**
 * @param kind      bank kind
 * @param pos       the POS tag that marks the answer
 * @param prompt    (surah, ayah) => question text
 * @param explain   (arabic, surah, ayah) => explanation
 */
function addFindInAyah(kind, pos, prompt, explain) {
  for (const s of segments) {
    if (s.pos !== pos) continue;
    const answer = toArabic(s.form);
    // Deduplicated by rendered form, not by position: an ayah repeats words, so two
    // distractors could otherwise be the same word — or the same as the answer, which
    // makes the question unanswerable rather than merely odd.
    const seenForm = new Set([answer]);
    const neighbours = [];
    for (const o of wordsByAyah.get(`${s.surah}:${s.ayah}`) ?? []) {
      // Excluded if it shares the role being asked about — otherwise the question has two
      // right answers, which is worse than having too few options.
      if (o.word === s.word || !o.rendered || o.roles.has(pos)) continue;
      if (seenForm.has(o.rendered)) continue;
      seenForm.add(o.rendered);
      neighbours.push(o);
    }
    if (neighbours.length < 3) continue;
    const picks = seededShuffle(neighbours, `${kind}${s.surah}${s.ayah}${s.word}`).slice(0, 3);
    add(kind, s, {
      level: levelFromForm(s.form),
      prompt: prompt(s.surah, s.ayah),
      answer,
      options: [answer, ...picks.map((o) => o.rendered)],
      explanation: explain(answer, s.surah, s.ayah),
    });
  }
}

addFindInAyah(
  'negation',
  'NEG',
  (su, ay) => `Which word negates the statement in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} is tagged NEG in the corpus at ${su}:${ay}. The others carry their own parts ` +
    'of speech and do not negate.'
);
addFindInAyah(
  'relative_pronoun',
  'REL',
  (su, ay) => `Which word is the relative pronoun in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} at ${su}:${ay} is tagged REL — it introduces a clause describing something ` +
    'already named, the way "which" or "who" does in English.'
);
addFindInAyah(
  'demonstrative',
  'DEM',
  (su, ay) => `Which word is the demonstrative in ${su}:${ay}?`,
  (w, su, ay) =>
    `${w} at ${su}:${ay} is tagged DEM — it points at something, as "this" and "that" do.`
);
addFindInAyah(
  'conditional',
  'COND',
  (su, ay) => `Which word makes ${su}:${ay} conditional?`,
  (w, su, ay) =>
    `${w} at ${su}:${ay} is tagged COND. A conditional particle also governs what ` +
    'follows it, which is why the verb after one is often jussive.'
);

// ── 9b. Word role ──────────────────────────────────────────────────────────
//
// The question the find-the-word kinds cannot ask. A learner meeting ٱلَّذِينَ needs to
// know it IS a relative pronoun, not that one exists somewhere in the ayah — and telling
// a relative pronoun from a demonstrative from a conditional is the actual difficulty.
//
// Eight roles, four options per question, so the distractors are always other real roles.
const ROLE_LABEL = {
  REL: 'Relative pronoun',
  DEM: 'Demonstrative',
  COND: 'Conditional particle',
  INTG: 'Interrogative',
  NEG: 'Negation',
  ACC: 'Accusative particle',
  T: 'Time adverb',
  LOC: 'Place adverb',
};
const ROLE_KEYS = Object.keys(ROLE_LABEL);
for (const s of segments) {
  if (!s.pos || !ROLE_LABEL[s.pos]) continue;
  const answer = ROLE_LABEL[s.pos];
  const others = seededShuffle(
    ROLE_KEYS.filter((r) => r !== s.pos).map((r) => ROLE_LABEL[r]),
    `role${s.surah}${s.ayah}${s.word}`
  ).slice(0, 3);
  add('word_role', s, {
    level: levelFromForm(s.form),
    prompt: `What role does ${toArabic(s.form)} play in ${s.surah}:${s.ayah}?`,
    answer,
    options: [answer, ...others],
    explanation:
      `The corpus tags ${toArabic(s.form)} at ${s.surah}:${s.ayah} as ${s.pos} — ` +
      `${answer.toLowerCase()}.`,
  });
}

// ── 10. Definiteness ───────────────────────────────────────────────────────
//
// Two things make this the odd one out, and both are worth stating rather than working
// around silently.
//
// First, it cannot use add(). A definite word is two segments — the DET prefix ال plus the
// stem — so the whole-word rule that keeps fragments like سْمِ out of the bank excludes
// every definite word by construction. Asking "is ٱلْكِتَابُ definite?" about the bare ال
// would be worse than not asking, so the word is reassembled from its segments, which the
// corpus supports exactly: each carries its own form and they concatenate to the word.
//
// Second, it is asked as "which of these is definite" rather than "is this definite",
// because the annotation is binary and two options is a coin flip.
const segsByWord = new Map();
for (const s of segments) {
  const k = `${s.surah}:${s.ayah}:${s.word}`;
  if (!segsByWord.has(k)) segsByWord.set(k, []);
  segsByWord.get(k).push(s);
}

/** Reassembled words the annotation actually classifies, with their class. */
const classifiedWords = [];
for (const [k, group] of segsByWord) {
  const sorted = [...group].sort((a, b) => a.seg - b.seg);
  const hasDet = sorted.some((x) => x.tag === 'DET');
  const stem = sorted.find((x) => x.pos && ['N', 'ADJ'].includes(x.pos));
  if (!stem) continue;
  // A noun that is neither DET-prefixed nor marked INDEF is definite for some other
  // reason — a possessive construction, a proper name — and guessing would be inventing
  // an answer. Contradictory marking is skipped rather than resolved by preference.
  if (hasDet === Boolean(stem.indef)) continue;
  const [surah, ayah, word] = k.split(':').map(Number);
  classifiedWords.push({
    surah, ayah, word,
    definite: hasDet,
    whole: sorted.map((x) => toArabic(x.form)).join(''),
    wholeBw: sorted.map((x) => x.form).join(''),
    stem,
  });
}

const indefiniteWords = classifiedWords.filter((w) => !w.definite);
for (const w of classifiedWords) {
  if (!w.definite) continue; // the definite one is the answer
  const seenWhole = new Set([w.whole]);
  const foils = [];
  for (const o of seededShuffle(indefiniteWords, `def${w.surah}${w.ayah}${w.word}`)) {
    if (seenWhole.has(o.whole)) continue;
    seenWhole.add(o.whole);
    foils.push(o);
    if (foils.length === 3) break;
  }
  if (foils.length < 3) continue;
  const key = `definiteness|${w.surah}:${w.ayah}:${w.word}`;
  if (seenKey.has(key)) continue;
  seenKey.add(key);
  const options = seededShuffle(
    [w.whole, ...foils.map((f) => f.whole)],
    `defopt${w.surah}${w.ayah}${w.word}`
  );
  exercises.push({
    id: `definiteness-${w.surah}-${w.ayah}-${w.word}-0`,
    kind: 'definiteness',
    level: levelFromForm(w.stem.form),
    wordArabic: w.whole,
    wordBuckwalter: w.wholeBw,
    surah: w.surah,
    ayah: w.ayah,
    word: w.word,
    seg: 0,
    root: w.stem.root,
    prompt: 'Which of these words is definite?',
    answer: w.whole,
    options,
    explanation:
      `${w.whole} at ${w.surah}:${w.ayah} carries the article ال, which makes it ` +
      'definite. The others are marked INDEF in the corpus — no article.',
  });
}

// ── 10. Sentence type — nominal or verbal (grammar-03) ─────────────────────
//
// grammar-03 was the one authored lesson with NO practice, on the reasoning that
// predication — مبتدأ and خبر — is nowhere in the annotation. That is still true, and
// nothing below claims otherwise. But the lesson's opening sentence is not about
// predication at all: "Arabic sentences begin with either a noun or a verb." That is a
// claim about the FIRST WORD, and the first word's part of speech is exactly what the
// corpus records. So the drill asks the lesson's own opening question and stops there.
//
// ── Four ways this could assert something the corpus does not support ───────
//
// Each was found by reading candidates rather than by reasoning about them, and the
// first two were live defects in the first version of these criteria:
//
// 1. إِيَّاكَ نَعْبُدُ (1:5) opens with a PRON, so a naive rule called it nominal. It is
//    verbal — إيّاك is the fronted OBJECT of نعبد. Case would normally settle this, but the
//    corpus marks no case on pronouns or demonstratives at all (verified: 3,301 PRON and
//    1,059 DEM segments, every one with case null). What separates them is the lemma:
//    the إيّا family is the only ayah-initial pronoun carrying LEM, and the other six
//    forms — هو، نحن، هم، همُ، أنتم — are subject pronouns with no lemma field. Excluded by
//    lemma, which is exact rather than heuristic.
// 2. لَّيْسَ ٱلْبِرَّ (2:177) opens with a verb, but whether كان and its sisters make a
//    sentence فعلية (it begins with a verb) or اسمية (they enter UPON a nominal sentence)
//    is a genuine disagreement between grammarians, not a fact. Excluded — 14 of 624
//    verb-initial ayat, so the insurance is nearly free.
// 3. A word with a prefix is ambiguous in a way the bare stem is not: the وَ of وَٱلْفَجْرِ
//    is an oath particle and the phrase is not a مبتدأ, while the وَ of وَٱللَّهُ is a
//    conjunction and it is. add()'s existing whole-word rule excludes every prefixed word
//    already, so this needs no rule of its own — it needs only not to be worked around.
// 4. Nouns are required NOMINATIVE. A genitive or accusative opening word is governed by
//    something, so it cannot be a مبتدأ, and 2:117's بَدِيعُ — a fragment continuing the
//    ayah before it — is still nominative and still reads as a nominal construction.
//
// ── Asked as "which of these", because the distinction is binary ───────────
//
// The obvious question — "is this ayah nominal or verbal?" — is a coin flip, and this
// generator's own option-count rule caught it: two options where four were expected. That
// rule is right, and three ways of widening it were tried before the fourth worked.
//
//   • Splitting the nominal answer by word class (noun / pronoun / demonstrative) gives
//     four honest options, but it collapses the difficulty ramp. Level comes from how
//     common the opening word is, and pronouns and demonstratives are ALL common — level 5
//     has 72 verb openings, 24 noun openings and zero of either. Balanced four ways, the
//     top two levels empty out.
//   • "Neither — it opens with a particle" is decidably false for every included ayah,
//     so it is NEVER the answer. A learner who notices is back to a coin flip and has
//     learnt to ignore an option rather than read it.
//   • Admitting preposition-initial ayat as a real "neither" class is worse than useless:
//     لِلَّهِ ٱلْمُلْكُ is a nominal sentence with a FRONTED predicate, so the option would be
//     wrong precisely where a learner is most likely to choose it.
//
// So it takes the shape definiteness and voice already use for binary annotation: four
// short ayat, one of which opens the asked way. Both directions are generated and balanced
// per level, so neither "find the verb" nor "find the noun" becomes the habit, and the
// learner classifies four openings per item instead of one.
//
// ── Four ways this could assert something the corpus does not support ───────
//
// Each was found by reading candidates rather than by reasoning about them, and the
// first two were live defects in the first version of these criteria:
//
// 1. إِيَّاكَ نَعْبُدُ (1:5) opens with a PRON, so a naive rule called it nominal. It is
//    verbal — إيّاك is the fronted OBJECT of نعبد. Case would normally settle this, but the
//    corpus marks no case on pronouns or demonstratives at all (verified: 3,301 PRON and
//    1,059 DEM segments, every one with case null). What separates them is the lemma:
//    the إيّا family is the only ayah-initial pronoun carrying LEM, and the other six
//    forms — هو، نحن، هم، همُ، أنتم — are subject pronouns with no lemma field. Excluded by
//    lemma, which is exact rather than heuristic.
// 2. لَّيْسَ ٱلْبِرَّ (2:177) opens with a verb, but whether كان and its sisters make a
//    sentence فعلية (it begins with a verb) or اسمية (they enter UPON a nominal sentence)
//    is a genuine disagreement between grammarians, not a fact. Excluded — 14 of 624
//    verb-initial ayat, so the insurance is nearly free.
// 3. A word with a prefix is ambiguous in a way the bare stem is not: the وَ of وَٱلْفَجْرِ
//    is an oath particle and the phrase is not a مبتدأ, while the وَ of وَٱللَّهُ is a
//    conjunction and it is. Handled without a rule of its own: a prefix segment carries no
//    POS at all (it reads `w:CONJ+`), so requiring a POS on segment 1 admits only stems.
// 4. Nouns are required NOMINATIVE. A genitive or accusative opening word is governed by
//    something, so it cannot be a مبتدأ, and 2:117's بَدِيعُ — a fragment continuing the
//    ayah before it — is still nominative and still reads as a nominal construction.
//
// What is NOT claimed anywhere here: which word is the مبتدأ and which the خبر. That is
// the syntactic treebank's territory, and the treebank is not in the distributed corpus.
{
  const NOUNISH = new Set(['N', 'PN', 'ADJ']);
  const INDECLINABLE = new Set(['PRON', 'DEM']);
  /** كان and ليس. See exclusion 2 — the only two of the family that open an ayah. */
  const KANA_FAMILY = new Set(['kaAna', 'l~ayosa']);
  /** إيّا — the accusative separable pronoun, always an object. See exclusion 1. */
  const OBJECT_PRONOUN = '<iy~aA';

  /**
   * The two Arabic terms, byte-identical to the ones grammar-03 already puts on screen.
   *
   * Deliberately not retyped with fuller vowelling. New hand-authored Arabic is how a moon
   * letter reached the sun-letter list, and reusing the lesson's own strings adds none.
   */
  const TERM = { verbal: 'جملة فعلية', nominal: 'جملة اسمية' };

  /**
   * At most ten ayat per opening word.
   *
   * قَالَ opens 399 of the 610 verb-initial ayat. Without a cap the kind is two thirds one
   * word, and what a learner takes away is "قال means verbal" rather than "a verb means
   * verbal".
   */
  const PER_OPENING = 10;
  /**
   * Four ayat share one screen as option buttons, so each must be short. Eight words keeps
   * a button to about two lines; ten was measured too (288 items rather than 252) and left
   * four dense paragraphs of Arabic to choose between.
   */
  const MAX_AYAH_WORDS = 8;

  const perOpening = new Map();
  const candidates = [];
  for (const s of segments) {
    if (s.word !== 1 || s.seg !== 1) continue;
    const text = ayahText.get(`${s.surah}:${s.ayah}`);
    if (!text || text.split(/\s+/).length > MAX_AYAH_WORDS) continue;

    let cls = null;
    let opener = null;
    if (s.pos === 'V' && !KANA_FAMILY.has(s.lemma)) {
      cls = 'verbal';
      opener =
        `POS:V — a verb${s.aspect ? `, ${ASPECT_LABEL[s.aspect].split(' —')[0].toLowerCase()}` : ''}`;
    } else if (NOUNISH.has(s.pos) && s.kase === 'NOM') {
      cls = 'nominal';
      opener =
        `POS:${s.pos} — ${POS_LABEL[s.pos]?.toLowerCase() ?? s.pos} in the nominative ` +
        '(مرفوع), the case a مبتدأ takes';
    } else if (INDECLINABLE.has(s.pos) && s.lemma !== OBJECT_PRONOUN) {
      cls = 'nominal';
      opener =
        `POS:${s.pos} — ` +
        (s.pos === 'DEM' ? 'a demonstrative' : 'a subject pronoun') +
        ', which stands where a noun stands';
    }
    if (!cls) continue;

    const n = perOpening.get(s.form) ?? 0;
    if (n >= PER_OPENING) continue;
    perOpening.set(s.form, n + 1);
    candidates.push({ s, cls, opener, text, level: levelFromForm(s.form) });
  }

  const pool = {
    verbal: candidates.filter((c) => c.cls === 'verbal'),
    nominal: candidates.filter((c) => c.cls === 'nominal'),
  };

  /**
   * Balance the two directions inside each level, so no level rewards one habit.
   *
   * Trimmed by seeded shuffle rather than by taking the head, so which items are dropped
   * does not depend on corpus order — al-Baqarah would otherwise supply the whole of the
   * majority direction and the minority would come from everywhere else.
   */
  let attempted = 0;
  for (const level of [1, 2, 3, 4, 5]) {
    const inLevel = (cls) =>
      seededShuffle(candidates.filter((c) => c.level === level && c.cls === cls), `st-${cls}${level}`);
    const nominal = inLevel('nominal');
    const verbal = inLevel('verbal');
    const take = Math.min(nominal.length, verbal.length);
    for (const c of [...nominal.slice(0, take), ...verbal.slice(0, take)]) {
      const otherClass = c.cls === 'verbal' ? 'nominal' : 'verbal';
      // Distractors are drawn from the whole opposite pool rather than from this level:
      // they are not what the question is about, and restricting them would narrow the
      // variety a learner sees without making the question any harder or any fairer.
      const seenText = new Set([c.text]);
      const foils = [];
      for (const o of seededShuffle(pool[otherClass], `stf${c.s.surah}:${c.s.ayah}`)) {
        if (seenText.has(o.text)) continue;
        seenText.add(o.text);
        foils.push(o);
        if (foils.length === 3) break;
      }
      if (foils.length < 3) continue;
      attempted += 1;
      add('sentence_type', c.s, {
        level,
        // No display: the four ayat are the options, and there is no single one to show
        // above the prompt.
        display: '',
        prompt:
          c.cls === 'verbal'
            ? `Which of these opens with a verb, making it a ${TERM.verbal}?`
            : `Which of these opens with a noun, making it a ${TERM.nominal}?`,
        answer: c.text,
        options: [c.text, ...foils.map((f) => f.text)],
        explanation:
          `${toArabic(c.s.form)} opens ${c.s.surah}:${c.s.ayah}, tagged ${c.opener}. ` +
          `That makes ${c.s.surah}:${c.s.ayah} a ${TERM[c.cls]}` +
          `${c.cls === 'verbal' ? ': فعل, then فاعل' : ': مبتدأ, then خبر'}. The other ` +
          `three open with ${c.cls === 'verbal' ? 'nouns' : 'verbs'}.`,
      });
    }
  }
  // A balancing bug shows up as a lopsided bank rather than as an error, so it is asserted
  // here instead of being left for someone to notice later. The first version of these
  // criteria failed this at 58% nominal, which is how add()'s whole-word rule was found to
  // be silently dropping every opening word that carried a pronoun suffix.
  const mine = exercises.filter((e) => e.kind === 'sentence_type');
  const verbalShare =
    mine.filter((e) => e.prompt.includes('with a verb')).length / (mine.length || 1);
  if (mine.length !== attempted || Math.abs(verbalShare - 0.5) > 0.001) {
    log(
      `REFUSING: sentence_type is ${Math.round(verbalShare * 100)}% find-the-verb across ` +
        `${mine.length} of ${attempted} items — the per-level balance did not hold`
    );
    process.exit(3);
  }
  log(
    `sentence_type: ${mine.length} items, both directions equal, ` +
      `${perOpening.size} distinct openings`
  );
}

// ── 11. Paronomasia — two words, one root, one ayah ────────────────────────
//
// The one device of ʿilm al-badīʿ — the branch about wordplay and embellishment — that
// falls out of data this project already trusts. Two different words built on the same root
// inside one ayah is paronomasia, ARDT device CA-1 (al-jinās / al-tajnīs), and root is the
// most heavily verified field in the corpus: 49,968 of them, in total agreement with an
// independent treebank.
//
// Nothing about this is a judgement. Either two words in the ayah share a root or they do
// not, and the corpus says which. Compare fronting, which needed a case cross-check, and
// simile, which needs a source that does not exist.
//
// ── Why this is the volume balagha was missing ──────────────────────────────
//
// 3,450 root-pairs across 2,171 ayat, against fronting's 148. And the hits are the examples
// the literature reaches for first: 1:1 ٱلرَّحْمَٰنِ / ٱلرَّحِيمِ, and 2:9 يُخَادِعُونَ / يَخْدَعُونَ,
// which is the stock illustration of the device in al-Baqarah.
//
// ── The device is named as the taxonomy names it ────────────────────────────
//
// "Paronomasia (al-jinās)", in Latin transliteration, because that is what the CC-BY
// registry publishes. Writing جناس in Arabic script would be authoring a term no pinned
// source here contains — a small thing, but the لْكِتَابُ sun-letter error was a small thing.
{
  /** Roots per WORD, so a pair is found between words rather than between segments. */
  const rootsOfWord = new Map();
  for (const s of segments) {
    if (!s.root) continue;
    const k = `${s.surah}:${s.ayah}:${s.word}`;
    if (!rootsOfWord.has(k)) rootsOfWord.set(k, new Set());
    rootsOfWord.get(k).add(s.root);
  }

  /**
   * Twenty words, where the locate-a-role kinds stop at eight or fourteen.
   *
   * Deliberately looser, because the work is different. "Which word is the خبر" requires
   * parsing the sentence, so a long ayah is genuinely harder. Here the learner compares the
   * quoted word's root against four candidates — the rest of the ayah is context, not
   * search space. Measured: 14 words yields 884 items, 20 yields 1,660, 30 yields 2,580.
   * Twenty nearly doubles the bank for about two extra lines on screen; thirty starts
   * putting whole paragraphs behind a four-option question.
   */
  const MAX_AYAH_WORDS = 20;
  let pairs = 0;
  let emitted = 0;
  const dropped = { length: 0, thirdWord: 0, foils: 0, sameForm: 0 };

  /**
   * The Buckwalter form of each word's ROOTED segment, so difficulty can be read the same
   * way every other kind reads it — from how often the word occurs, not the root.
   */
  const formOfWord = new Map();
  for (const s of segments) {
    if (!s.root) continue;
    const k = `${s.surah}:${s.ayah}:${s.word}`;
    if (!formOfWord.has(k)) formOfWord.set(k, s.form);
  }

  for (const [ayahKey, raw] of ayahText) {
    const words = raw.split(/\s+/);
    if (words.length > MAX_AYAH_WORDS) continue;
    const [surah, ayah] = ayahKey.split(':').map(Number);

    // Which words carry which root, within this ayah.
    const byRoot = new Map();
    for (let i = 0; i < words.length; i += 1) {
      for (const r of rootsOfWord.get(`${surah}:${ayah}:${i + 1}`) ?? []) {
        if (!byRoot.has(r)) byRoot.set(r, []);
        byRoot.get(r).push(i + 1);
      }
    }

    for (const [rootBw, indices] of byRoot) {
      if (indices.length !== 2) {
        // Three or more words on one root would give the question two right answers, and
        // resolving that by picking one would be inventing a preference.
        if (indices.length > 2) dropped.thirdWord += 1;
        continue;
      }
      pairs += 1;
      const [a, b] = indices;
      const wordA = words[a - 1];
      const wordB = words[b - 1];
      // Identical surface forms are repetition (تكرار), a different device. The question
      // would also be unanswerable, since two options would read the same.
      if (!wordA || !wordB || wordA === wordB) {
        dropped.sameForm += 1;
        continue;
      }

      // Which of the pair is quoted and which is the answer, alternating by seed. Always
      // quoting the earlier one would make "the later word" a winning strategy that
      // required no knowledge of roots at all.
      const flip = seededShuffle([0, 1], `jn${ayahKey}${rootBw}`)[0] === 1;
      const askedIndex = flip ? b : a;
      const answerIndex = flip ? a : b;
      const asked = words[askedIndex - 1];
      const answer = words[answerIndex - 1];

      const seenForm = new Set([asked, answer]);
      const foils = [];
      for (let i = 0; i < words.length; i += 1) {
        const wi = i + 1;
        if (wi === askedIndex || wi === answerIndex) continue;
        // A distractor must not share the asked root either.
        if ((rootsOfWord.get(`${surah}:${ayah}:${wi}`) ?? new Set()).has(rootBw)) continue;
        if (seenForm.has(words[i])) continue;
        seenForm.add(words[i]);
        foils.push(words[i]);
      }
      /**
       * Three options allowed, for the same reason fronting allows them.
       *
       * 1:1 بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ is four words, of which two ARE the pair — so it
       * yields two distractors, and requiring four dropped the most cited instance of the
       * device in the entire Quran. 1:3 is the pair and nothing else.
       *
       * The remaining options are still the ayah's own words, so the learner is choosing
       * between real candidates either way.
       */
      if (foils.length < 2) {
        dropped.foils += 1;
        continue;
      }
      const picks = seededShuffle(foils, `jnf${ayahKey}${rootBw}`).slice(0, 3);

      const key = `jinas|${ayahKey}|${rootBw}`;
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      emitted += 1;
      exercises.push({
        id: `jinas-${surah}-${ayah}-${answerIndex}`,
        kind: 'jinas',
        level: levelFromForm(formOfWord.get(`${surah}:${ayah}:${answerIndex}`) ?? ''),
        wordArabic: raw,
        wordBuckwalter: '',
        prompt: `${asked} shares its root with one other word in ${surah}:${ayah}. Which?`,
        answer,
        options: seededShuffle([answer, ...picks], `jno${ayahKey}${rootBw}`),
        explanation:
          // States the FACT, names the pattern, and stops.
          //
          // An earlier wording said this pattern "is the device", which over-claims in the
          // same way a person-shift would if it were called التفات: two words from one root
          // in one ayah is what CA-1 CONSISTS of, but whether a given instance carries
          // rhetorical weight is a reading, not a corpus fact. 1:1 ٱلرَّحْمَٰنِ ٱلرَّحِيمِ is
          // cited everywhere; 10:20 فَقُلْ / وَيَقُولُونَ is ordinary narration that happens
          // to fit the pattern. The corpus cannot tell them apart, so this does not pretend
          // to — the same line fronting takes about what its تقديم means.
          `${asked} and ${answer} are both built on ${rootArabic(rootBw)}. Two words from ` +
          'one root in one ayah is the pattern the Encyclopedia of Arabic Rhetoric lists ' +
          'as CA-1, Paronomasia (al-jinās). Whether a particular instance is doing ' +
          'rhetorical work — pulling sound and sense together — or is simply how the ' +
          'sentence fell, is a matter of reading; the shared root is not. ' +
          // Counted, not assumed to be three. A short ayah yields two distractors, and
          // 1:1 — the most cited instance of this pattern anywhere — is one of them.
          `The other ${picks.length === 1 ? 'option comes' : `${picks.length} options come`} ` +
          'from different roots.',
        surah,
        ayah,
        word: answerIndex,
        seg: 0,
        root: rootBw,
      });
    }
  }
  log(
    `jinas: ${emitted} items from ${pairs} root-pairs — dropped ${dropped.thirdWord} with a ` +
      `third word on the root, ${dropped.sameForm} identical forms (that is تكرار, not ` +
      `jinās), ${dropped.foils} with too few distractors`
  );
}

// ── 12. Simile — the marked kind ───────────────────────────────────────────
//
// ʿilm al-bayān, ARDT device B-1 (al-tashbīh), and I told the user this whole branch was
// unreachable. That was wrong in a way worth being specific about: METAPHOR is unreachable,
// because nothing on the surface marks it. Simile often carries a particle, and a particle
// is a fact about the text.
//
// ── Why the particle alone is not enough, and what is ───────────────────────
//
// The comparison kāf is tagged `PREFIX|ka+` on 295 segments, distinct from the 1,062
// pronoun suffixes that are also كَ. But taking all 295 gives nonsense: كَمَآ ءَامَنَ
// ("as the people believed", 2:13) and كَذَٰلِكَ ("thus", 2:73) are manner and deixis, not a
// comparison between two things.
//
// The discriminator is what the kāf attaches to. Its stem's part of speech decides:
//
//   ✓ 2:74  فَهِىَ كَٱلْحِجَارَةِ   kāf + noun     — hearts compared to stones
//   ✓ 2:19  أَوْ كَصَيِّبٍ         kāf + noun     — compared to a rainstorm
//   ✓ 2:17  كَمَثَلِ ٱلَّذِى        kāf + noun     — the stock simile of al-Baqarah
//   ✗ 2:13  كَمَآ                 kāf + SUB      — a manner clause
//   ✗ 2:73  كَذَٰلِكَ              kāf + DEM      — "thus"
//
// A first attempt used a different rule — an ayah containing both a kāf and the lemma
// مَثَل — and it accepted 2:113 and 2:118, where the مثل and the kāf belong to different
// clauses and no comparison is drawn. The part-of-speech rule rejects both. That is the
// argument for testing a rule against its own false positives rather than its hits.
//
// What stays out: تشبيه بليغ, where the particle is dropped precisely because the
// comparison is strong enough without it. Undetectable by construction, and 77 marked
// similes are worth having without it.
{
  /**
   * The comparison kāf, told apart from the pronoun suffix that shares its letter.
   *
   * Both are كَ. The corpus distinguishes them by tag and position: the comparison kāf is a
   * PREFIX tagged P (295 segments), while the "your / you" suffix is tagged PRON (1,062 as
   * a suffix, 80 as a stem). A prefix carries no POS field of its own, which is why the
   * stem is looked up separately below.
   */
  const isComparisonKaf = (seg) => seg.tag === 'P' && seg.form === 'ka' && seg.seg === 1;

  const NOUNISH = new Set(['N', 'PN', 'ADJ']);
  /**
   * Thirty words, where jinas stops at twenty. The cap is set by what each kind can afford.
   *
   * jinas has 2,009 candidate pairs, so the tighter limit costs it nothing it needs and
   * keeps whole paragraphs off the screen. Marked similes number 77 in the entire Quran, and
   * at twenty words 32 of them — two fifths — are lost to length alone. The task also
   * differs: finding the كـ is a visual scan for one particle, not a parse of the sentence.
   */
  const MAX_AYAH_WORDS = 30;
  let emitted = 0;
  const dropped = { notNoun: 0, foils: 0, length: 0 };

  /** Segments grouped per word, so the prefix and its stem can be read together. */
  const wordSegs = new Map();
  for (const s of segments) {
    const k = `${s.surah}:${s.ayah}:${s.word}`;
    if (!wordSegs.has(k)) wordSegs.set(k, []);
    wordSegs.get(k).push(s);
  }

  for (const [k, segs] of wordSegs) {
    const sorted = [...segs].sort((a, b) => a.seg - b.seg);
    // The comparison kāf is a PREFIX tagged P. A كَ that is a pronoun suffix is a
    // different morpheme entirely and is excluded by requiring the prefix position.
    if (!isComparisonKaf(sorted[0])) continue;
    const stem = sorted.find((s) => s.pos);
    if (!stem || !NOUNISH.has(stem.pos)) {
      dropped.notNoun += 1;
      continue;
    }
    const [surah, ayah, word] = k.split(':').map(Number);
    const raw = ayahText.get(`${surah}:${ayah}`);
    if (!raw) continue;
    const words = raw.split(/\s+/);
    if (words.length > MAX_AYAH_WORDS) {
      dropped.length += 1;
      continue;
    }
    const answer = words[word - 1];
    if (!answer) continue;

    // A distractor must not itself carry a comparison kāf, or the question has two
    // right answers.
    const seenForm = new Set([answer]);
    const foils = [];
    for (let i = 0; i < words.length; i += 1) {
      const wi = i + 1;
      if (wi === word) continue;
      const other = wordSegs.get(`${surah}:${ayah}:${wi}`) ?? [];
      const otherFirst = [...other].sort((a, b) => a.seg - b.seg)[0];
      if (otherFirst && isComparisonKaf(otherFirst)) continue;
      if (seenForm.has(words[i])) continue;
      seenForm.add(words[i]);
      foils.push(words[i]);
    }
    if (foils.length < 3) {
      dropped.foils += 1;
      continue;
    }
    const picks = seededShuffle(foils, `smf${k}`).slice(0, 3);
    const key = `simile|${k}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    emitted += 1;
    exercises.push({
      id: `simile-${surah}-${ayah}-${word}`,
      kind: 'simile',
      level: levelFromForm(stem.form),
      wordArabic: raw,
      wordBuckwalter: '',
      prompt: `One word in ${surah}:${ayah} opens a comparison. Which?`,
      answer,
      options: seededShuffle([answer, ...picks], `smo${k}`),
      explanation:
        `${answer} carries the كـ of comparison — the corpus tags it as a prefixed ` +
        `preposition on ${toArabic(stem.form)}. Comparing one thing to another with an ` +
        'explicit particle is the device the Encyclopedia of Arabic Rhetoric lists as ' +
        'B-1, Simile (al-tashbīh). Where the particle is dropped the comparison is still ' +
        'there, but nothing in the text marks it.',
      surah,
      ayah,
      word,
      seg: 0,
      root: stem.root,
    });
  }
  log(
    `simile: ${emitted} items — dropped ${dropped.notNoun} where the kāf sits on a ` +
      `non-noun (كما, كذلك — manner and deixis, not comparison), ${dropped.length} long ` +
      `ayat, ${dropped.foils} with too few distractors`
  );
}

const PER_BUCKET = Number(process.env.PER_BUCKET ?? 150);

/**
 * Round-robin over surahs instead of taking the head of the list.
 *
 * Candidates are generated in corpus order, so a first-N cap filled almost every
 * bucket out of surah 2 alone: eight of the thirteen live buckets drew on two
 * surahs or fewer, and their highest surah was 2. The learner was studying
 * al-Baqarah and nothing else, which no part of the UI said or implied.
 *
 * Deterministic, so regenerating does not churn the bank.
 */
function spreadAcrossSurahs(items, cap) {
  const queues = new Map();
  for (const e of items) {
    if (!queues.has(e.surah)) queues.set(e.surah, []);
    queues.get(e.surah).push(e);
  }
  // Within a surah, offer the richest questions first: a 4-option item is a
  // better test than a 3-option one, so 3-option items only fill what is left.
  const order = [...queues.keys()]
    .sort((a, b) => a - b)
    .map((k) => queues.get(k).sort((x, y) => y.options.length - x.options.length));
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

const byBucket = new Map();
for (const e of exercises) {
  const k = `${e.kind}|${e.level}`;
  if (!byBucket.has(k)) byBucket.set(k, []);
  byBucket.get(k).push(e);
}
const chosen = [];
const short = [];
for (const k of [...byBucket.keys()].sort()) {
  const picked = spreadAcrossSurahs(byBucket.get(k), PER_BUCKET);
  if (picked.length < PER_BUCKET) short.push(`${k}=${picked.length}`);
  chosen.push(...picked);
}
// Never let a bucket run short silently: a thin level reads as a complete one.
if (short.length) log(`           short buckets: ${short.join(' ')}`);

// ── Validate, then refuse ─────────────────────────────────────────────────
const defects = [];
for (const e of chosen) {
  if (!e.options.includes(e.answer)) defects.push(`${e.id}: answer is not an option`);
  if (new Set(e.options).size !== e.options.length) defects.push(`${e.id}: repeated option`);
  // Three kinds are legitimately three-way. aspect and case_ending because the
  // categories have three members. verb_form because its distractors must be
  // forms the corpus ATTESTS for that root — inventing a fourth would make the
  // question teach something false, and requiring four would leave level 1 with
  // 125 candidates instead of 150. Selection below prefers four where it exists.
  // mood joins them: indicative, subjunctive and jussive are all there is, so a fourth
  // option would have to be invented — the same objection that keeps verb_form at three.
  //
  // jinas is three-way for a different reason: the ayah, not the category, runs out. Both
  // words of the pair are excluded as distractors, so a four-word ayah leaves two — and
  // 1:1 بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ is a four-word ayah carrying the most cited instance of
  // the device in the Quran. Requiring four options dropped it.
  const minOptions =
    e.kind === 'aspect' || e.kind === 'case_ending' || e.kind === 'verb_form' ||
    e.kind === 'mood' || e.kind === 'jinas'
      ? 3
      : 4;
  if (e.options.length < minOptions) {
    defects.push(`${e.id}: ${e.options.length} options, expected ${minOptions}`);
  }
}
const liveBuckets = new Set(chosen.map((e) => `${e.kind}|${e.level}`));
const kinds = new Set(chosen.map((e) => e.kind));
/**
 * Kinds whose difficulty does not span all five levels, and cannot.
 *
 * Level comes from how common the WORD is, deliberately, so "level 3" means one thing
 * across every kind. For two kinds that leaves gaps which are facts about Arabic rather
 * than gaps in the data:
 *
 *   negation has no level 5 — لا, ما and لم are among the commonest words in the Quran,
 *     and there is no such thing as a rare negation particle.
 *   voice has no level 1 — no passive verb is common enough to qualify.
 *
 * Rescaling level within each kind would fill them and cost more than it bought: level
 * would then mean "hard for this kind", so a level-3 negation and a level-3 root question
 * would stop being comparable, which is the point of a shared scale.
 *
 * The UI already tells the truth here — "Nothing at this combination: not every type
 * exists at every level" — so an empty bucket is honest rather than broken. Noted in the
 * output regardless, because silence would make a real gap look intended.
 */
// simile joins them, and for a reason that is a fact about the device rather than about
// the data: level comes from how common the word is, and a simile compares something to a
// SPECIFIC thing — stones, a rainstorm, a grain of seed. Specific nouns are not the
// commonest words in the Quran, so level 1 is empty by construction.
const PARTIAL_LEVELS = new Set(['negation', 'voice', 'simile']);
for (const kind of kinds) {
  for (let lv = 1; lv <= 5; lv += 1) {
    if (!liveBuckets.has(`${kind}|${lv}`)) {
      if (PARTIAL_LEVELS.has(kind)) {
        log(`               note: ${kind} has no level ${lv} — expected, see PARTIAL_LEVELS`);
        continue;
      }
      defects.push(
        `${kind} has no level ${lv} items — the level filter offers a level with ` +
          'nothing behind it'
      );
    }
  }
}
const surahsSeen = new Set(chosen.map((e) => e.surah));
if (surahsSeen.size < 100) {
  defects.push(
    `only ${surahsSeen.size} of 114 surahs represented — the cap is taking the ` +
      'head of an ordered list again rather than spreading'
  );
}
if (defects.length) {
  for (const d of defects.slice(0, 20)) process.stderr.write(`  ✘ ${d}\n`);
  process.stderr.write(`\n${defects.length} defect(s); refusing to emit.\n`);
  process.exit(1);
}
log(`           validated: ${chosen.length} exercises, ${liveBuckets.size} buckets, ${surahsSeen.size}/114 surahs`);

log(`exercises: ${exercises.length} candidates, ${chosen.length} selected`);
const byKind = {};
for (const e of chosen) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
log(`           by kind: ${JSON.stringify(byKind)}`);
const byLevel = {};
for (const e of chosen) byLevel[e.level] = (byLevel[e.level] ?? 0) + 1;
log(`           by level: ${JSON.stringify(byLevel)}`);

// ── Memorization curriculum, from the pinned text ─────────────────────────
const counts = new Map();
for (const line of textRaw.split('\n')) {
  const p = line.trim().split('|');
  if (p.length < 3) continue;
  const s = +p[0];
  if (!Number.isInteger(s)) continue;
  counts.set(s, (counts.get(s) ?? 0) + 1);
}

// Names come from content/surah-names.json, derived from src/app/lib/surahs.ts
// whose Arabic and transliterations were verified against Tanzil and quran.com.
// Committed rather than living in data/, which is gitignored.
const SURAH_NAMES = JSON.parse(
  await readFile(join(root, 'content/surah-names.json'), 'utf-8')
);

/** Chunk size grows with level: short surahs are learned whole. */
function chunkFor(total) {
  if (total <= 8) return total;
  if (total <= 20) return 5;
  if (total <= 60) return 6;
  return 8;
}

// Teaching order: shortest surahs first (they are the ones learned first in
// practice, and they sit at the end of the muṣḥaf), then outward by length.
const order = [...counts.entries()].sort((a, b) => a[1] - b[1] || b[0] - a[0]);

const units = [];
let seq = 1;
for (const [surah, total] of order) {
  const size = chunkFor(total);
  for (let from = 1; from <= total; from += size) {
    const to = Math.min(from + size - 1, total);
    const n = to - from + 1;
    const level =
      total <= 8 ? 1 :
      total <= 20 ? 2 :
      total <= 60 ? 3 :
      total <= 120 ? 4 :
      total <= 200 ? 5 : 6;
    units.push({
      id: `mu-${surah}-${from}-${to}`,
      sequence: seq++,
      level,
      surah, from, to, count: n,
      name: SURAH_NAMES?.[String(surah)] ?? `Surah ${surah}`,
      rationale:
        total === n
          ? `Whole surah — ${total} ayah${total === 1 ? '' : 's'}, short enough to memorise as one unit.`
          : `Ayahs ${from}–${to} of ${total}. Grouped in ${size}s to keep each session reviewable.`,
    });
  }
}
log(`memorization: ${units.length} units across ${counts.size} surahs`);

// ── Emit ───────────────────────────────────────────────────────────────────
const q = (v) =>
  v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const out = [];
out.push('-- Generated by scripts/gen-derived-content.mjs — do not edit by hand.');
out.push('-- Quranic Arabic Corpus v0.4 (Kais Dukes, GNU GPL) https://corpus.quran.com');
out.push('-- Tanzil Uthmani text (CC-BY) https://tanzil.net');
// Delete only the kinds THIS generator owns. A blanket DELETE here would wipe
// the comprehension items produced by gen-comprehension.mjs, so running the two
// scripts in the wrong order would silently halve the bank.
out.push(
  // Derived from what is actually emitted, not hardcoded.
  //
  // The list was fixed at the original five kinds, so adding five more left this
  // deleting a subset of what it then inserted. INSERT OR REPLACE hides that while ids
  // stay stable, and stops hiding it the moment selection changes — the new kinds would
  // keep rows for items no longer chosen, which is how a bank grows stale entries nobody
  // put there.
  'DELETE FROM grammar_exercise_bank WHERE kind IN (' +
    [...new Set(chosen.map((e) => e.kind))].map((k) => `'${k}'`).join(',') +
    ');'
);
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
out.push('DELETE FROM memorization_units;');
for (const u of units) {
  out.push(
    'INSERT OR REPLACE INTO memorization_units (id, sequence, level, surah_id, ayah_from, ayah_to, ayah_count, surah_name, rationale) VALUES (' +
      [
        q(u.id), u.sequence, u.level, u.surah, u.from, u.to, u.count,
        q(u.name), q(u.rationale),
      ].join(', ') + ');'
  );
}

process.stdout.write(out.join('\n') + '\n');
log(`emitted ${chosen.length} exercises and ${units.length} memorization units`);
