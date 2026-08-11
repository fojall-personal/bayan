import { describe, it, expect } from 'vitest';
import { nextInRun } from '../freeflow-run';

describe('nextInRun', () => {
  const run = { surah: 1, ayahFrom: 1, ayahTo: 3 };

  it('advances to the next ayah mid-run', () => {
    expect(nextInRun(run, 1)).toEqual({ surah: 1, ayah: 2, done: false });
  });

  it('reports done at the last ayah', () => {
    expect(nextInRun(run, 3)).toEqual({ surah: 1, ayah: 3, done: true });
  });

  it('is done immediately for a single-ayah run', () => {
    expect(nextInRun({ surah: 1, ayahFrom: 5, ayahTo: 5 }, 5)).toEqual({
      surah: 1, ayah: 5, done: true,
    });
  });
});
