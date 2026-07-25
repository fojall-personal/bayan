'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ASSESSMENT_MODULES } from './questions.generated';
import { apiPost, apiErrorMessage } from '@/lib/api';

interface AssessmentProps {
  onComplete: (result: unknown) => void;
}

export function AssessmentFlow({ onComplete }: AssessmentProps) {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 18 questions from content/assessments/placement-test.json, generated into a
  // module by scripts/gen-assessment.mjs. This replaces 7 questions that were
  // hardcoded here, had drifted from the bank, and carried their own copy of the
  // الرحيم mistranslation.
  const modules = ASSESSMENT_MODULES;

  const currentModule = modules[currentModuleIndex];
  const currentQuestion = currentModule.questions[currentQuestionIndex];

  const handleAnswer = (answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answer,
    }));

    // Move to next question or module
    if (currentQuestionIndex < currentModule.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
      setCurrentQuestionIndex(0);
    } else {
      // Assessment complete
      calculateAndSubmitScores();
    }
  };

  const calculateAndSubmitScores = async () => {
    // Calculate scores for each module
    const moduleScores: Record<string, number> = {};

    for (const module of modules) {
      let correct = 0;
      for (const question of module.questions) {
        if (answers[question.id] === question.correctAnswer) {
          correct++;
        }
      }
      moduleScores[module.id] = Math.round((correct / module.questions.length) * 100);
    }

    setScores(moduleScores);
    setIsComplete(true);

    // Submit to backend
    try {
      const data = await apiPost<{ data: unknown }>('/api/assessment/submit', {
        literacy_score: moduleScores.literacy || 0,
        comprehension_score: moduleScores.comprehension || 0,
        grammar_score: moduleScores.grammar || 0,
        memorization_score: moduleScores.memorization || 0,
      });
      onComplete?.(data.data as never);
    } catch (error) {
      // Previously this reported all-zero scores as though the assessment had
      // been submitted, so a network failure looked like a genuine result.
      console.error('Failed to submit assessment:', error);
      setSubmitError(apiErrorMessage(error));
    }
  };

  if (isComplete) {
    return (
      <div className="page-transition">
        <Card className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Assessment complete</h2>

          {submitError && (
            <div className="mb-6 rounded-md border border-error/40 bg-error/10 p-4">
              <p className="text-sm font-medium text-error">
                Your answers were scored locally but could not be saved.
              </p>
              <p className="mt-1 text-sm text-ground-300">{submitError}</p>
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(scores).map(([module, score]) => (
              <div key={module}>
                <div className="flex justify-between text-sm mb-2">
                  <span className="capitalize font-medium">{module}</span>
                  <span className="text-gray-400">{score}%</span>
                </div>
                <ProgressBar progress={score} />
              </div>
            ))}
          </div>

          {(() => {
            // Was a fixed paragraph shown regardless of scores, on the screen
            // whose entire purpose is adaptivity. Name the weakest domain, which
            // is what the path is actually chosen from.
            const entries = Object.entries(scores);
            if (!entries.length) return null;
            const [weakest] = entries.sort((a, b) => a[1] - b[1])[0];
            return (
              <div className="mt-8 rounded-md border border-ground-800 bg-ground-950 p-4">
                <div className="text-xs font-semibold uppercase tracking-label text-gold-400">
                  Where to start
                </div>
                <p className="mt-2 text-sm text-ground-300">
                  Your lowest domain is <span className="capitalize text-ground-50">{weakest}</span>,
                  so your path leads with that. Full results and the assigned path are on the
                  assessment page.
                </p>
              </div>
            );
          })()}
        </Card>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Module {currentModuleIndex + 1} of {modules.length}</span>
          <span>{currentModule.title}</span>
        </div>
        <ProgressBar progress={((currentModuleIndex + 1) / modules.length) * 100} />
      </div>

      {/* Question */}
      <Card>
        <h2 className={`text-xl font-semibold mb-4 ${
          /[\u0600-\u06FF]/.test(currentQuestion.instruction) ? 'text-right arabic-text' : ''
        }`}>{currentQuestion.instruction}</h2>

        {currentQuestion.display && (
          <p
            lang="ar"
            dir="rtl"
            className="mb-6 rounded-md border border-ground-800 bg-ground-950 py-6 text-center font-arabic text-4xl leading-arabic text-ground-50"
          >
            {currentQuestion.display}
          </p>
        )}

        <div className="space-y-3">
          {currentQuestion.options?.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(option)}
              className={`w-full p-4 text-left rounded-lg border ${
                answers[currentQuestion.id] === option 
                  ? 'border-gold-500 bg-gold-500/10' 
                  : 'border-gray-700 hover:border-gold-500'
              } transition-all ${
                /[\u0600-\u06FF]/.test(option) ? 'text-right' : ''
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
