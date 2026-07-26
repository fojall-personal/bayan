/**
 * Recall grading, and the two comparison strictnesses.
 *
 * This decides whether someone is told they misremembered scripture, so the cases
 * that matter most are the ones where a wrong verdict is insulting: a correct
 * recitation typed on a plain keyboard against Uthmani text.
 *
 * The implementation lives in src/app/lib/arabic-compare.ts. It is duplicated here
 * because the workers test project cannot reach the Next app's module paths — so this
 * suite also asserts the conservative normaliser still agrees with the server's,
 * which is the thing that would otherwise rot silently.
 */

import { describe, expect, it } from 'vitest';
import { normalizeArabic as serverNormalize } from '../src/routes/learning';

/** Mirror of the client's conservative normaliser. */
function normalizeArabic(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[ً-ْٰۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mirror of the forgiving one used for recall. */
function skeleton(input: string): string {
  return normalizeArabic(
    input.normalize('NFC').replace(/وٰ/g, 'ا').replace(/ٰ/g, 'ا')
  )
    .replace(/ا/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function gradeRecall(expected: string, given: string, threshold = 0.9) {
  const exp = skeleton(expected).split(' ').filter(Boolean);
  const got = skeleton(given).split(' ').filter(Boolean);
  const missed: number[] = [];
  let matched = 0;
  for (let i = 0; i < exp.length; i += 1) {
    if (got[i] !== undefined && got[i] === exp[i]) matched += 1;
    else missed.push(i);
  }
  const accuracy = exp.length === 0 ? 0 : matched / exp.length;
  return {
    correct: accuracy >= threshold && got.length <= exp.length,
    accuracy, expectedWords: exp.length, matchedWords: matched, missed,
  };
}

const FATIHA_2 = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ';

describe('the conservative normaliser still matches the server', () => {
  it('agrees on the Uthmani letter variants', () => {
    for (const s of [FATIHA_2, 'قَالَ', 'أَحَد', 'إِنَّ', 'ٱلْكِتَٰبُ', 'مُوسَى', 'صَلَوٰةَ']) {
      expect(normalizeArabic(s)).toBe(serverNormalize(s));
    }
  });

  it('folds alef wasla, which it previously did not', () => {
    // The bug: 143 answers in the exercise bank carry ٱ, and none could ever match
    // a typed ا.
    expect(normalizeArabic('ٱلْحَمْدُ')).toBe(normalizeArabic('الحمد'));
    expect(serverNormalize('ٱلْحَمْدُ')).toBe(serverNormalize('الحمد'));
  });

  it('stays strict enough for the article exercise', () => {
    // grammar-01 asks the learner to add ال. If this folded them together the
    // exercise would accept its own wrong answer.
    expect(normalizeArabic('الكتاب')).not.toBe(normalizeArabic('كتاب'));
  });
});

describe('gradeRecall', () => {
  it('accepts a correct recitation typed without any harakat', () => {
    const r = gradeRecall(FATIHA_2, 'الحمد لله رب العالمين');
    expect(r.correct).toBe(true);
    expect(r.accuracy).toBe(1);
    expect(r.missed).toEqual([]);
  });

  it('accepts the three Uthmani spellings that trip a naive comparison', () => {
    // Each is written differently in the text than a learner types it, and each
    // broke a different rule while this was being built.
    expect(gradeRecall('ٱلْعَٰلَمِينَ', 'العالمين').correct).toBe(true); // alef written
    expect(gradeRecall('ٱلرَّحْمَٰنِ', 'الرحمن').correct).toBe(true);    // alef NOT written
    expect(gradeRecall('ٱلصَّلَوٰةَ', 'الصلاة').correct).toBe(true);      // waw becomes alef
    expect(gradeRecall('ٱلزَّكَوٰةَ', 'الزكاة').correct).toBe(true);
    expect(gradeRecall('ٱلْحَيَوٰةِ', 'الحياة').correct).toBe(true);
  });

  it('accepts a hamza carrier typed bare', () => {
    // 2:3, typed as anyone would on a plain keyboard.
    expect(gradeRecall('يُؤْمِنُونَ', 'يومنون').correct).toBe(true);
    expect(
      gradeRecall(
        'ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ',
        'الذين يومنون بالغيب ويقيمون الصلاة'
      ).correct
    ).toBe(true);
  });

  it('marks a missing word, and says which', () => {
    const r = gradeRecall(FATIHA_2, 'الحمد لله رب');
    expect(r.correct).toBe(false);
    expect(r.matchedWords).toBe(3);
    expect(r.expectedWords).toBe(4);
    expect(r.missed).toEqual([3]);
  });

  it('marks a substituted word rather than glossing over it', () => {
    expect(gradeRecall(FATIHA_2, 'الحمد لله رب الناس').missed).toEqual([3]);
  });

  it('does not accept the right words in the wrong order', () => {
    expect(gradeRecall(FATIHA_2, 'رب العالمين الحمد لله').correct).toBe(false);
  });

  it('rejects extra inserted words even when everything expected is present', () => {
    const r = gradeRecall(FATIHA_2, 'الحمد لله رب العالمين الرحمن');
    expect(r.accuracy).toBe(1);
    expect(r.correct).toBe(false);
  });

  it('scores an empty answer zero rather than throwing', () => {
    const r = gradeRecall(FATIHA_2, '');
    expect(r.correct).toBe(false);
    expect(r.accuracy).toBe(0);
    expect(r.missed).toHaveLength(4);
  });

  it('does not divide by zero on empty expected text', () => {
    expect(gradeRecall('', 'anything').accuracy).toBe(0);
  });

  it('is documented as lenient about the long alef, and is', () => {
    // Stated rather than hidden: this is the price of never rejecting a correct
    // recitation, and it is the right trade for recall.
    expect(gradeRecall('قَالَ', 'قل').correct).toBe(true);
  });
});
