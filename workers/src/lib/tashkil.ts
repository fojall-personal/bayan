/**
 * Producing the case ending (i'rab) of a Quranic word — restore it, don't just
 * recognise it.
 *
 * ── Why only the FINAL diacritic, not full vowelling ─────────────────────────
 *
 * Full tashkil of a whole ayah is a punishing first rung and the grading is noisy.
 * The final diacritic of a word IS the i'rab — nominative/accusative/genitive case
 * (رفع/نصب/جر), or the indefinite tanwin variants — which is the actual grammatical
 * skill this drills. Internal vowels are left exactly as given.
 *
 * ── Why sukun is not in the stripped set ──────────────────────────────────────
 *
 * Sukun marks the ABSENCE of a case vowel — a resting consonant, or a jussive
 * verb's mood marker — not one of the three cases this drill quizzes. مِنْ (a
 * preposition, mabni — indeclinable) keeps its trailing sukun exactly as written;
 * there is no case ending to restore on a word that never takes one.
 */

const FATHA = 0x064e;
const DAMMA = 0x064f;
const KASRA = 0x0650;
const FATHATAN = 0x064b;
const DAMMATAN = 0x064c;
const KASRATAN = 0x064d;

const FINAL_CASE_MARKS = new Set([FATHA, DAMMA, KASRA, FATHATAN, DAMMATAN, KASRATAN]);

/**
 * Strip the final case-ending diacritic from a single word.
 *
 * Everything else stays untouched, including a shadda immediately before the
 * ending — the shadda belongs to the consonant, not the case vowel, so removing
 * only the last codepoint (when it is one of the marks above) leaves it in place
 * automatically.
 *
 * Codepoint arithmetic rather than a character class: inline Arabic ranges have
 * repeatedly swallowed the letters themselves in this codebase (see
 * tutor-grounding.ts's normaliseArabic, which once normalised every word to the
 * empty string) — spreading by code point and checking only the last one avoids
 * that class of bug entirely.
 */
export function stripFinalHarakat(word: string): string {
  if (!word) return word;
  const chars = [...word];
  const cp = chars[chars.length - 1]?.codePointAt(0) ?? 0;
  if (!FINAL_CASE_MARKS.has(cp)) return word;
  return chars.slice(0, -1).join('');
}

export interface TashkilResult {
  correct: boolean;
  accuracy: number;
  /** Indices into the expected word list that did not match exactly. */
  missed: number[];
}

/**
 * Grade a restored ending, word by word.
 *
 * Same result shape as arabic-compare's gradeRecall (correct/accuracy/missed), so
 * the UI can share the same diff-rendering code between the two item types.
 *
 * Exact string match per word rather than comparing endings in isolation: the
 * palette UI reconstructs each word as strippedWord + chosenMark, so an exact
 * match against the Uthmani original already is the ending check — nothing else
 * in the word can differ.
 */
export function gradeTashkil(expected: string, given: string): TashkilResult {
  const exp = expected.trim().split(/\s+/).filter(Boolean);
  const got = given.trim().split(/\s+/).filter(Boolean);
  const missed: number[] = [];
  let matched = 0;
  for (let i = 0; i < exp.length; i += 1) {
    if (got[i] !== undefined && got[i] === exp[i]) matched += 1;
    else missed.push(i);
  }
  const accuracy = exp.length === 0 ? 0 : matched / exp.length;
  return {
    correct: missed.length === 0,
    accuracy,
    missed,
  };
}
