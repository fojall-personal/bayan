'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface AssessmentModule {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  questions: AssessmentQuestion[];
}

interface AssessmentQuestion {
  id: string;
  type: string;
  text: string;
  options?: string[];
  correctAnswer?: string;
}

interface AssessmentProps {
  onComplete: (scores: {
    literacy: number;
    comprehension: number;
    grammar: number;
    memorization: number;
  }) => void;
}

export function AssessmentFlow({ onComplete }: AssessmentProps) {
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const modules: AssessmentModule[] = [
    {
      id: 'literacy',
      title: 'Arabic Script Literacy',
      description: 'Identify letters, recognize vowels, and read words',
      duration_minutes: 10,
      questions: [
        {
          id: 'lit-01',
          type: 'multiple-choice',
          text: 'Which letter is this: ب',
          options: ['ب (ba)', 'ت (ta)', 'ث (tha)', 'ن (nun)'],
          correctAnswer: 'ب (ba)',
        },
        {
          id: 'lit-02',
          type: 'multiple-choice',
          text: 'What vowel sound does this diacritic represent: َ',
          options: ['Fatha (a)', 'Kasra (i)', 'Damma (u)', 'Sukun (no vowel)'],
          correctAnswer: 'Fatha (a)',
        },
      ],
    },
    {
      id: 'comprehension',
      title: 'Classical Arabic Comprehension',
      description: 'Understand Quranic passages and classical text',
      duration_minutes: 15,
      questions: [
        {
          id: 'comp-01',
          type: 'multiple-choice',
          text: "What does 'الرَّحْمَٰنِ الرَّحِيمِ' mean?",
          options: [
            'The Merciful, The Forgiving',
            'The King, The Powerful',
            'The Creator, The Sustainer',
          ],
          correctAnswer: 'The Merciful, The Forgiving',
        },
        {
          id: 'comp-02',
          type: 'multiple-choice',
          text: "In Al-Fatiha, what does 'مَالِكِ يَوْمِ الدِّينِ' mean?",
          options: [
            'Master of the Day of Judgment',
            'King of the Day of Prayer',
            'Creator of the Day of Rest',
          ],
          correctAnswer: 'Master of the Day of Judgment',
        },
      ],
    },
    {
      id: 'grammar',
      title: 'Arabic Grammar Knowledge',
      description: 'Test your understanding of nahw, sarf, and balagha',
      duration_minutes: 15,
      questions: [
        {
          id: 'gram-01',
          type: 'multiple-choice',
          text: 'Is كِتَاب definite or indefinite?',
          options: ['Definite (مَعْرِفَة)', 'Indefinite (نَكِرَة)', 'Proper noun (عَلَم)'],
          correctAnswer: 'Indefinite (نَكِرَة)',
        },
        {
          id: 'gram-02',
          type: 'multiple-choice',
          text: 'What verb form is كَتَبَ?',
          options: ['Form I (فَعَلَ)', 'Form II (فَاعَلَ)', 'Form III (فَعِّلَ)'],
          correctAnswer: 'Form I (فَعَلَ)',
        },
      ],
    },
    {
      id: 'memorization',
      title: 'Memorization Baseline',
      description: 'Test your Quran memorization knowledge',
      duration_minutes: 10,
      questions: [
        {
          id: 'mem-01',
          type: 'multiple-choice',
          text: 'What follows "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" in Al-Fatiha?',
          options: [
            'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
            'الرَّحْمَٰنِ الرَّحِيمِ',
            'مَالِكِ يَوْمِ الدِّينِ',
          ],
          correctAnswer: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        },
      ],
    },
  ];

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
      const token = process.env.NEXT_PUBLIC_API_TOKEN || 'dev-token';
      const res = await fetch('/api/assessment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          literacy_score: moduleScores.literacy || 0,
          comprehension_score: moduleScores.comprehension || 0,
          grammar_score: moduleScores.grammar || 0,
          memorization_score: moduleScores.memorization || 0,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onComplete?.(data.data);
      }
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      onComplete?.(moduleScores);
    }
  };

  if (isComplete) {
    return (
      <div className="page-transition">
        <Card className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Assessment Complete!</h2>

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

          <div className="mt-8 p-4 bg-gray-800 rounded-lg">
            <h3 className="font-semibold mb-2">Your Learning Path</h3>
            <p className="text-gray-400 text-sm">
              Based on your assessment, we recommend starting with foundational skills and progressing to advanced comprehension.
            </p>
          </div>
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
        <h2 className="text-xl font-semibold mb-4">{currentQuestion.text}</h2>

        <div className="space-y-3">
          {currentQuestion.options?.map((option, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(option)}
              className="w-full p-4 text-left rounded-lg border border-gray-700 hover:border-arabic-green transition-all"
            >
              {option}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
