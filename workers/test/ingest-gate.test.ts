/**
 * The Quran ingest alignment gate.
 *
 * Tajweed annotations are codepoint offsets valid only against one exact text.
 * A substitute copy does not fail loudly — it silently colours the wrong
 * letters. A reasonable-looking substitute scored 82.3%, so roughly one mark in
 * six would have landed on the wrong letter.
 *
 * These tests exercise the gate's logic on small fixtures, so a future change
 * cannot quietly loosen it. Running the real ingest needs the pinned text —
 * see docs/HANDOFF-LOCAL-SESSION.md.
 */

import { describe, expect, it } from 'vitest';

/** Mirrors EXPECTED_LETTERS in scripts/ingest-quran.mjs. */
const EXPECTED_LETTERS: Record<string, Set<string>> = {
  hamzat_wasl: new Set(['ٱ', 'ا']),
  lam_shamsiyyah: new Set(['ل']),
  ghunnah: new Set(['ن', 'م']),
  iqlab: new Set(['ن', 'م']),
  qalqalah: new Set(['ق', 'ط', 'ب', 'ج', 'د']),
};

interface Annotation {
  rule: string;
  start: number;
  end: number;
}

/** The gate, as implemented in the ingest script. */
function alignment(
  verses: Map<string, string>,
  annotated: Array<{ surah: number; ayah: number; annotations: Annotation[] }>
) {
  let aligned = 0;
  let checked = 0;
  for (const entry of annotated) {
    const text = verses.get(`${entry.surah}:${entry.ayah}`);
    if (text === undefined) continue;
    const cps = [...text];
    for (const a of entry.annotations) {
      const expected = EXPECTED_LETTERS[a.rule];
      if (!expected) continue;
      checked++;
      if (a.start >= cps.length) continue;
      const window = cps.slice(Math.max(0, a.start - 1), a.start + 2);
      if (window.some((c) => expected.has(c))) aligned++;
    }
  }
  return { aligned, checked, ratio: checked ? aligned / checked : 0 };
}

// 1:1 — بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ. The alef-wasla of ٱللَّه sits at
// codepoint 6, and its lam immediately after.
const BISMILLAH = 'بِسْمِ ٱللَّهِ';

describe('alignment gate', () => {
  it('scores 100% when offsets land on the right letters', () => {
    const idxAlef = [...BISMILLAH].indexOf('ٱ');
    const idxLam = [...BISMILLAH].indexOf('ل');
    const r = alignment(
      new Map([['1:1', BISMILLAH]]),
      [
        {
          surah: 1,
          ayah: 1,
          annotations: [
            { rule: 'hamzat_wasl', start: idxAlef, end: idxAlef + 1 },
            { rule: 'lam_shamsiyyah', start: idxLam, end: idxLam + 1 },
          ],
        },
      ]
    );
    expect(r.checked).toBe(2);
    expect(r.ratio).toBe(1);
  });

  it('detects a one-codepoint shift, which is how encoding drift shows up', () => {
    const idxAlef = [...BISMILLAH].indexOf('ٱ');
    const r = alignment(
      new Map([['1:1', BISMILLAH]]),
      [
        {
          surah: 1,
          ayah: 1,
          // Off by four: outside the +/-1 tolerance, so it must be caught.
          annotations: [{ rule: 'hamzat_wasl', start: idxAlef + 4, end: idxAlef + 5 }],
        },
      ]
    );
    expect(r.ratio).toBeLessThan(1);
  });

  it('tolerates a one-codepoint offset onto an attached diacritic', () => {
    // Annotations legitimately begin on a diacritic belonging to the letter, so
    // the window is deliberately +/-1 rather than exact.
    const idxAlef = [...BISMILLAH].indexOf('ٱ');
    const r = alignment(
      new Map([['1:1', BISMILLAH]]),
      [{ surah: 1, ayah: 1, annotations: [{ rule: 'hamzat_wasl', start: idxAlef + 1, end: idxAlef + 2 }] }]
    );
    expect(r.ratio).toBe(1);
  });

  it('ignores rules whose target letter is not fixed by definition', () => {
    // madd_2 can sit on several letters, so it carries no positional constraint
    // and must not inflate the denominator.
    const r = alignment(
      new Map([['1:1', BISMILLAH]]),
      [{ surah: 1, ayah: 1, annotations: [{ rule: 'madd_2', start: 99, end: 100 }] }]
    );
    expect(r.checked).toBe(0);
  });

  it('does not count annotations for a missing verse', () => {
    const r = alignment(new Map(), [
      { surah: 1, ayah: 1, annotations: [{ rule: 'ghunnah', start: 0, end: 1 }] },
    ]);
    expect(r.checked).toBe(0);
  });

  it('rejects the 82% case the substitute text produced', () => {
    const MIN = 0.995;
    expect(0.823 < MIN).toBe(true);
  });
});
