'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AyahAudioButton } from '@/components/audio/AyahAudioButton';
import { apiPost, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';

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
 * The four grades, in the order they are offered.
 *
 * This asked a five-point question until FSRS replaced SM-2. FSRS grades on exactly
 * four values, so a fifth option would have to schedule identically to one of the
 * others — and a scale where two answers do the same thing is a lie to the learner.
 * The wording describes the recall, not the schedule.
 */
const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'again', label: "I didn't remember it" },
  { grade: 'hard', label: 'I remembered it with difficulty' },
  { grade: 'good', label: 'I remembered it correctly' },
  { grade: 'easy', label: 'I remembered it effortlessly' },
];

interface ReviewSessionProps {
  entry: MemorizationEntry;
  onComplete: (grade: Grade) => void;
  onSkip: () => void;
}

export function ReviewSession({ entry, onComplete, onSkip }: ReviewSessionProps) {
  const [step, setStep] = useState<'listen' | 'recite' | 'rate'>('listen');
  const [picked, setPicked] = useState<Grade | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecite = async () => {
    setStep('rate');
  };

  /**
   * Record the rating, then advance.
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
      {/* Ayah display */}
      <Card className="text-center py-8">
        <div className="text-3xl text-leaf-400 mb-4 arabic-text" dir="rtl">
          {entry.ayah_text || `Surah ${entry.surah_id}, Ayahs ${entry.ayah_from}-${entry.ayah_to}`}
        </div>
        <p className="text-gray-400">
          {getSurah(entry.surah_id)?.name ?? `Surah ${entry.surah_id}`}, ayah
          {entry.ayah_to > entry.ayah_from
            ? `s ${entry.ayah_from}–${entry.ayah_to}`
            : ` ${entry.ayah_from}`}
        </p>
      </Card>

      {/* Step 1: Listen */}
      {step === 'listen' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 1: Listen</h3>
          <p className="text-gray-400 mb-6">Listen to the recitation and read along</p>

          {/* Plays the first ayah of the range. Was a 3-second setTimeout that
              played nothing and flipped the label to "Playing...". */}
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
            onClick={() => setStep('recite')}
            className="w-full mt-4"
          >
            I&apos;ve listened — continue to recite
          </Button>
        </Card>
      )}

      {/* Step 2: Recite */}
      {step === 'recite' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 2: Recite</h3>
          <p className="text-gray-400 mb-6">
            Recite the ayahs aloud from memory, then rate how well it went.
          </p>

          {/* Said "🎤 Record Recitation" but only advanced the step — nothing was
              ever recorded. Self-recording is not built; the label now matches
              what the button does. */}
          <Button onClick={handleRecite} className="w-full py-4 text-lg">
            I&apos;ve recited — rate myself
          </Button>

          <Button variant="ghost" onClick={onSkip} className="w-full mt-4">
            Skip for now
          </Button>
        </Card>
      )}

      {/* Step 3: Rate */}
      {step === 'rate' && (
        <Card>
          <h3 className="text-xl font-semibold mb-4">Step 3: Rate Your Recall</h3>
          <p className="text-gray-400 mb-6">How well did you remember?</p>

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

