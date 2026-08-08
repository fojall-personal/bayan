'use client';
import { useRouter } from 'next/navigation';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BookOpen, Brain, BookMarked, Sparkles } from 'lucide-react';
import { apiPost, apiErrorMessage } from '@/lib/api';

interface OnboardingProps {
  onComplete: () => void;
  /** Goal already chosen on the root screen, so step 1 is not repeated. */
  initialGoal?: string;
}

const iconMap = {
  read_quran: BookOpen,
  understand_arabic: Brain,
  memorize_quran: BookMarked,
  all: Sparkles,
};

const GOAL_LABEL: Record<string, string> = {
  read_quran: 'Read the Quran fluently',
  understand_arabic: 'Understand Classical Arabic',
  memorize_quran: 'Memorize the Quran',
  all: 'All of the above',
};
const READING_LABEL: Record<string, string> = {
  no: 'not yet',
  partial: 'slowly, with effort',
  yes: 'comfortably',
};
const MEMORIZED_LABEL: Record<string, string> = {
  '0': 'none yet', '1-5': '1–5', '6-20': '6–20', '21+': '21 or more',
};
const CHALLENGE_LABEL: Record<string, string> = {
  reading: 'reading the script',
  grammar: 'grammar and meaning',
  memorization: 'memorizing and retaining',
};

export function Onboarding({ onComplete, initialGoal }: OnboardingProps) {
  const router = useRouter();
  type Goal = 'read_quran' | 'understand_arabic' | 'memorize_quran' | 'all';
  const preset = (['read_quran', 'understand_arabic', 'memorize_quran', 'all'] as const).includes(
    initialGoal as Goal
  )
    ? (initialGoal as Goal)
    : undefined;
  // The root screen asks the goal question first, so skip step 1 when it already
  // has an answer rather than asking the same thing twice.
  const [step, setStep] = useState(preset ? 2 : 1);
  const [goal, setGoal] = useState<Goal | undefined>(preset);
  const [readingAbility, setReadingAbility] = useState<'no' | 'partial' | 'yes'>('no');
  const [memorizedSurahs, setMemorizedSurahs] = useState<'0' | '1-5' | '6-20' | '21+'>('0');
  const [challenge, setChallenge] = useState<'reading' | 'grammar' | 'memorization'>('reading');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Save the profile, then go where the learner chose.
   *
   * The assessment used to be the only exit from this screen — step 3 offered
   * "Start Assessment" and "Back", and nothing else. Fifteen minutes and eighteen
   * questions before any content is the classic abandonment shape, and nothing
   * behind it needs a placement score: exercises filter by level, lessons carry
   * their own prerequisite chain, and memorization starts wherever you point it.
   * So placement is now an option with a real alternative.
   */
  const finish = async (destination: '/assessment' | '/today' | '/calibrate') => {
    setSaving(true);
    setError(null);
    try {
      await apiPost('/api/auth/onboarding', {
        goal,
        readingAbility,
        memorizedSurahs,
        challenge,
      });
      router.push(destination);
    } catch (err) {
      // This used to console.error and leave the button looking idle, so a failed
      // save was indistinguishable from a slow one.
      console.error('Onboarding error:', err);
      setError(apiErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step >= s ? 'bg-gold-500 text-ground-50' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-1 ${step > s ? 'bg-gold-500' : 'bg-gray-700'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Goal Selection */}
      {step === 1 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">What&apos;s your goal?</h2>
          <div className="space-y-3">
            {[
              { value: 'read_quran', label: 'Read the Quran fluently' },
              { value: 'understand_arabic', label: 'Understand Classical Arabic' },
              { value: 'memorize_quran', label: 'Memorize the Quran (Hifz)' },
              { value: 'all', label: 'All of the above' },
            ].map((option) => {
              const Icon = iconMap[option.value as keyof typeof iconMap];
              return (
                <button
                  key={option.value}
                  onClick={() => setGoal(option.value as any)}
                  className={`w-full p-4 rounded-lg text-left flex items-center gap-4 transition-colors ${
                    goal === option.value
                      ? 'bg-gold-500/20 border border-gold-500'
                      : 'bg-surface-2 hover:bg-surface hover:border-border'
                  }`}
                >
                  {Icon && <Icon className="w-6 h-6 text-gold-400" />}
                  <span className="font-semibold">{option.label}</span>
                </button>
              );
            })}
          </div>
          <Button
            onClick={() => setStep(2)}
            disabled={!goal}
            className="w-full mt-6"
          >
            Next
          </Button>
        </Card>
      )}

      {/* Step 2: Self-Assessment */}
      {step === 2 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Quick Self-Assessment</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold mb-3">Can you read Arabic script?</label>
              <div className="flex gap-3">
                {[
                  { value: 'no', label: 'No' },
                  { value: 'partial', label: 'Partially' },
                  { value: 'yes', label: 'Yes, comfortably' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setReadingAbility(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      readingAbility === option.value
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-border hover:border-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-3">
                How many surahs have you memorized?
              </label>
              <div className="flex gap-3">
                {[
                  { value: '0', label: 'None' },
                  { value: '1-5', label: '1-5' },
                  { value: '6-20', label: '6-20' },
                  { value: '21+', label: '21+' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMemorizedSurahs(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      memorizedSurahs === option.value
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-border hover:border-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-3">What&apos;s your biggest challenge?</label>
              <div className="flex gap-3">
                {[
                  { value: 'reading', label: 'Reading Arabic' },
                  { value: 'grammar', label: 'Grammar' },
                  { value: 'memorization', label: 'Memorization' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setChallenge(option.value as any)}
                    className={`flex-1 p-3 rounded-lg border transition-colors ${
                      challenge === option.value
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-border hover:border-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">
              Back
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1">
              Next
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Assessment Prompt */}
      {step === 3 && (
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Where would you like to start?</h2>
          <p className="text-muted mb-6">
            The placement test takes about 15 minutes and sets your starting level
            across reading, comprehension, grammar and memorization. You can also
            skip it and take it whenever you like — nothing is locked behind it.
          </p>

          {/* Raw enum values were being shown to the learner — "Goal: all",
              "Reading: no". These are the labels they actually picked. */}
          <div className="bg-surface-2 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Your profile</h3>
            <ul className="text-sm text-ground-300 space-y-1">
              <li>• Goal: {goal ? GOAL_LABEL[goal] : 'Select a goal'}</li>
              <li>• Reading Arabic script: {READING_LABEL[readingAbility]}</li>
              <li>• Surahs memorized: {MEMORIZED_LABEL[memorizedSurahs]}</li>
              <li>• Biggest challenge: {CHALLENGE_LABEL[challenge]}</li>
            </ul>
          </div>

          {error && (
            <p className="mb-4 text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <Button
            onClick={() => finish('/assessment')}
            disabled={saving}
            className="w-full py-4 text-lg font-semibold"
          >
            {saving ? 'Saving…' : 'Take the placement test — 15 min'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => finish('/calibrate')}
            disabled={saving}
            className="mt-3 w-full"
          >
            Skip the test — tell us what you know instead
          </Button>

          <Button
            variant="ghost"
            onClick={() => setStep(2)}
            disabled={saving}
            className="w-full mt-3"
          >
            Back
          </Button>
        </Card>
      )}
    </div>
  );
}
