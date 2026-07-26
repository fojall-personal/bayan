/**
 * Render a Buckwalter root as Arabic.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * The same fifteen lines were copy-pasted into three components, and all three
 * joined the letters with a space — so every root in the app rendered as isolated
 * standalone glyphs (ق و ل) instead of a connected word (قول). Arabic is cursive:
 * a space between letters is a word boundary, and the shaping engine correctly
 * gives you the isolated form on both sides of it. The letters were never going to
 * connect.
 *
 * Joining with nothing lets the shaping engine decide, which is the whole point —
 * it knows that ق connects forward, that و does not, and that a final ل takes its
 * connected form. Hard-coding a separator overrides all of that.
 *
 * One exported helper, imported everywhere, because three copies is how the space
 * survived in three places at once.
 */

/** Buckwalter → Arabic, letters only. Roots carry no vowels. */
const TO_ARABIC: Record<string, string> = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ',
  A: 'ا', b: 'ب', p: 'ة', t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ',
  d: 'د', '*': 'ذ', r: 'ر', z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض',
  T: 'ط', Z: 'ظ', E: 'ع', g: 'غ', f: 'ف', q: 'ق', k: 'ك', l: 'ل',
  m: 'م', n: 'ن', h: 'ه', w: 'و', y: 'ي', Y: 'ى', '`': 'ٰ',
};

/**
 * The root as a connected Arabic word: `qwl` → `قول`.
 *
 * Unknown characters pass through rather than being dropped, so a mapping gap shows
 * up as visible Latin instead of a silently shorter root.
 */
export function rootToArabic(root: string | null | undefined): string {
  if (!root) return '';
  return [...root].map((c) => TO_ARABIC[c] ?? c).join('');
}

/**
 * The root spelled out letter by letter, for the rare case where the individual
 * letters ARE the subject — teaching that كتب is ك, ت, then ب.
 *
 * Uses a thin space rather than a plain one so it reads as a spelling-out rather
 * than as three separate words. Not the default: the default is a word.
 */
export function rootSpelledOut(root: string | null | undefined): string {
  if (!root) return '';
  return [...root].map((c) => TO_ARABIC[c] ?? c).join(' ');
}
