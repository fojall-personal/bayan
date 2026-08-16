import { describe, expect, it } from 'vitest';
import {
  foldElidedToken,
  pngKey,
  shouldEmitElidedSubject,
} from '../src/lib/elided';

describe('elided-subject emit rule', () => {
  const attested1P = new Set(['نحن', 'لنا']);
  const attested3MS = new Set(['هو']);

  it('emits when the treebank token matches written pronouns of the head verb PNG', () => {
    expect(
      shouldEmitElidedSubject({
        implied: true,
        rel: 'Subj',
        token: '(نحْنُ)',
        headImplied: false,
        headPos: 'V',
        headPng: '1P',
        attestedFolds: attested1P,
      })
    ).toBe(true);
  });

  it('drops a reconstruction that disagrees with the head verb PNG', () => {
    // Measured: 38 of the 59 rejections are a 3FS verb reconstructed as أَنْتَ.
    expect(
      shouldEmitElidedSubject({
        implied: true,
        rel: 'Subj',
        token: 'أَنْتَ',
        headImplied: false,
        headPos: 'V',
        headPng: '3FS',
        attestedFolds: new Set(['هي']),
      })
    ).toBe(false);
  });

  it('drops an empty reconstruction and a non-verb head', () => {
    expect(
      shouldEmitElidedSubject({
        implied: true,
        rel: 'Subj',
        token: '(*)',
        headImplied: false,
        headPos: 'V',
        headPng: '1P',
        attestedFolds: attested1P,
      })
    ).toBe(false);
    expect(
      shouldEmitElidedSubject({
        implied: true,
        rel: 'Subj',
        token: 'هُوَ',
        headImplied: false,
        headPos: 'N',
        headPng: '3MS',
        attestedFolds: attested3MS,
      })
    ).toBe(false);
  });

  it('folds dagger-alef and hamza the same way written pronouns are folded', () => {
    expect(foldElidedToken('(أَنَا۠)')).toBe('انا');
    expect(foldElidedToken('نحْنُ')).toBe('نحن');
    expect(pngKey('1', null, 'P')).toBe('1P');
    expect(pngKey('3', 'M', 'S')).toBe('3MS');
    expect(pngKey('1', null, null)).toBeNull();
  });
});
