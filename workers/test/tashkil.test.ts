import { describe, expect, it } from 'vitest';
import { stripFinalHarakat, gradeTashkil } from '../src/lib/tashkil';

describe('stripFinalHarakat', () => {
  it('removes only the final diacritic, keeping internal vowels', () => {
    // الْحَمْدُ -> الْحَمْد : internal sukun/fatha stay, the final damma goes.
    const out = stripFinalHarakat('الْحَمْدُ');
    expect(out).not.toMatch(/ُ$/);
    expect(out).toMatch(/َ/); // the internal fatha survives
  });

  it('leaves a word that has no final diacritic unchanged', () => {
    expect(stripFinalHarakat('مِنْ')).toBe('مِنْ');
  });
});

describe('gradeTashkil', () => {
  it('accepts the exact ending', () => {
    expect(gradeTashkil('الْحَمْدُ', 'الْحَمْدُ').correct).toBe(true);
  });

  it('rejects the wrong case', () => {
    // damma (nominative) vs fatha (accusative) is the whole point.
    expect(gradeTashkil('الْحَمْدُ', 'الْحَمْدَ').correct).toBe(false);
  });

  it('reports which words were wrong', () => {
    const r = gradeTashkil('الْحَمْدُ لِلَّهِ', 'الْحَمْدَ لِلَّهِ');
    expect(r.missed).toEqual([0]);
    expect(r.accuracy).toBeCloseTo(0.5);
  });
});
