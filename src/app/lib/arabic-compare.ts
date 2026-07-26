/**
 * Comparing typed Arabic, for grading recalled scripture.
 *
 * ── Two strictnesses, on purpose ────────────────────────────────────────────
 *
 * `normalizeArabic` mirrors the server's function in workers/src/routes/learning.ts
 * exactly, and a test asserts they agree. It is deliberately conservative, because a
 * fill-in-the-blank depends on الكتاب not matching كتاب.
 *
 * `gradeRecall` is deliberately more forgiving, because recall of memorised scripture
 * is a different question. Being told you misremembered the Quran when you typed it
 * correctly is a far worse failure than being marginally lenient about a long vowel.
 *
 * The reason recall needs that leniency is Uthmani orthography. Modern spelling writes
 * the superscript "dagger" alef out in some words and not others:
 *
 *     ٱلْعَٰلَمِينَ  is typed  العالمين   (alef written)
 *     ٱلرَّحْمَٰنِ   is typed  الرحمن     (alef NOT written)
 *     ٱلصَّلَوٰةَ    is typed  الصلاة     (the waw becomes an alef)
 *
 * So no single mapping of ٰ is right for every word — which is why the server keeps
 * deleting it rather than guessing. Recall instead makes the long alef irrelevant on
 * both sides. The cost is real and worth stating: قال and قل compare equal. Scored
 * word by word across a whole ayah that barely moves the verdict, and it buys never
 * rejecting a correct recitation.
 */

/** The conservative comparison. Must stay identical to the server's. */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[ً-ْٰۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    // The other two hamza carriers. Folding أ إ آ but not ؤ ئ was arbitrary: nobody
    // types the hamza on a plain keyboard, so يُؤْمِنُونَ never matched يومنون.
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The forgiving comparison, for recall only.
 *
 * Order matters: the waw+dagger pair is a long ā written with a waw in Uthmani
 * (صَلَوٰة, زَكَوٰة, حَيَوٰة — 184 words in the text), so it collapses to an alef
 * before the remaining dagger alefs do, or صلوة would become صلواة.
 */
export function skeleton(input: string): string {
  return normalizeArabic(input.normalize('NFC').replace(/وٰ/g, 'ا').replace(/ٰ/g, 'ا'))
    .replace(/ا/g, '') // the long alef is optional; see the note above
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RecallResult {
  correct: boolean;
  accuracy: number;
  expectedWords: number;
  matchedWords: number;
  /** Indices into the expected word list that were missed or mistyped. */
  missed: number[];
}

/**
 * Grade a recalled ayah, word by word.
 *
 * Word-level rather than all-or-nothing: one mistyped word out of twelve is not the
 * same as remembering nothing, and a binary verdict on a long ayah tells the learner
 * nothing about where the gap is.
 *
 * Compared in sequence, not as a bag of words — reciting the right words in the wrong
 * order is not recall.
 */
export function gradeRecall(expected: string, given: string, threshold = 0.9): RecallResult {
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
    // Extra trailing words count against you: something was inserted.
    correct: accuracy >= threshold && got.length <= exp.length,
    accuracy,
    expectedWords: exp.length,
    matchedWords: matched,
    missed,
  };
}
