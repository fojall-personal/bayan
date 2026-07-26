/**
 * Buckwalter → Arabic.
 *
 * Every corpus-derived feature depends on this: the corpus stores forms, lemmas
 * and roots in ASCII, so without a correct mapping the root families and pattern
 * drills would show learners `kita`b` instead of كتاب.
 *
 * Buckwalter is one-to-one onto Arabic codepoints, so the mapping is exhaustively
 * checkable rather than a matter of judgement. Cases below use real strings taken
 * from the corpus, not invented ones.
 *
 * Worth remembering: lowercase a, u and i are DIACRITICS (fatha, damma, kasra),
 * not letters. The first draft of these tests expected qamar -> قمر when the
 * correct answer is قَمَر; the code was right and the expectations were wrong.
 */

import { describe, expect, it } from 'vitest';
import {
  buckwalterToArabic,
  buckwalterToArabicBare,
  rootToArabic,
  unmappedCharacters,
} from '../src/lib/buckwalter';

describe('buckwalterToArabic', () => {
  it('converts real corpus lemmas', () => {
    // 54:1 word 4 segment 2 — the word that was missing from the table entirely.
    expect(buckwalterToArabic('qamar')).toBe('قَمَر');
    expect(buckwalterToArabic('kataba')).toBe('كَتَبَ');
  });

  it('handles the alef wasla, which is everywhere in Quranic orthography', () => {
    // Built from codepoints, not a literal: shadda (U+0651) precedes fatha
    // (U+064E) here, and the two orderings are visually identical in an editor.
    const allah = '\u0671\u0644\u0644\u0651\u064E\u0647'; // ٱ ل ل ّ َ ه
    expect(buckwalterToArabic('{ll~ah')).toBe(allah);
  });

  it('handles the dagger alef', () => {
    // `kita`b` — the backtick is the superscript alef, not a stray character.
    expect(buckwalterToArabic('kita`b')).toBe('كِتَٰب');
  });

  it('maps every hamza carrier distinctly', () => {
    expect(buckwalterToArabic("'")).toBe('ء');
    expect(buckwalterToArabic('|')).toBe('آ');
    expect(buckwalterToArabic('>')).toBe('أ');
    expect(buckwalterToArabic('<')).toBe('إ');
    expect(buckwalterToArabic('&')).toBe('ؤ');
    expect(buckwalterToArabic('}')).toBe('ئ');
  });

  it('distinguishes alef maksura from yeh — Y vs y', () => {
    expect(buckwalterToArabic('Y')).toBe('ى');
    expect(buckwalterToArabic('y')).toBe('ي');
  });

  it('distinguishes teh marbuta from heh — p vs h', () => {
    expect(buckwalterToArabic('p')).toBe('ة');
    expect(buckwalterToArabic('h')).toBe('ه');
  });

  it('maps the emphatic consonants, where case is the only difference', () => {
    // Getting any of these backwards silently produces a different word.
    expect(buckwalterToArabic('s')).toBe('س');
    expect(buckwalterToArabic('S')).toBe('ص');
    expect(buckwalterToArabic('d')).toBe('د');
    expect(buckwalterToArabic('D')).toBe('ض');
    expect(buckwalterToArabic('t')).toBe('ت');
    expect(buckwalterToArabic('T')).toBe('ط');
    expect(buckwalterToArabic('z')).toBe('ز');
    expect(buckwalterToArabic('Z')).toBe('ظ');
    expect(buckwalterToArabic('h')).toBe('ه');
    expect(buckwalterToArabic('H')).toBe('ح');
  });

  it('passes unknown characters through rather than dropping them', () => {
    // A silently shortened word looks like a real Arabic word and is the wrong
    // one. A visible stray character is a bug you can see.
    // Uses '=' rather than '#': # WAS the example here until it turned out to
    // be U+0654 hamza above in the corpus's extended table. Nearly every ASCII
    // character carries meaning there, so pick one that does not.
    expect(buckwalterToArabic('qamar=')).toBe('قَمَر=');
  });

  it('returns empty for empty input', () => {
    expect(buckwalterToArabic('')).toBe('');
  });
});

describe('buckwalterToArabicBare', () => {
  it('drops short vowels, shadda and sukun', () => {
    expect(buckwalterToArabicBare('kataba')).toBe('كتب');
    expect(buckwalterToArabicBare('{ll~ah')).toBe('ٱلله');
    expect(buckwalterToArabicBare('qamaru')).toBe('قمر');
  });

  it('keeps letters that are not diacritics', () => {
    // The dagger alef is a letter-like mark, not a short vowel.
    expect(buckwalterToArabicBare('kita`b')).toBe('كتٰب');
  });
});

describe('rootToArabic', () => {
  it('spaces the letters, as roots are conventionally written', () => {
    expect(rootToArabic('ktb')).toBe('ك ت ب');
    expect(rootToArabic('qmr')).toBe('ق م ر');
  });

  it('handles a hamzated root', () => {
    // The root of الله, which the corpus writes with a bare alef.
    expect(rootToArabic('Alh')).toBe('ا ل ه');
  });

  it('returns null for absent roots rather than an empty string', () => {
    // 58% of segments have no root — particles and pronouns. Null lets the
    // caller say "not annotated" instead of rendering blank.
    expect(rootToArabic(null)).toBeNull();
    expect(rootToArabic(undefined)).toBeNull();
    expect(rootToArabic('')).toBeNull();
  });
});

describe('unmappedCharacters', () => {
  it('reports nothing for well-formed corpus strings', () => {
    for (const s of ['qamar', '{ll~ah', 'kita`b', '{qotarabati', 's~aAEapu']) {
      expect(unmappedCharacters(s)).toEqual([]);
    }
  });

  it('reports genuinely unknown characters', () => {
    // '#' and '@' were the original examples; both are mapped now.
    expect(unmappedCharacters('qamar=?')).toEqual(['=', '?']);
  });
});

describe('extended Buckwalter — Quranic annotation marks', () => {
  // The corpus uses an extended table the standard mapping omits. Without these
  // 12,795 forms rendered with stray ASCII, e.g. ضَّا^لِّينَ for ضَّآلِّينَ.
  // Mappings were derived by diffing corpus words against the pinned Tanzil
  // text, not recalled.
  it('maps the maddah above, the commonest of them', () => {
    expect(buckwalterToArabic('^')).toBe('\u0653');
  });

  it('maps the silent-letter zero', () => {
    expect(buckwalterToArabic('@')).toBe('\u06DF');
  });

  it('maps the small waw and small yeh, which are distinct', () => {
    expect(buckwalterToArabic(',')).toBe('\u06E5');
    expect(buckwalterToArabic('.')).toBe('\u06E6');
  });

  it('maps both iqlab meems — the same marks the tajweed work identified', () => {
    // [ is the small HIGH meem, ] the small LOW meem. Two independent
    // investigations landing on the same pair is the corroboration here.
    expect(buckwalterToArabic('[')).toBe('\u06E2');
    expect(buckwalterToArabic(']')).toBe('\u06ED');
  });

  it('leaves no ASCII in a real annotated corpus form', () => {
    // 1:7 ٱلضَّآلِّينَ — the word that exposed the gap.
    const out = buckwalterToArabic('D~aA^l~iyna');
    expect(/[\x21-\x7E]/.test(out)).toBe(false);
    expect(out).toContain('\u0653');
  });

  it('reports no unmapped characters across a sample of annotated forms', () => {
    for (const f of ['D~aA^l~iyna', '>uw@la`^}ika', 'hu,', 'hi.', '>aliymN[', 'kaAfirK]']) {
      expect(unmappedCharacters(f)).toEqual([]);
    }
  });
});
