/**
 * Correctness tests for the hand-rolled grammar parser behind
 * POST /api/grammar/parse, which had no dedicated unit test — only
 * auth/malformed-body checks in routes.test.ts, never the parse output itself.
 *
 * A note on the words chosen: parseSingleWord() checks the PARTICLES list
 * (via a *substring* test — `word.includes(p) || p.includes(word)`) before it
 * ever checks isVerb/isPreposition/isAdjective. Several single-letter
 * particles (`ب`, `أ`) are common Arabic letters, so many real words that
 * *contain* one — كتب, بيت, باب, كبير, امرأة — are swallowed by the particle
 * branch before reaching verb/adjective detection. That is a real, separate
 * bug, not something to route around silently — every word below was traced
 * against the actual PARTICLES list and confirmed to reach the branch it is
 * asserted against, so these tests describe genuinely correct output, not
 * output that merely matches whatever the code currently does.
 */
import { describe, expect, it } from 'vitest';
import { checkGrammarErrors, parseArabicSentence } from '../src/lib/grammar-parser';

describe('parseArabicSentence — word-level classification', () => {
  it('recognizes a listed particle', () => {
    const { words } = parseArabicSentence('في');
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ text: 'في', type: 'particle' });
  });

  it('recognizes a listed pronoun', () => {
    const { words } = parseArabicSentence('نحن');
    expect(words[0]).toMatchObject({ text: 'نحن', type: 'pronoun' });
  });

  it('recognizes a listed adjective', () => {
    const { words } = parseArabicSentence('جميل');
    expect(words[0]).toMatchObject({ text: 'جميل', type: 'adjective' });
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
});
