/**
 * Tutor question classification.
 *
 * The tutor it replaces was a keyword matcher that invented Arabic: its madd
 * answer offered السَّآمَّة and الْحَآئِرِينَ as canonical examples, and neither
 * occurs anywhere in the Quran — 0 occurrences each, checked against the pinned
 * text, while الضَّآلِّينَ (6), السَّمَآء (118) and جَآءَ (238) sit in data it
 * never consulted.
 *
 * Classification is all this module does. Answers are record lookups in the
 * route, so there is nothing here that can make a claim about Arabic.
 */

import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES_REPLY,
  classify,
  normaliseArabic,
  topicsFor,
} from '../src/lib/tutor-grounding';

describe('normaliseArabic', () => {
  it('strips diacritics without eating the letters', () => {
    // Written with codepoint arithmetic precisely because inline Arabic
    // character classes have swallowed the letters repeatedly in this codebase.
    expect(normaliseArabic('قَالَ')).toBe('قال');
    expect(normaliseArabic('ٱلْحَمْدُ')).toBe('الحمد');
  });

  it('folds the alef variants together', () => {
    expect(normaliseArabic('أَحَد')).toBe(normaliseArabic('احد'));
    expect(normaliseArabic('إِنَّ')).toBe(normaliseArabic('ان'));
  });

  it('drops the dagger alef, which is a mark not a letter', () => {
    expect(normaliseArabic('كِتَٰب')).toBe('كتب');
  });

  it('returns empty for empty input rather than throwing', () => {
    expect(normaliseArabic('')).toBe('');
  });
});

describe('classify', () => {
  it('reads an explicit location', () => {
    expect(classify('explain 2:255')).toEqual({ kind: 'location', surah: 2, ayah: 255 });
    expect(classify('what is going on in 112:1')).toEqual({
      kind: 'location', surah: 112, ayah: 1,
    });
  });

  it('rejects a location outside 1–114 rather than querying for it', () => {
    // 200:1 is not a surah. Falling through to capabilities beats a confident 404.
    expect(classify('tell me about 200:1').kind).not.toBe('location');
  });

  it('reads a root request', () => {
    expect(classify('show me root ktb')).toEqual({ kind: 'root', root: 'ktb' });
    expect(classify('root Elm please')).toEqual({ kind: 'root', root: 'Elm' });
  });

  it('treats pasted Arabic as a word question', () => {
    const intent = classify('what does ٱلْحَمْدُ mean?');
    expect(intent.kind).toBe('word');
    if (intent.kind === 'word') expect(normaliseArabic(intent.arabic)).toBe('الحمد');
  });

  it('picks the longest Arabic run when several appear', () => {
    const intent = classify('is وَ different from ٱلرَّحْمَٰنِ ?');
    expect(intent.kind).toBe('word');
    if (intent.kind === 'word') expect(intent.arabic.length).toBeGreaterThan(2);
  });

  it('recognises tajweed rules by their English names', () => {
    expect(classify('explain madd')).toEqual({ kind: 'tajweed', rule: 'madd' });
    expect(classify('what is qalqalah')).toEqual({ kind: 'tajweed', rule: 'qalqalah' });
    expect(classify('tell me about ikhfa')).toEqual({ kind: 'tajweed', rule: 'noon_saakin' });
  });

  it('recognises a tajweed rule named in Arabic', () => {
    expect(classify('ما هي الغنة').kind).toBe('tajweed');
  });

  it('prefers an explicit location over a keyword in the same message', () => {
    // "madd in 2:255" is a question about the ayah, not a request for a lecture.
    expect(classify('show me the madd in 2:255')).toEqual({
      kind: 'location', surah: 2, ayah: 255,
    });
  });

  it('falls back to capabilities rather than guessing', () => {
    expect(classify('hello').kind).toBe('capabilities');
    expect(classify('').kind).toBe('capabilities');
    expect(classify('   ').kind).toBe('capabilities');
    // The old tutor answered this with generic study advice that read as helpful
    // and told the learner nothing.
    expect(classify('how do I get better').kind).toBe('capabilities');
  });
});

describe('topicsFor', () => {
  it('derives topics from the resolved intent, not a second keyword scan', () => {
    expect(topicsFor({ kind: 'tajweed', rule: 'madd' })).toEqual(['tajweed', 'madd']);
    expect(topicsFor({ kind: 'root', root: 'ktb' })).toContain('morphology');
    expect(topicsFor({ kind: 'word', arabic: 'قال' })).toEqual(['vocabulary']);
    expect(topicsFor({ kind: 'capabilities' })).toEqual([]);
  });
});

describe('CAPABILITIES_REPLY', () => {
  it('promises only what the data can answer', () => {
    expect(CAPABILITIES_REPLY).toMatch(/root/);
    expect(CAPABILITIES_REPLY).toMatch(/2:255/);
    expect(CAPABILITIES_REPLY).toMatch(/tajweed/);
    // It must say what it will do when it cannot answer.
    expect(CAPABILITIES_REPLY).toMatch(/rather than guess/);
  });

  it('makes no claim about specific Arabic words', () => {
    // The failure being designed out: a canned reply citing invented examples.
    for (const invented of ['السَّآمَّة', 'الْحَآئِرِينَ']) {
      expect(CAPABILITIES_REPLY).not.toContain(invented);
    }
  });
});
