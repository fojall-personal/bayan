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
import {
  isAnswerCorrect,
  expectedAnswerText,
  givenAnswerText,
} from '../src/routes/learning';
import {
  schedule,
  gradeFromAccuracy,
  isGrade,
  REQUEST_RETENTION,
} from '../src/lib/space-repetition';
import type { FsrsState, Grade } from '../src/lib/space-repetition';

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

describe('FSRS scheduler', () => {
  // A fixed "now" so intervals are arithmetic rather than dependent on the clock.
  const NOW = new Date('2026-07-27T12:00:00.000Z');

  const state = (over: Partial<FsrsState> = {}): FsrsState => ({
    stability: null,
    difficulty: null,
    last_review: null,
    fsrs_state: null,
    interval: 0,
    reviews: 0,
    ...over,
  });

  it('schedules further out for a better grade', () => {
    const again = schedule(state(), 'again', NOW).interval;
    const hard = schedule(state(), 'hard', NOW).interval;
    const good = schedule(state(), 'good', NOW).interval;
    const easy = schedule(state(), 'easy', NOW).interval;
    // Monotonic in the grade. The exact numbers belong to the fitted parameters and
    // would change with an FSRS version bump; the ordering is the contract.
    expect(again).toBeLessThanOrEqual(hard);
    expect(hard).toBeLessThanOrEqual(good);
    expect(good).toBeLessThan(easy);
  });

  it('grows the interval over a run of good reviews', () => {
    let st = state();
    let at = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = schedule(st, 'good', at);
      intervals.push(r.interval);
      st = {
        stability: r.stability,
        difficulty: r.difficulty,
        last_review: r.lastReview,
        fsrs_state: r.fsrsState,
        reviews: i + 1,
      };
      // At least a day forward, even when the interval is 0.
      //
      // FSRS puts a new card through learning steps measured in MINUTES, but this app
      // stores next_review as a date and reviews hifz at day granularity — so a
      // sub-day step flattens to "due today". Advancing by the date alone would
      // re-review the same day forever and the interval would never leave 0. Day
      // granularity is the right call for memorisation; this is just where it shows.
      const step = Math.max(1, r.interval);
      at = new Date(at.getTime() + step * 86_400_000);
    }
    // Growing across the run, which is the property SM-2 got wrong: its quality-3
    // path rounded 1 * 1.2 back to 1 and stalled at a one-day interval forever.
    expect(intervals[4]).toBeGreaterThan(intervals[1]);
    expect(intervals[4]).toBeGreaterThan(10);
  });

  it('collapses the interval on a lapse but keeps the item', () => {
    const settled = schedule(
      state({ stability: 200, difficulty: 5, last_review: '2026-01-01T00:00:00.000Z', fsrs_state: 2, reviews: 12 }),
      'again',
      NOW
    );
    expect(settled.interval).toBeLessThan(7);
    expect(settled.status).toBe('learning');
    // Stability drops but does not vanish: the item is not new again.
    expect(settled.stability).toBeGreaterThan(0);
  });

  it('seeds from an SM-2 interval so an established ayah keeps its place', () => {
    // A row migrated off SM-2 has no stability but a real interval. Treating it as new
    // would drop an ayah held for months back to day one.
    const migrated = schedule(state({ interval: 60, reviews: 9 }), 'good', NOW);
    const fresh = schedule(state(), 'good', NOW);
    expect(migrated.interval).toBeGreaterThan(fresh.interval);
    expect(migrated.interval).toBeGreaterThan(30);
  });

  it('derives status from the interval, not from FSRS internal state', () => {
    expect(schedule(state({ stability: 400, difficulty: 3, fsrs_state: 2, last_review: '2026-01-01T00:00:00.000Z' }), 'easy', NOW).status).toBe('mastered');
    expect(schedule(state(), 'again', NOW).status).toBe('learning');
    for (const g of ['again', 'hard', 'good', 'easy'] as Grade[]) {
      expect(['new', 'learning', 'reviewing', 'mastered']).toContain(
        schedule(state({ interval: 5 }), g, NOW).status
      );
    }
  });

  it("emits a date that sorts against SQLite datetime('now')", () => {
    // next_review is compared with `<= datetime('now')`, which is
    // 'YYYY-MM-DD HH:MM:SS'. A date-only value must still order correctly as a string.
    const r = schedule(state(), 'good', NOW);
    expect(r.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(r.nextReview))).toBe(false);
    expect(r.nextReview < '2999-01-01 00:00:00').toBe(true);
  });

  it('records the review time so the next call can measure elapsed days', () => {
    const r = schedule(state(), 'good', NOW);
    expect(r.lastReview).toBe(NOW.toISOString());
  });

  it('states its retention target rather than leaving it implicit', () => {
    // Documented because a lapse roughly one review in ten is the schedule working.
    expect(REQUEST_RETENTION).toBe(0.9);
  });

  it('maps recall accuracy onto grades, asymmetrically', () => {
    expect(gradeFromAccuracy(0)).toBe('again');
    expect(gradeFromAccuracy(0.49)).toBe('again');
    expect(gradeFromAccuracy(0.5)).toBe('hard');
    expect(gradeFromAccuracy(0.79)).toBe('hard');
    expect(gradeFromAccuracy(0.8)).toBe('good');
    expect(gradeFromAccuracy(0.97)).toBe('good');
    // Only a near-perfect pass counts as effortless: word-level recall of scripture
    // is close to all-or-nothing.
    expect(gradeFromAccuracy(1)).toBe('easy');
  });

  it('rejects anything that is not one of the four grades', () => {
    for (const g of ['again', 'hard', 'good', 'easy']) expect(isGrade(g)).toBe(true);
    // The old numeric scale must not sneak back in as a string.
    for (const bad of [5, '5', 'perfect', '', null, undefined, 'GOOD']) {
      expect(isGrade(bad)).toBe(false);
    }
  });
});

describe('match exercises', () => {
  const ex = {
    type: 'match',
    question: 'Match the conjugation',
    pairs: [
      { item: 'كَتَبُوا', answer: 'they (men) wrote' },
      { item: 'كَتَبْنَ', answer: 'they (women) wrote' },
      { item: 'كَتَبْنَا', answer: 'we wrote' },
    ],
  };

  it('grades a fully correct set', () => {
    expect(
      isAnswerCorrect(ex, JSON.stringify(ex.pairs.map((p) => p.answer)))
    ).toBe(true);
  });

  it('rejects a swapped pair', () => {
    expect(
      isAnswerCorrect(
        ex,
        JSON.stringify(['they (women) wrote', 'they (men) wrote', 'we wrote'])
      )
    ).toBe(false);
  });

  it('rejects a partial answer rather than crediting what is there', () => {
    expect(isAnswerCorrect(ex, JSON.stringify(['we wrote', '', '']))).toBe(false);
    expect(isAnswerCorrect(ex, JSON.stringify(['they (men) wrote']))).toBe(false);
  });

  it('does not throw on junk', () => {
    for (const junk of ['not json', '{}', '[]', null, undefined, 42]) {
      expect(isAnswerCorrect(ex, junk)).toBe(false);
    }
  });

  it('is graded despite having no `correct` field', () => {
    // The key is `pairs`. The guard for a missing `correct` used to reject match
    // outright, which is why it could never be scored.
    expect('correct' in ex).toBe(false);
    expect(isAnswerCorrect(ex, JSON.stringify(ex.pairs.map((p) => p.answer)))).toBe(true);
  });
});

describe('lesson review text', () => {
  const mc = {
    type: 'multiple_choice',
    question: 'Which form means "they (men) wrote"?',
    options: ['كَتَبْنَ', 'كَتَبْنَا', 'كَتَبُوا', 'كَتَبْتُ'],
    correct: 2,
  };

  it('names the option the learner chose, not its index', () => {
    // "You answered 3" was a database value leaking into the UI.
    expect(givenAnswerText(mc, 3)).toBe('كَتَبْتُ');
    expect(givenAnswerText(mc, '3')).toBe('كَتَبْتُ');
    expect(expectedAnswerText(mc)).toBe('كَتَبُوا');
  });

  it('reports an unanswered exercise as nothing rather than as a wrong answer', () => {
    for (const empty of [undefined, null, '']) {
      expect(givenAnswerText(mc, empty)).toBeNull();
    }
  });

  it('renders a match as pairs on both sides', () => {
    const m = {
      type: 'match',
      pairs: [
        { item: 'كَتَبُوا', answer: 'they (men) wrote' },
        { item: 'كَتَبْنَا', answer: 'we wrote' },
      ],
    };
    expect(givenAnswerText(m, JSON.stringify(['we wrote', 'they (men) wrote']))).toBe(
      'we wrote, they (men) wrote'
    );
    expect(expectedAnswerText(m)).toBe(
      'كَتَبُوا → they (men) wrote, كَتَبْنَا → we wrote'
    );
    // A partly filled match reads as unanswered rather than as a half-answer.
    expect(givenAnswerText(m, JSON.stringify(['', '']))).toBeNull();
  });

  it('falls back to the raw value rather than throwing on junk', () => {
    expect(givenAnswerText({ type: 'match', pairs: [] }, 'not json')).toBe('not json');
    expect(expectedAnswerText({ type: 'fill_blank' })).toBeNull();
  });
});
