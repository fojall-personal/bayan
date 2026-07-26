/**
 * Validation for POST /api/memorization/add.
 *
 * The endpoint shipped with none. It went unnoticed because no UI called it —
 * the whole feature was unreachable — so every one of these inputs would have
 * been written straight into the table.
 */

import { describe, expect, it } from 'vitest';
import { parseAyahRange, MAX_AYAH, SURAH_COUNT } from '../src/lib/memorization-input';

const ok = (body: unknown) => {
  const r = parseAyahRange(body);
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r.value;
};

const err = (body: unknown) => {
  const r = parseAyahRange(body);
  if (r.ok) throw new Error(`expected an error, got: ${JSON.stringify(r.value)}`);
  return r.error;
};

describe('parseAyahRange', () => {
  it('accepts a single ayah', () => {
    expect(ok({ surahId: 1, ayahFrom: 1, ayahTo: 1 })).toEqual({
      surahId: 1,
      ayahFrom: 1,
      ayahTo: 1,
    });
  });

  it('accepts a range', () => {
    expect(ok({ surahId: 2, ayahFrom: 255, ayahTo: 257 })).toEqual({
      surahId: 2,
      ayahFrom: 255,
      ayahTo: 257,
    });
  });

  it('accepts the boundary surahs', () => {
    expect(ok({ surahId: 1, ayahFrom: 1, ayahTo: 7 }).surahId).toBe(1);
    expect(ok({ surahId: SURAH_COUNT, ayahFrom: 1, ayahTo: 6 }).surahId).toBe(114);
  });

  describe('rejects', () => {
    it('a surah above 114', () => {
      expect(err({ surahId: 115, ayahFrom: 1, ayahTo: 1 })).toMatch(/between 1 and 114/);
    });

    it('surah zero and negatives', () => {
      expect(err({ surahId: 0, ayahFrom: 1, ayahTo: 1 })).toMatch(/between 1 and 114/);
      expect(err({ surahId: -3, ayahFrom: 1, ayahTo: 1 })).toMatch(/between 1 and 114/);
    });

    it('ayahFrom below 1', () => {
      expect(err({ surahId: 1, ayahFrom: 0, ayahTo: 3 })).toMatch(/1 or greater/);
    });

    it('an inverted range', () => {
      // The case most likely to come from a form: the user fills "to" first.
      expect(err({ surahId: 1, ayahFrom: 5, ayahTo: 2 })).toMatch(/greater than or equal/);
    });

    it('an ayah beyond the longest surah', () => {
      expect(err({ surahId: 1, ayahFrom: 1, ayahTo: MAX_AYAH + 1 })).toMatch(/cannot exceed/);
    });

    it('non-integers', () => {
      expect(err({ surahId: 1.5, ayahFrom: 1, ayahTo: 1 })).toMatch(/integer/);
      expect(err({ surahId: 1, ayahFrom: 1.2, ayahTo: 2 })).toMatch(/integer/);
    });

    it('numeric strings — a wrong contract, not a near miss', () => {
      expect(err({ surahId: '1', ayahFrom: 1, ayahTo: 1 })).toMatch(/integer/);
      expect(err({ surahId: 1, ayahFrom: '1', ayahTo: '2' })).toMatch(/integer/);
    });

    it('missing fields', () => {
      expect(err({})).toMatch(/surahId/);
      expect(err({ surahId: 1 })).toMatch(/ayahFrom/);
      expect(err({ surahId: 1, ayahFrom: 1 })).toMatch(/ayahTo/);
    });

    it('NaN and Infinity', () => {
      expect(err({ surahId: NaN, ayahFrom: 1, ayahTo: 1 })).toMatch(/integer/);
      expect(err({ surahId: 1, ayahFrom: 1, ayahTo: Infinity })).toMatch(/integer/);
    });

    it('non-objects', () => {
      expect(err(null)).toMatch(/JSON object/);
      expect(err('nope')).toMatch(/JSON object/);
      expect(err(42)).toMatch(/JSON object/);
    });
  });
});
