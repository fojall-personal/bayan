/**
 * The tajweed reader's text segmentation.
 *
 * Lives here rather than in src/app because the frontend has no test runner and
 * this suite already runs in CI. The module under test is pure TypeScript with
 * no React, and src/app's own `tsc --noEmit` typechecks it.
 *
 * Every case below is a defect the previous `String.replace` renderer actually
 * produced on real data, not a hypothetical.
 */

import { describe, expect, it } from 'vitest';
import { segmentVerse, type RenderTag } from '../../src/app/lib/tajweed-render';

/** Al-Fatiha 1:1 from the pinned Tanzil Uthmani text — 38 codepoints. */
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/** Its real annotations, as returned by GET /api/tajweed/verses/1. */
const TAGS_1_1: RenderTag[] = [
  { rule: 'hamzat_wasl', start: 7, end: 8, color: '#94a3b8', category: 'hamzat_wasl' },
  { rule: 'hamzat_wasl', start: 15, end: 16, color: '#94a3b8', category: 'hamzat_wasl' },
  { rule: 'lam_shamsiyyah', start: 16, end: 17, color: '#14b8a6', category: 'lam_shamsiyyah' },
  { rule: 'madd_2', start: 24, end: 25, color: '#3b82f6', category: 'madd' },
  { rule: 'hamzat_wasl', start: 28, end: 29, color: '#94a3b8', category: 'hamzat_wasl' },
  { rule: 'lam_shamsiyyah', start: 29, end: 30, color: '#14b8a6', category: 'lam_shamsiyyah' },
  { rule: 'madd_246', start: 35, end: 36, color: '#3b82f6', category: 'madd' },
];

const coloured = (segs: ReturnType<typeof segmentVerse>) =>
  segs.filter((s) => s.color !== null);

describe('segmentVerse', () => {
  it('reassembles the ayah exactly', () => {
    // The single most important property: colouring must never alter the text.
    const segs = segmentVerse(BISMILLAH, TAGS_1_1);
    expect(segs.map((s) => s.text).join('')).toBe(BISMILLAH);
  });

  it('marks one codepoint per one-codepoint tag, not two', () => {
    // The old renderer read substring(start, end + 1) and highlighted "ٱل"
    // where the hamzat wasl is only "ٱ".
    const segs = segmentVerse(BISMILLAH, TAGS_1_1);
    for (const s of coloured(segs)) {
      expect([...s.text]).toHaveLength(1);
    }
  });

  it('places every one of the three hamzat wasl marks, at 7, 15 and 28', () => {
    // The old renderer collapsed all three onto the first ٱ, nested three deep,
    // and left the real 2nd and 3rd unmarked.
    const segs = segmentVerse(BISMILLAH, TAGS_1_1);
    const hamzas = segs.filter((s) => s.rule === 'hamzat_wasl');
    expect(hamzas).toHaveLength(3);
    for (const h of hamzas) expect(h.text).toBe('ٱ');

    // Confirm they sit at the right offsets by rebuilding positions from widths.
    const offsets: number[] = [];
    let pos = 0;
    for (const s of segs) {
      if (s.rule === 'hamzat_wasl') offsets.push(pos);
      pos += [...s.text].length;
    }
    expect(offsets).toEqual([7, 15, 28]);
  });

  it('produces exactly as many coloured runs as there are tags', () => {
    const segs = segmentVerse(BISMILLAH, TAGS_1_1);
    expect(coloured(segs)).toHaveLength(TAGS_1_1.length);
  });

  it('carries the colour and category through to each run', () => {
    const segs = segmentVerse(BISMILLAH, TAGS_1_1);
    const madd = segs.filter((s) => s.category === 'madd');
    expect(madd).toHaveLength(2);
    for (const m of madd) expect(m.color).toBe('#3b82f6');
  });

  it('returns the text untouched when there are no tags', () => {
    const segs = segmentVerse(BISMILLAH, []);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ text: BISMILLAH, color: null, rule: null });
  });

  it('handles an empty ayah without throwing', () => {
    expect(segmentVerse('', TAGS_1_1)).toEqual([]);
  });

  describe('overlaps — 40 pairs exist in the corpus', () => {
    // 2:18 is a real case: ghunnah [2,6) meets iqlab [4,8).
    const overlapping: RenderTag[] = [
      { rule: 'ghunnah', start: 2, end: 6, color: '#ec4899', category: 'ghunnah' },
      { rule: 'iqlab', start: 4, end: 8, color: '#22c55e', category: 'noon_saakin' },
    ];

    it('still reassembles the text exactly', () => {
      const text = 'ابcdefghij';
      expect(segmentVerse(text, overlapping).map((s) => s.text).join('')).toBe(text);
    });

    it('never assigns a codepoint to two tags', () => {
      const segs = segmentVerse('ابcdefghij', overlapping);
      const total = segs.reduce((n, s) => n + [...s.text].length, 0);
      expect(total).toBe(10);
    });

    it('gives a contested codepoint to the narrower tag', () => {
      // Equal widths here, so the earlier tag wins — the point is determinism.
      const narrow: RenderTag[] = [
        { rule: 'wide', start: 0, end: 6, color: '#111', category: 'a' },
        { rule: 'narrow', start: 2, end: 3, color: '#222', category: 'b' },
      ];
      const segs = segmentVerse('abcdefgh', narrow);
      const at2 = segs.find((s) => s.text === 'c');
      expect(at2?.rule).toBe('narrow');
    });
  });

  describe('legend hover', () => {
    it('keeps colour only on the highlighted category', () => {
      const segs = segmentVerse(BISMILLAH, TAGS_1_1, 'madd');
      const still = coloured(segs);
      expect(still).toHaveLength(2);
      for (const s of still) expect(s.category).toBe('madd');
    });

    it('does not drop or alter text while dimming', () => {
      const segs = segmentVerse(BISMILLAH, TAGS_1_1, 'madd');
      expect(segs.map((s) => s.text).join('')).toBe(BISMILLAH);
    });
  });

  describe('malformed offsets are clamped, not thrown', () => {
    it('ignores a tag past the end of the ayah', () => {
      const segs = segmentVerse('abc', [
        { rule: 'x', start: 10, end: 12, color: '#fff', category: 'x' },
      ]);
      expect(segs.map((s) => s.text).join('')).toBe('abc');
      expect(coloured(segs)).toHaveLength(0);
    });

    it('clamps a tag that runs off the end', () => {
      const segs = segmentVerse('abc', [
        { rule: 'x', start: 2, end: 99, color: '#fff', category: 'x' },
      ]);
      expect(segs.map((s) => s.text).join('')).toBe('abc');
      expect(coloured(segs).map((s) => s.text)).toEqual(['c']);
    });

    it('ignores a zero-width or inverted tag', () => {
      const segs = segmentVerse('abc', [
        { rule: 'x', start: 1, end: 1, color: '#fff', category: 'x' },
        { rule: 'y', start: 2, end: 1, color: '#fff', category: 'y' },
      ]);
      expect(coloured(segs)).toHaveLength(0);
    });
  });
});
