/**
 * Lesson grading.
 *
 * Every case here corresponds to a bug that was actually shipped, or to a
 * behaviour that was verified by hand once and would otherwise have no guard.
 */

import { describe, expect, it } from 'vitest';
import { isAnswerCorrect, normalizeArabic } from '../src/routes/learning';
import type { Exercise } from '../src/routes/learning';
import { gradeFromAccuracy } from '../src/lib/space-repetition';

const mc: Exercise = {
  type: 'multiple_choice',
  question: 'Which of these is a moon letter?',
  options: ['ت', 'س', 'ب', 'ر'],
  correct: 2, // ب — content stores the INDEX
};

const blank: Exercise = {
  type: 'fill_blank',
  question: 'Complete: ال + كِتَاب = ___',
  correct: 'الْكِتَابُ',
};

describe('multiple choice', () => {
  it('accepts the correct option index', () => {
    expect(isAnswerCorrect(mc, 2)).toBe(true);
  });

  it('rejects a wrong index', () => {
    expect(isAnswerCorrect(mc, 0)).toBe(false);
  });

  it('accepts a numeric string index, since JSON bodies blur the two', () => {
    expect(isAnswerCorrect(mc, '2')).toBe(true);
  });

  it('accepts the option text as well as its index', () => {
    expect(isAnswerCorrect(mc, 'ب')).toBe(true);
    expect(isAnswerCorrect(mc, 'ت')).toBe(false);
  });

  it('rejects the old broken client payload instead of throwing', () => {
    // The client used to send [{index, answer}] objects while the server
    // compared them to scalars. Every comparison was false, so every lesson
    // scored 0% and none could reach the 70% completion threshold.
    expect(isAnswerCorrect(mc, { index: 0, answer: '2' } as unknown)).toBe(false);
  });

  it('rejects an out-of-range index', () => {
    expect(isAnswerCorrect(mc, 99)).toBe(false);
  });
});

describe('fill in the blank', () => {
  it('accepts the exact vowelled answer', () => {
    expect(isAnswerCorrect(blank, 'الْكِتَابُ')).toBe(true);
  });

  it('accepts an unvowelled answer', () => {
    // Requiring byte-exact harakat would fail almost anyone typing on a plain
    // keyboard.
    expect(isAnswerCorrect(blank, 'الكتاب')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isAnswerCorrect(blank, '  الكتاب  ')).toBe(true);
  });

  it('rejects a different word', () => {
    expect(isAnswerCorrect(blank, 'القمر')).toBe(false);
  });

  it('rejects a non-string answer', () => {
    expect(isAnswerCorrect(blank, 3)).toBe(false);
  });
});

describe('exercises with no gradeable answer', () => {
  it('never marks a match exercise correct', () => {
    // This used to be hardcoded `isCorrect = true`, inflating every score that
    // contained one. The route now excludes them from the denominator.
    const match: Exercise = { type: 'match', pairs: [{ item: 'a', answer: 'b' }] };
    expect(isAnswerCorrect(match, 'anything')).toBe(false);
  });

  it('returns false when the exercise has no correct answer defined', () => {
    expect(isAnswerCorrect({ type: 'multiple_choice', options: ['a'] }, 0)).toBe(false);
  });
});

describe('normalizeArabic', () => {
  it('strips harakat', () => {
    expect(normalizeArabic('الْكِتَابُ')).toBe(normalizeArabic('الكتاب'));
  });

  it('folds the alef variants', () => {
    // أ إ آ all fold to ا so a learner is not failed on hamza placement.
    expect(normalizeArabic('أحد')).toBe(normalizeArabic('احد'));
    expect(normalizeArabic('إن')).toBe(normalizeArabic('ان'));
    expect(normalizeArabic('آمن')).toBe(normalizeArabic('امن'));
  });

  it('folds alef maqsura to ya and ta marbuta to ha', () => {
    expect(normalizeArabic('على')).toBe(normalizeArabic('علي'));
    expect(normalizeArabic('رحمة')).toBe(normalizeArabic('رحمه'));
  });

  it('collapses whitespace', () => {
    expect(normalizeArabic('بسم   الله')).toBe('بسم الله');
  });

  it('does not collapse genuinely different words', () => {
    expect(normalizeArabic('كتاب')).not.toBe(normalizeArabic('كتب'));
  });
});

describe('accuracy drives the FSRS grade', () => {
  it('maps measured accuracy onto the four grades', () => {
    expect(gradeFromAccuracy(0.30)).toBe('again');
    expect(gradeFromAccuracy(0.65)).toBe('hard');
    expect(gradeFromAccuracy(0.90)).toBe('good');
    expect(gradeFromAccuracy(1.00)).toBe('easy');
  });
});
