'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Brain, BookMarked, Sparkles } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'read-quran': BookOpen,
  'understand-arabic': Brain,
  'memorize-quran': BookMarked,
  'all': Sparkles,
};

const goals = [
  { id: 'read-quran', title: 'Read the Quran fluently', description: 'Learn to read Arabic script and understand the text' },
  { id: 'understand-arabic', title: 'Understand Classical Arabic', description: 'Master grammar, vocabulary, and comprehension' },
  { id: 'memorize-quran', title: 'Memorize the Quran (Hifz)', description: 'Systematic memorization with spaced repetition' },
  { id: 'all', title: 'All of the above', description: 'Comprehensive learning path for all goals' },
];

export default function GoalSelection() {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-500 to-primary-400 bg-clip-text text-transparent">
            Language Builder
          </h1>
          <p className="text-gray-400 text-lg">
            Learn Classical Arabic with Quran comprehension, grammar mastery, and memorization tools
          </p>
        </div>

        {/* Goal Selection */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-50 text-center">What&apos;s your goal?</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {goals.map((goal) => {
              const Icon = iconMap[goal.id];
              return (
                <button
                  key={goal.id}
                  onClick={() => setSelectedGoal(goal.id)}
                  className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
                    selectedGoal === goal.id
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  {Icon && <Icon className="w-8 h-8 text-primary-400 shrink-0" />}
                  <div>
                    <div className="font-bold text-lg text-gray-50">{goal.title}</div>
                    <div className="text-sm text-gray-400">{goal.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/assessment"
          className={`block w-full text-center py-4 rounded-xl font-bold text-lg transition-all ${
            selectedGoal
              ? 'bg-primary-500 text-gray-950 hover:bg-primary-400 shadow-glow'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          aria-label="Continue to assessment"
        >
          Continue
        </Link>
      </div>
    </div>
  );
}
