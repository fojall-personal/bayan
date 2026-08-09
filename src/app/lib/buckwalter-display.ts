/**
 * Render vocalised Buckwalter as Arabic.
 *
 * ── Why this is not `rootToArabic` ──────────────────────────────────────────
 *
 * `arabic-root.ts` maps CONSONANTS only, because a root carries no vowels — `qwl`
 * is three letters and nothing else. Function-word lemmas are different: they come
 * out of the corpus fully vocalised, so `min`, `<in~` and `{l~a*iY` contain short
 * vowels, shadda, sukun and the alef wasla.
 *
 * Passing those through the root converter looks like it works and does not. The
 * unmapped characters fall through by design (a mapping gap should be visible), so
 * `min` renders as `مiن` — an Arabic meem, a Latin i, an Arabic noon. Measured
 * across the twelve commonest function words, every single one came out wrong.
 *
 * Hence a second table rather than an extension of the first. Keeping the root
 * converter consonant-only is correct for roots; this one adds the marks.
 *
 * Codepoints are written as escapes, not literal glyphs. The combining marks are
 * invisible in a source file, and a reviewer cannot tell U+064E from U+0650 by
 * looking — this repo has already lost time to Arabic characters that were not
 * what they appeared to be.
 */

/** Buckwalter → Arabic, letters AND diacritics. */
const TO_ARABIC: Record<string, string> = {
  // Hamza carriers
  "'": '\u0621', // ء
  '|': '\u0622', // آ
  '>': '\u0623', // أ
  '&': '\u0624', // ؤ
  '<': '\u0625', // إ
  '}': '\u0626', // ئ
  '{': '\u0671', // ٱ  alef wasla — common in Quranic orthography
  // Consonants
  A: '\u0627', b: '\u0628', p: '\u0629', t: '\u062a', v: '\u062b',
  j: '\u062c', H: '\u062d', x: '\u062e', d: '\u062f', '*': '\u0630',
  r: '\u0631', z: '\u0632', s: '\u0633', $: '\u0634', S: '\u0635',
  D: '\u0636', T: '\u0637', Z: '\u0638', E: '\u0639', g: '\u063a',
  f: '\u0641', q: '\u0642', k: '\u0643', l: '\u0644', m: '\u0645',
  n: '\u0646', h: '\u0647', w: '\u0648', y: '\u064a', Y: '\u0649',
  // Diacritics — the reason this file exists
  a: '\u064e', // fatha
  u: '\u064f', // damma
  i: '\u0650', // kasra
  '~': '\u0651', // shadda
  o: '\u0652', // sukun
  F: '\u064b', // fathatan
  N: '\u064c', // dammatan
  K: '\u064d', // kasratan
  '`': '\u0670', // dagger alef (superscript)
  _: '\u0640', // tatweel
};

/**
 * A vocalised lemma as Arabic: `<in~` → `إِنَّ`, `{l~a*iY` → `ٱلَّذِى`.
 *
 * Unknown characters pass through rather than being dropped, so a mapping gap shows
 * as visible Latin instead of a silently shorter word. `lawolaA^` keeps its `^`
 * for exactly that reason — the corpus uses a madda marker this table does not
 * carry, and showing it is better than pretending the word is complete.
 */
export function buckwalterToArabic(text: string | null | undefined): string {
  if (!text) return '';
  return [...text].map((c) => TO_ARABIC[c] ?? c).join('');
}

/**
 * Human-readable name for a corpus part-of-speech tag.
 *
 * The raw values are corpus abbreviations — `REL`, `ACC`, `PREV` — and showing them
 * to a learner would be leaking an annotation scheme into the UI. Only the tags that
 * actually occur on unrooted words are listed; anything else falls back to the raw
 * tag, which is visible rather than silently blank.
 */
const POS_NAMES: Record<string, string> = {
  P: 'preposition',
  CONJ: 'conjunction',
  REL: 'relative pronoun',
  ACC: 'accusative particle',
  NEG: 'negation',
  DEM: 'demonstrative',
  COND: 'conditional',
  SUB: 'subordinating conjunction',
  RES: 'restriction',
  INTG: 'interrogative',
  PRON: 'pronoun',
  PRO: 'prohibition',
  PREV: 'preventive',
  SUP: 'supplemental',
  CERT: 'certainty particle',
  T: 'time adverb',
  LOC: 'location adverb',
  INC: 'inceptive',
  INT: 'interpretation',
  EXH: 'exhortation',
  AMD: 'amendment',
  ANS: 'answer',
  AVR: 'aversion',
  CAUS: 'causative',
  CIRC: 'circumstantial',
  EQ: 'equalisation',
  EXP: 'exceptive',
  FUT: 'future',
  IMPV: 'imperative',
  REM: 'resumption',
  RET: 'retraction',
  RSLT: 'result',
  SUR: 'surprise',
  VOC: 'vocative',
  PN: 'proper noun',
};

export function posName(pos: string | null | undefined): string {
  if (!pos) return '';
  return POS_NAMES[pos] ?? pos;
}
