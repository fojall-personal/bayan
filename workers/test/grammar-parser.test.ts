/**
 * Correctness tests for the hand-rolled grammar parser behind
 * POST /api/grammar/parse, which had no dedicated unit test — only
 * auth/malformed-body checks in routes.test.ts, never the parse output itself.
 *
 * ── The substring bug (fixed 2026-08-09) ──────────────────────────────────
 *
 * parseSingleWord() used to check the PARTICLES list with a *substring* test
 * (`word.includes(p) || p.includes(word)`) before ever reaching
 * isVerb/isPreposition/isAdjective. Two single-letter particles (`ب`, `أ`) are
 * common Arabic letters, so any word merely *containing* one — كتب (he wrote),
 * كتاب (book), بيت (house), قلب (heart), امرأة (woman), كبير (big) — was
 * misclassified as a particle before ever reaching real classification. That
 * made isVerb's five past-tense branches (all requiring a literal ب)
 * effectively dead code, which in turn made checkGrammarErrors' gender_
 * agreement check dead too, since it is gated on tense === 'past'.
 *
 * PARTICLES was also a superset of isPreposition()'s own list (في، من، إلى،
 * على، عن، ب، لـ، كـ), checked first, so isPreposition() itself could never
 * fire — every preposition came back tagged 'particle'.
 *
 * Both are fixed: PARTICLES now matches exactly rather than by substring, and
 * no longer duplicates the preposition list. The tests below cover both the
 * words that were always correctly classified AND the ones the bug used to
 * swallow, so a regression to substring matching fails visibly.
 */
import { describe, expect, it } from 'vitest';
import { checkGrammarErrors, parseArabicSentence } from '../src/lib/grammar-parser';

describe('parseArabicSentence — word-level classification', () => {
  it('recognizes a listed particle', () => {
    const { words } = parseArabicSentence('قد');
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ text: 'قد', type: 'particle' });
  });

  it('recognizes a listed preposition, not a generic particle', () => {
    // في is a preposition (isPreposition()'s own list), not one of PARTICLES —
    // this is exactly the case the substring bug always misrouted to 'particle'.
    const { words } = parseArabicSentence('في');
    expect(words[0]).toMatchObject({ text: 'في', type: 'preposition' });
  });

  it('recognizes a listed pronoun', () => {
    const { words } = parseArabicSentence('نحن');
    expect(words[0]).toMatchObject({ text: 'نحن', type: 'pronoun' });
  });

  it('recognizes a listed adjective', () => {
    const { words } = parseArabicSentence('جميل');
    expect(words[0]).toMatchObject({ text: 'جميل', type: 'adjective' });
  });

  it('recognizes an adjective that contains a particle letter', () => {
    // كبير contains ب — under the substring bug this matched PARTICLES' 'ب'
    // and never reached isAdjective at all.
    const { words } = parseArabicSentence('كبير');
    expect(words[0]).toMatchObject({ text: 'كبير', type: 'adjective' });
  });

  it('detects a present-tense verb and its definition', () => {
    const { words } = parseArabicSentence('يقول');
    expect(words[0]).toMatchObject({
      text: 'يقول',
      type: 'verb',
      tense: 'present',
      definition: 'he says',
    });
  });

  it('detects a past-tense verb — the branch the substring bug made dead code', () => {
    // كتب ends in ب, which used to match PARTICLES' 'ب' before isVerb ever ran.
    const { words } = parseArabicSentence('كتب');
    expect(words[0]).toMatchObject({
      text: 'كتب',
      type: 'verb',
      tense: 'past',
      definition: 'he wrote',
    });
  });

  it('falls back to a gendered noun with its definition when nothing else matches', () => {
    const { words } = parseArabicSentence('قمر');
    expect(words[0]).toMatchObject({
      text: 'قمر',
      type: 'noun',
      gender: 'masculine',
      definition: 'moon',
    });
  });

  it('resolves noun gender even without a dictionary definition', () => {
    const { words } = parseArabicSentence('يد');
    expect(words[0]).toMatchObject({ text: 'يد', type: 'noun', gender: 'feminine' });
    expect(words[0].definition).toBeUndefined();
  });

  it('resolves a noun whose spelling contains a particle letter', () => {
    // كتاب (book) and بيت (house) both contain ب, and بنت (girl) used to be
    // unreachable a second way — its GENDERED_NOUNS key had a stray leading
    // space (' بنت') that could never match the real, trimmed word.
    expect(parseArabicSentence('كتاب').words[0]).toMatchObject({
      text: 'كتاب', type: 'noun', gender: 'masculine', definition: 'book',
    });
    expect(parseArabicSentence('بيت').words[0]).toMatchObject({
      text: 'بيت', type: 'noun', gender: 'masculine', definition: 'house',
    });
    expect(parseArabicSentence('بنت').words[0]).toMatchObject({
      text: 'بنت', type: 'noun', gender: 'feminine', definition: 'girl',
    });
  });
});

describe('parseArabicSentence — sentence structure', () => {
  it('pronoun subject + present verb predicate is VS, with no object', () => {
    const parsed = parseArabicSentence('هو يقول');
    expect(parsed.structure).toBe('VS');
    expect(parsed.subject).toMatchObject({ text: 'هو', type: 'pronoun' });
    expect(parsed.predicate).toMatchObject({ text: 'يقول', type: 'verb', tense: 'present' });
    expect(parsed.object).toBeUndefined();
  });

  it('a bare present-tense verb has a predicate but no subject', () => {
    const parsed = parseArabicSentence('يقول');
    expect(parsed.structure).toBe('V...');
    expect(parsed.predicate).toMatchObject({ text: 'يقول' });
    expect(parsed.subject).toBeUndefined();
  });

  it('subject + verb + trailing noun is VSO, with the noun as object', () => {
    const parsed = parseArabicSentence('هو يقول قمر');
    expect(parsed.structure).toBe('VSO');
    expect(parsed.subject).toMatchObject({ text: 'هو' });
    expect(parsed.predicate).toMatchObject({ text: 'يقول' });
    expect(parsed.object).toMatchObject({ text: 'قمر', type: 'noun', gender: 'masculine' });
  });
});

describe('checkGrammarErrors', () => {
  it('flags a present-tense verb with no subject', () => {
    const parsed = parseArabicSentence('يقول');
    const errors = checkGrammarErrors('يقول', parsed);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ type: 'missing_subject', word: 'يقول' });
  });

  it('raises no errors when a present-tense verb has a subject', () => {
    const parsed = parseArabicSentence('هو يقول');
    const errors = checkGrammarErrors('هو يقول', parsed);
    expect(errors).toEqual([]);
  });

  it('flags gender disagreement between a feminine subject and a past-tense verb', () => {
    // This check is gated on predicate.tense === 'past', which the substring
    // bug made unreachable (every candidate past-tense verb was misclassified
    // as a particle before tense was ever assigned). شمس is a clean feminine
    // noun; كتب is a past-tense verb not ending in ت, so it must disagree.
    const parsed = parseArabicSentence('شمس كتب');
    expect(parsed.subject).toMatchObject({ text: 'شمس', gender: 'feminine' });
    expect(parsed.predicate).toMatchObject({ text: 'كتب', tense: 'past' });
    const errors = checkGrammarErrors('شمس كتب', parsed);
    expect(errors).toContainEqual(
      expect.objectContaining({ type: 'gender_agreement', word: 'كتب' })
    );
  });
});
