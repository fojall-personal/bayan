'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Onboarding } from '@/components/onboarding/Onboarding';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiErrorMessage } from '@/lib/api';

import { useLocalStorage } from '@/hooks/useLocalStorage';

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

function GoalSelection({ onChoose }: { onChoose: (id: string) => void }) {
  // Persisted so the answer to the first question the app asks is not discarded
  // when the CTA navigates away. useLocalStorage handles the private-mode and
  // storage-disabled cases.
  const [goal, setGoal] = useLocalStorage<string | null>('bayan.goal', null);
  const select = (id: string) => setGoal(id);

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
            <span className="absolute inset-y-0 left-0 w-1/3 bg-gold-500" />
          </span>
          <span className="text-xs text-ground-400">of 3</span>
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
            <button
              onClick={() => onChoose(goal)}
              className="block w-full rounded-md bg-gold-500 py-3.5 text-center font-semibold text-ground-950 transition-colors duration-200 hover:bg-gold-400"
            >
              Continue
            </button>
          ) : (
            <span
              aria-disabled="true"
              className="block w-full cursor-not-allowed rounded-md bg-ground-800 py-3.5 text-center font-semibold text-ground-500"
            >
              Choose one to continue
            </span>
          )}
          {/* This used to promise "About 15 minutes" and go straight to the
              placement test, which was the only exit. The test is now one option
              of two, and the next screen says so. */}
          <p className="mt-4 text-center text-xs text-ground-500">
            A few more questions, then you choose whether to take the placement test.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * Root route. Reads the profile once and routes.
 *
 * This screen used to be the whole of `/`: a goal picker whose only exit was a
 * hard-coded href="/assessment". It never read the profile, so a learner with
 * onboarding_completed = 1 and a stored current_path landed back here and the only
 * way forward was the fifteen-minute test they had already passed. The state was
 * being written on submit; nothing at the entry point consulted it.
 *
 * The goal question was also duplicated — <Onboarding/> asks it as step 1, along
 * with reading ability, surahs memorized and biggest challenge, and it is the flow
 * that actually shapes the path. Two flows both set onboarding_completed and
 * neither was canonical. Now there is one: this goal screen hands its answer to
 * <Onboarding/>, which finishes the job.
 */
export default function Home() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'goal' | 'profile' | 'error'>('loading');
  const [goal, setGoal] = useLocalStorage<string | null>('bayan.goal', null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: { onboarding_completed: number | boolean } }>(
          '/api/auth/profile'
        );
        if (cancelled) return;
        // SQLite stores the flag as 0/1, so coerce rather than trusting truthiness.
        if (Number(res.data?.onboarding_completed) === 1) router.replace('/today');
        else setState(goal ? 'profile' : 'goal');
      } catch (err) {
        if (cancelled) return;
        // Failing closed to onboarding would push someone who has already done it
        // back through it on a network blip. Show the error and offer a way past.
        setError(apiErrorMessage(err));
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, goal]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-ground-300">Loading…</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto max-w-md pt-12">
        <Card>
          <h1 className="mb-2 text-xl font-bold">Couldn&apos;t load your profile</h1>
          <p className="mb-4 text-sm text-ground-300">{error}</p>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()}>Try again</Button>
            <Button variant="secondary" onClick={() => router.push('/today')}>
              Go to Today
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (state === 'goal') {
    return (
      <GoalSelection
        onChoose={(id) => {
          setGoal(id);
          setState('profile');
        }}
      />
    );
  }

  return <Onboarding initialGoal={goal ?? 'all'} onComplete={() => router.replace('/today')} />;
}
