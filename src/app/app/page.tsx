'use client';

import Link from 'next/link';
import { useState } from 'react';

const GOALS = [
  {
    id: 'read_quran',
    title: 'Read the Quran fluently',
    description: 'Arabic script, vowels and confident decoding',
    numeral: '١',
  },
  {
    id: 'understand_arabic',
    title: 'Understand Classical Arabic',
    description: 'Vocabulary, morphology and syntax as they appear in the text',
    numeral: '٢',
  },
  {
    id: 'memorize_quran',
    title: 'Memorize the Quran',
    description: 'Hifz on a spaced schedule, with meaning alongside recall',
    numeral: '٣',
  },
  {
    id: 'all',
    title: 'All of the above',
    description: 'One path that keeps reading, meaning and memory together',
    numeral: '٤',
  },
];

function GoalCard({
  goal,
  selected,
  onSelect,
}: {
  goal: (typeof GOALS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex w-full items-center gap-5 rounded-lg border px-6 py-5 text-left transition-colors duration-200 ${
        selected
          ? 'border-gold-500/60 bg-gold-500/[0.07]'
          : 'border-ground-800 bg-ground-900/70 hover:border-ground-700 hover:bg-ground-900'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-arabic text-base transition-colors duration-200 ${
          selected
            ? 'border-gold-500 bg-gold-500 text-ground-950'
            : 'border-ground-700 text-ground-400 group-hover:border-ground-600 group-hover:text-ground-300'
        }`}
      >
        {goal.numeral}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-semibold text-ground-50">
          {goal.title}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-ground-400">
          {goal.description}
        </span>
      </span>
    </button>
  );
}

export default function GoalSelection() {
  const [goal, setGoal] = useState<string | null>(null);

  const select = (id: string) => {
    setGoal(id);
    // Previously the choice lived only in component state and the CTA navigated
    // away, so the answer to the first question the app asks was discarded.
    try {
      window.localStorage.setItem('bayan.goal', id);
    } catch {
      // private mode / storage disabled — the assessment still works without it
    }
  };

  return (
    <div className="relative">
      <div className="geo-texture" aria-hidden="true" />

      <main className="relative z-10 mx-auto max-w-[38rem] px-6 pb-24 pt-8">
        {/* Step rail */}
        <div className="mb-14 flex items-center gap-3">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-label text-gold-400">
            Step 1
          </span>
          <span className="relative h-px flex-1 bg-ground-800">
            <span className="absolute inset-y-0 left-0 w-1/4 bg-gold-500" />
          </span>
          <span className="text-xs text-ground-400">of 4</span>
        </div>

        {/* Opening */}
        <p
          lang="ar"
          dir="rtl"
          className="mb-3 text-center font-arabic text-[1.75rem] leading-arabic text-gold-400"
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <p className="text-center text-sm italic leading-relaxed text-ground-300">
          In the name of God, the Entirely Merciful, the Especially Merciful
        </p>
        <p className="mt-2 text-center text-[0.6875rem] uppercase tracking-label text-ground-500">
          Al-Fatihah 1:1
        </p>

        <hr className="mx-auto my-14 w-16 border-0 border-t border-ground-800" />

        {/* Question */}
        <h1 className="text-center font-display text-[1.75rem] font-semibold tracking-tight text-ground-50">
          What are you here for?
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center leading-relaxed text-ground-300">
          Pick what fits where you are now. The path adjusts as you go.
        </p>

        {/* Goals */}
        <div className="mt-12 flex flex-col gap-3">
          {GOALS.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              selected={goal === g.id}
              onSelect={() => select(g.id)}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10">
          {goal ? (
            <Link
              href="/assessment"
              className="block w-full rounded-md bg-gold-500 py-3.5 text-center font-semibold text-ground-950 transition-colors duration-200 hover:bg-gold-400"
            >
              Continue to assessment
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="block w-full cursor-not-allowed rounded-md bg-ground-800 py-3.5 text-center font-semibold text-ground-500"
            >
              Choose one to continue
            </span>
          )}
          <p className="mt-4 text-center text-xs text-ground-500">
            About 15 minutes. Reading, vocabulary and grammar — no recording.
          </p>
        </div>
      </main>
    </div>
  );
}
