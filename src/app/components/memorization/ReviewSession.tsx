'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AyahAudioButton } from '@/components/audio/AyahAudioButton';
import { apiPost, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';
import { gradeRecall, type RecallResult } from '@/lib/arabic-compare';

interface MemorizationEntry {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: string;
  ayah_text?: string;
}

type Grade = 'again' | 'hard' | 'good' | 'easy';

/**
 * The four self-report grades, in the order they are offered.
 *
 * This asked a five-point question until FSRS replaced SM-2. FSRS grades on exactly
 * four values, so a fifth option would have to schedule identically to one of the
 * others — and a scale where two answers do the same thing is a lie to the learner.
 * The wording describes the recall, not the schedule.
 *
 * Kept only as the "I recited it aloud" fallback now — see the module comment below.
 */
const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'again', label: "I didn't remember it" },
  { grade: 'hard', label: 'I remembered it with difficulty' },
  { grade: 'good', label: 'I remembered it correctly' },
  { grade: 'easy', label: 'I remembered it effortlessly' },
];

const GRADE_DESCRIPTION: Record<Grade, string> = {
  again: "You didn't remember it",
  hard: 'Remembered with difficulty',
  good: 'Remembered correctly',
  easy: 'Remembered effortlessly',
};

interface MemorizationReviewResponse {
  grade: Grade;
  gradedFrom: 'accuracy' | 'self';
  nextReview: string;
  status: string;
  interval: number;
}

interface ReviewSessionProps {
  entry: MemorizationEntry;
  onComplete: (grade: Grade) => void;
  onSkip: () => void;
}

/**
 * Typed recall is the default path, not the four self-grade buttons.
 *
 * Karpicke & Roediger (2008): learners' predictions of their own retention were
 * uncorrelated with actual retention — every condition felt identical during
 * learning while differing 80% vs 33% a week later. Self-rating asks the question
 * research says people cannot reliably answer. Typing what you remember and
 * measuring it (gradeRecall, word by word) asks a question that has an answer.
 *
 * Self-grading remains as an explicit "I recited it aloud instead" fallback —
 * reciting aloud without typing is legitimate practice, and forcing typing on a
 * phone would get the feature abandoned. Measure when you can; fall back honestly
 * when you cannot.
 */
export function ReviewSession({ entry, onComplete, onSkip }: ReviewSessionProps) {
  const [step, setStep] = useState<'listen' | 'recall' | 'result' | 'rate'>('listen');
  const [typed, setTyped] = useState('');
  const [recallResult, setRecallResult] = useState<RecallResult | null>(null);
  const [reviewResult, setReviewResult] = useState<MemorizationReviewResponse | null>(null);
  const [picked, setPicked] = useState<Grade | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const surahLabel = getSurah(entry.surah_id)?.name ?? `Surah ${entry.surah_id}`;
  const ayahLabel =
    entry.ayah_to > entry.ayah_from
      ? `ayahs ${entry.ayah_from}–${entry.ayah_to}`
      : `ayah ${entry.ayah_from}`;

  /**
   * Grade from measured accuracy, not a self-report.
   *
   * Refuses to grade wrongly rather than mark wrongly: with no stored text to
   * compare against, gradeRecall has nothing to measure, so this falls back to
   * the self-report step instead of silently scoring a guess as a lapse.
   */
  const handleSubmitRecall = async () => {
    if (saving || !typed.trim()) return;
    const expected = entry.ayah_text;
    if (!expected) {
      setError('No stored text for this ayah, so recall cannot be measured. Rate yourself instead.');
      setStep('rate');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = gradeRecall(expected, typed);
      setRecallResult(result);
      const res = await apiPost<{ data: MemorizationReviewResponse }>(
        `/api/memorization/${entry.id}/review`,
        { accuracy: result.accuracy }
      );
      setReviewResult(res.data);
      setStep('result');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Record a self-report, then advance.
   *
   * This used to be fire-and-forget: `.then(onComplete).catch(console.error)`. On
   * success it worked. On failure it logged to a console the learner cannot see and
   * `onComplete` never ran — so the button did nothing at all, with no error and no
   * pending state, and a failed review was indistinguishable from a slow one. It
   * also accepted repeat clicks in flight, scheduling the same ayah several times
   * with different qualities.
   */
  const handleRate = async (grade: Grade) => {
    if (saving) return;
    setPicked(grade);
    setSaving(true);
    setError(null);
    try {
      await apiPost(`/api/memorization/${entry.id}/review`, { grade });
      onComplete(grade);
    } catch (err) {
      setError(apiErrorMessage(err));
      // Cleared so the learner can pick again rather than being left looking at a
      // selection that was never recorded.
      setPicked(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Reference only — never the text itself before recall is measured.
          Revealing the text first makes this a reading exercise, not a recall one. */}
      <Card className="text-center py-6">
        <div className="text-xl font-semibold text-leaf-400">{surahLabel}</div>
        <p className="text-gray-400 mt-1">
          {ayahLabel.charAt(0).toUpperCase() + ayahLabel.slice(1)}
        </p>
      </Card>

      {/* Step 1: Listen */}
      {step === 'listen' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 1: Listen</h3>
          <p className="text-gray-400 mb-6">Listen to the recitation and read along</p>

          <AyahAudioButton
            surah={entry.surah_id}
            ayah={entry.ayah_from}
            className="w-full py-4 text-lg inline-flex items-center justify-center rounded-md font-medium bg-leaf-500/20 text-leaf-400 hover:bg-leaf-500/30 disabled:opacity-40 transition-colors"
          />
          {entry.ayah_to > entry.ayah_from && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Plays ayah {entry.ayah_from} of {entry.ayah_from}–{entry.ayah_to}.
            </p>
          )}

          <Button
            variant="secondary"
            onClick={() => setStep('recall')}
            className="w-full mt-4"
          >
            I&apos;ve listened — continue to recall
          </Button>
        </Card>
      )}

      {/* Step 2: Typed recall — the default path */}
      {step === 'recall' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 2: Recall</h3>
          <p className="text-gray-400 mb-4">
            Type the {entry.ayah_to > entry.ayah_from ? 'ayahs' : 'ayah'} from memory.
            Diacritics and alef variants are ignored, so you won&apos;t be marked wrong
            for a missing harakah.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-error/40 bg-error/10 p-3 text-sm"
            >
              {error}
            </div>
          )}

          <textarea
            dir="rtl"
            lang="ar"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="اكتب ما تتذكره..."
            rows={4}
            className="text-naskh w-full rounded-md border border-ground-700 bg-ground-800 px-4 py-2.5 text-xl text-ground-50 placeholder-ground-500 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
          />

          <Button
            onClick={handleSubmitRecall}
            disabled={saving || !typed.trim()}
            className="w-full mt-4 py-4 text-lg"
          >
            {saving ? 'Checking…' : 'Check my recall'}
          </Button>

          <button
            type="button"
            onClick={() => setStep('rate')}
            className="mt-4 block w-full text-center text-sm text-ground-400 transition-colors hover:text-gold-400"
          >
            I recited it aloud instead
          </button>

          <Button variant="ghost" onClick={onSkip} className="w-full mt-2">
            Skip for now
          </Button>
        </Card>
      )}

      {/* Step 3: Result — the diff typed self-rating could never show */}
      {step === 'result' && recallResult && reviewResult && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Result</h3>

          <div
            className={`rounded-lg border p-4 mb-4 ${
              recallResult.correct
                ? 'border-leaf-500/50 bg-leaf-500/10'
                : 'border-gold-500/50 bg-gold-500/10'
            }`}
            role="status"
          >
            <p
              className={`text-sm font-semibold ${
                recallResult.correct ? 'text-leaf-400' : 'text-gold-400'
              }`}
            >
              {recallResult.matchedWords} of {recallResult.expectedWords} words —{' '}
              {GRADE_DESCRIPTION[reviewResult.grade]}
            </p>
            {entry.ayah_text && (
              <p className="text-naskh mt-3 text-xl leading-arabic" dir="rtl" lang="ar">
                {entry.ayah_text.split(' ').map((w, i) => (
                  <span
                    key={i}
                    className={
                      recallResult.missed.includes(i)
                        ? 'text-gold-400 underline decoration-dotted'
                        : 'text-ground-50'
                    }
                  >
                    {w}{' '}
                  </span>
                ))}
              </p>
            )}
            <p className="mt-3 text-xs text-ground-400">
              Next review: {reviewResult.nextReview} ({reviewResult.interval === 0
                ? 'today'
                : `${reviewResult.interval} day${reviewResult.interval === 1 ? '' : 's'}`})
            </p>
          </div>

          <Button onClick={() => onComplete(reviewResult.grade)} className="w-full">
            Continue
          </Button>
        </Card>
      )}

      {/* Step 4: Self-report fallback — "I recited it aloud" */}
      {step === 'rate' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Rate Your Recall</h3>
          <p className="text-gray-400 mb-6">How well did you remember?</p>

          {entry.ayah_text && (
            <p className="text-naskh mb-6 text-xl leading-arabic" dir="rtl" lang="ar">
              {entry.ayah_text}
            </p>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-error/40 bg-error/10 p-3 text-sm"
            >
              {error} — your rating was not saved. Pick again to retry.
            </div>
          )}

          <div className="space-y-2">
            {GRADES.map(({ grade, label }) => (
              <button
                key={grade}
                onClick={() => handleRate(grade)}
                disabled={saving}
                className={`min-h-11 w-full rounded-lg p-3 text-left transition-colors disabled:opacity-50 ${
                  picked === grade
                    ? 'bg-leaf-500/20 border border-leaf-500'
                    : 'bg-ground-800 hover:bg-ground-700'
                }`}
              >
                {label}
                {saving && picked === grade ? ' — saving…' : ''}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
