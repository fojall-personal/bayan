'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BookOpen, Brain, BookMarked, Sparkles } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

const iconMap = {
  read_quran: BookOpen,
  understand_arabic: Brain,
  memorize_quran: BookMarked,
  all: Sparkles,
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<'read_quran' | 'understand_arabic' | 'memorize_quran' | 'all'>('all');
  const [readingAbility, setReadingAbility] = useState<'no' | 'partial' | 'yes'>('no');
  const [memorizedSurahs, setMemorizedSurahs] = useState<'0' | '1-5' | '6-20' | '21+'>('0');
  const [challenge, setChallenge] = useState<'reading' | 'grammar' | 'memorization'>('reading');

  const handleStartAssessment = async () => {
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ goal, readingAbility, memorizedSurahs, challenge }),
      });

      if (res.ok) {
        window.location.href = '/assessment';
      }
    } catch (error) {
      console.error('Onboarding error:', error);
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
                step >= s ? 'bg-primary-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-1 ${step > s ? 'bg-primary-500' : 'bg-gray-700'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Goal Selection */}
      {step === 1 && (
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">What's your goal?</h2>
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
                      ? 'bg-primary-500/20 border border-primary-500'
                      : 'bg-surface-2 hover:bg-surface hover:border-border'
                  }`}
                >
                  {Icon && <Icon className="w-6 h-6 text-primary-400" />}
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
                        ? 'border-primary-500 bg-primary-500/10'
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
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-border hover:border-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-lg font-semibold mb-3">What's your biggest challenge?</label>
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
                        ? 'border-primary-500 bg-primary-500/10'
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
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted mb-6">
            Take our 30-minute diagnostic assessment to personalize your learning path.
            We'll assess your Arabic reading, comprehension, grammar, and memorization levels.
          </p>

          <div className="bg-surface-2 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Your Profile:</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Goal: {goal}</li>
              <li>• Reading: {readingAbility}</li>
              <li>• Memorized: {memorizedSurahs} surahs</li>
              <li>• Challenge: {challenge}</li>
            </ul>
          </div>

          <Button onClick={handleStartAssessment} className="w-full py-4 text-lg font-semibold">
            Start Assessment
          </Button>

          <Button
            variant="ghost"
            onClick={() => setStep(2)}
            className="w-full mt-3"
          >
            Back
          </Button>
        </Card>
      )}
    </div>
  );
}
