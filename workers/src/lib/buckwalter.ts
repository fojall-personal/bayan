// Buckwalter transliteration → Arabic script.
//
// The Quranic Arabic Corpus stores everything in Buckwalter: forms, lemmas and
// roots all arrive as ASCII. `qamaru`, `kita`b`, `{ll~ah`. None of that can be
// shown to a learner, so every corpus-derived feature — the root families behind
// F8, the pattern drills behind F9 — needs this first.
//
// Buckwalter is a strict one-to-one mapping onto Arabic codepoints, which is why
// it is used for corpora: it round-trips. That also makes it exhaustively
// testable, so this module is a table plus two functions rather than anything
// clever.

/** Buckwalter character → Arabic codepoint. */
const TO_ARABIC: Record<string, string> = {
  // Hamza carriers
  "'": 'ء',
  '|': 'آ',
  '>': 'أ',
  '&': 'ؤ',
  '<': 'إ',
  '}': 'ئ',
  '{': 'ٱ', // alef wasla — very common in Quranic orthography

  // Consonants
  A: 'ا',
  b: 'ب',
  p: 'ة', // teh marbuta
  t: 'ت',
  v: 'ث',
  j: 'ج',
  H: 'ح',
  x: 'خ',
  d: 'د',
  '*': 'ذ',
  r: 'ر',
  z: 'ز',
  s: 'س',
  $: 'ش',
  S: 'ص',
  D: 'ض',
  T: 'ط',
  Z: 'ظ',
  E: 'ع',
  g: 'غ',
  f: 'ف',
  q: 'ق',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  h: 'ه',
  w: 'و',
  Y: 'ى', // alef maksura
  y: 'ي',
  _: 'ـ', // tatweel

  // Diacritics
  F: 'ً', // fathatan
  N: 'ٌ', // dammatan
  K: 'ٍ', // kasratan
  a: 'َ', // fatha
  u: 'ُ', // damma
  i: 'ِ', // kasra
  '~': 'ّ', // shadda
  o: 'ْ', // sukun
  '`': 'ٰ', // dagger/superscript alef

  // ── Quranic annotation marks ────────────────────────────────────────────
  //
  // The corpus uses an EXTENDED Buckwalter for the mushaf's annotation marks,
  // and these are not in the standard table. Without them 12,795 forms rendered
  // with stray ASCII: ضَّا^لِّينَ instead of ضَّآلِّينَ.
  //
  // Derived empirically rather than from memory. Each corpus word was rebuilt
  // from its segments, mapped with the known table, and diffed against the same
  // word in the pinned Tanzil text; the leftover codepoint identifies the
  // character. Confidence ran 90–100% per mark, the shortfall being alignment
  // noise rather than disagreement.
  //
  // Corroboration: [ and ] resolve to the small high and small low meem, which
  // are independently the two iqlab notation marks found while fixing the
  // tajweed colouring. Two separate investigations agreeing is worth more than
  // either alone.
  '^': 'ٓ', // U+0653 maddah above                       (5,376 occurrences)
  '@': '۟', // U+06DF small high rounded zero — silent    (3,988)
  ',': 'ۥ', // U+06E5 small waw                           (1,257)
  '.': 'ۦ', // U+06E6 small yeh                             (995)
  '[': 'ۢ', // U+06E2 small high meem — iqlab               (510)
  '#': 'ٔ', // U+0654 hamza above                           (496)
  ']': 'ۭ', // U+06ED small low meem — iqlab                 (99)
  '"': '۠', // U+06E0 small high upright rectangular zero     (66)
  ':': 'ۜ', // U+06DC small high seen                          (2)
  '-': '۪', // U+06EA empty centre low stop                    (1)
  '+': '۫', // U+06EB empty centre high stop                   (1)
  '!': 'ۨ', // U+06E8 small high noon                          (1)
  '%': '۬', // U+06EC rounded high stop with filled centre     (1)
  ';': 'ۣ', // U+06E3 small low seen                           (1)
};

/** Diacritics, for the unvocalised variant. */
const DIACRITICS = new Set(['F', 'N', 'K', 'a', 'u', 'i', '~', 'o']);

/**
 * Convert a Buckwalter string to Arabic script.
 *
 * Unmapped characters pass through unchanged rather than being dropped. A
 * silently shortened word is far worse than a visible stray character: it would
 * look like a real Arabic word and be the wrong one.
 */
export function buckwalterToArabic(input: string): string {
  let out = '';
  for (const ch of input ?? '') {
    out += TO_ARABIC[ch] ?? ch;
  }
  return out;
}

/** As above, with short vowels and sukun/shadda omitted. */
export function buckwalterToArabicBare(input: string): string {
  let out = '';
  for (const ch of input ?? '') {
    if (DIACRITICS.has(ch)) continue;
    out += TO_ARABIC[ch] ?? ch;
  }
  return out;
}

/**
 * Render a root for display: letters separated by spaces, the way roots are
 * conventionally written. `ktb` → `ك ت ب`.
 */
export function rootToArabic(root: string | null | undefined): string | null {
  if (!root) return null;
  const letters = [...root].map((c) => TO_ARABIC[c] ?? c);
  return letters.join(' ');
}

/** Any Buckwalter character this table does not know about. */
export function unmappedCharacters(input: string): string[] {
  return [...new Set([...(input ?? '')].filter((c) => !(c in TO_ARABIC)))];
}
