/**
 * Assessment scoring and path assignment, and the SM-2 scheduler.
 *
 * The scheduler cases document real defects: the interval could not advance at
 * quality 3, and next_review was written in two different formats depending on
 * which endpoint wrote it.
 */

import { describe, expect, it } from 'vitest';
import {
  assignLearningPath,
  calculateCompositeScore,
  generateAssessmentResult,
} from '../src/lib/scoring';
import { applySM2 } from '../src/lib/space-repetition';
import type { MemorizationStatus } from '../src/lib/space-repetition';

const scores = (l: number, c: number, g: number, m: number) => ({
  literacy: l,
  comprehension: c,
  grammar: g,
  memorization: m,
});

describe('composite score', () => {
  it('applies the documented weights (0.20 / 0.30 / 0.25 / 0.25)', () => {
    expect(calculateCompositeScore(scores(100, 100, 100, 100))).toBe(100);
    expect(calculateCompositeScore(scores(0, 0, 0, 0))).toBe(0);
    // 80*.2 + 60*.3 + 40*.25 + 20*.25 = 16 + 18 + 10 + 5
    expect(calculateCompositeScore(scores(80, 60, 40, 20))).toBeCloseTo(49, 5);
  });

  it('weights comprehension above literacy, per the plan', () => {
    const litHeavy = calculateCompositeScore(scores(100, 0, 0, 0));
    const compHeavy = calculateCompositeScore(scores(0, 100, 0, 0));
    expect(compHeavy).toBeGreaterThan(litHeavy);
  });
});

describe('path assignment', () => {
  it('sends a non-reader to path1', () => {
    expect(assignLearningPath(scores(10, 20, 20, 20))).toBe('path1');
  });

  it('sends a strong balanced learner to path3', () => {
    expect(assignLearningPath(scores(90, 85, 80, 75))).toBe('path3');
  });

  it('returns one of the three known paths for any input', () => {
    for (const s of [
      scores(0, 0, 0, 0),
      scores(100, 100, 100, 100),
      scores(50, 50, 50, 50),
      scores(100, 0, 100, 0),
      scores(0, 100, 0, 100),
      scores(39, 90, 90, 90),
      scores(69, 40, 40, 40),
    ]) {
      expect(['path1', 'path2', 'path3']).toContain(assignLearningPath(s));
    }
  });
});

describe('assessment result', () => {
  it('reports the weakest and strongest areas', () => {
    const r = generateAssessmentResult(scores(90, 20, 60, 70), 'u1');
    expect(r.details.weakest_area).toBe('comprehension');
    expect(r.details.strongest_area).toBe('literacy');
  });

  it('assigns a level consistent with the composite', () => {
    expect(generateAssessmentResult(scores(95, 95, 95, 95), 'u1').level).toBe('advanced');
    expect(generateAssessmentResult(scores(5, 5, 5, 5), 'u1').level).toBe('beginner');
  });

  it('carries the assigned path, which the results screen now reads', () => {
    // The screen used to re-derive a path from `level` with different logic, so
    // it could display a path contradicting the one actually assigned.
    const r = generateAssessmentResult(scores(90, 85, 80, 75), 'u1');
    expect(r.path).toBe(assignLearningPath(scores(90, 85, 80, 75)));
    expect(r.details.paths[r.path]).toBeDefined();
  });
});

describe('SM-2 scheduler', () => {
  const entry = (over: Partial<Parameters<typeof applySM2>[0]> = {}) => ({
    id: 'e1',
    quality: 0,
    interval: 0,
    ease_factor: 2.5,
    reviews_count: 0,
    status: 'new' as MemorizationStatus,
    next_review: '2026-07-25',
    ...over,
  });

  it('advances the interval on a good review', () => {
    const r = applySM2(entry(), 5);
    expect(r.interval).toBeGreaterThan(1);
  });

  it('resets to one day on a poor review and lowers ease', () => {
    const r = applySM2(entry({ interval: 20, ease_factor: 2.5 }), 1);
    expect(r.interval).toBe(1);
    expect(r.easeFactor).toBeLessThan(2.5);
  });

  it('never lets ease fall below the 1.3 floor', () => {
    let e = entry({ interval: 10, ease_factor: 1.3 });
    for (let i = 0; i < 10; i++) {
      const r = applySM2(e, 1);
      e = entry({ interval: r.interval, ease_factor: r.easeFactor });
    }
    expect(e.ease_factor).toBeGreaterThanOrEqual(1.3);
  });

  it('makes progress at quality 3 rather than stalling', () => {
    // Regression: interval 1 * 1.2 rounds back to 1, so a learner answering
    // "OK" every time could never advance past a one-day interval.
    let interval = 1;
    for (let i = 0; i < 6; i++) {
      interval = applySM2(entry({ interval, reviews_count: i }), 3).interval;
    }
    expect(interval).toBeGreaterThan(1);
  });

  it('reaches mastered only on a long interval with a good grade', () => {
    expect(applySM2(entry({ interval: 40, reviews_count: 8 }), 5).status).toBe('mastered');
    expect(applySM2(entry({ interval: 40, reviews_count: 8 }), 2).status).not.toBe('mastered');
  });

  it('emits a date that sorts correctly against SQLite datetime(\'now\')', () => {
    // next_review is compared with `<= datetime('now')`, which is
    // 'YYYY-MM-DD HH:MM:SS'. A date-only value must still order correctly as a
    // string, and must be parseable.
    const r = applySM2(entry(), 4);
    expect(r.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(r.nextReview))).toBe(false);
    expect(r.nextReview < '2999-01-01 00:00:00').toBe(true);
  });

  it('always returns a known status', () => {
    for (let q = 0; q <= 5; q++) {
      expect(['new', 'learning', 'reviewing', 'mastered']).toContain(
        applySM2(entry({ interval: 5 }), q).status
      );
    }
  });
});
