'use client';

// Runs the corpus-derived grammar exercise bank.
//
// 780 items across 5 kinds and 5 levels, all generated from the morphology
// corpus. Every one carries the surah:ayah it came from, which is shown after
// answering — the citation is the point. An exercise you can trace is one you can
// disprove, which is exactly what the five hand-written grammar errors were not.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';

interface Exercise {
  id: string;
  kind: string;
  level: number;
  word: string;
  prompt: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
  root: string | null;
}

interface Attribution {
  source: string;
  url: string;
  licence: string;
}

const KINDS = [
  { value: '', label: 'All kinds' },
  // Comprehension first — these ask what a word MEANS, which the morphology
  // corpus cannot express and which the first 754 exercises therefore all
  // omitted. They come from the word-by-word gloss table.
  { value: 'word_meaning', label: 'Word meaning' },
  { value: 'find_word', label: 'Find the word in an ayah' },
  { value: 'verb_form', label: 'Verb form (I–XII)' },
  { value: 'case_ending', label: "Case ending (i'rab)" },
  { value: 'root_id', label: 'Root identification' },
  { value: 'pos_id', label: 'Part of speech' },
  { value: 'aspect', label: 'Verb aspect' },
];

const LEVELS = [
  { value: '', label: 'All levels' },
  { value: '1', label: 'Level 1 — commonest words' },
  { value: '2', label: 'Level 2' },
  { value: '3', label: 'Level 3' },
  { value: '4', label: 'Level 4' },
  { value: '5', label: 'Level 5 — rare roots' },
];

export function ExerciseRunner() {
  const [level, setLevel] = useState('1');
  const [kind, setKind] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);
  const [attribution, setAttribution] = useState<Attribution | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (level) params.set('level', level);
      if (kind) params.set('kind', kind);
      const res = await apiFetch<{ data: Exercise[]; attribution: Attribution }>(
        `/api/grammar/exercises?${params}`
      );
      setItems(res.data ?? []);
      setAttribution(res.attribution ?? null);
      setIndex(0);
      setPicked(null);
      setScore({ right: 0, total: 0 });
    } catch (err) {
      console.error('Failed to load exercises:', err);
      setError(apiErrorMessage(err));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [level, kind]);

  useEffect(() => {
    load();
  }, [load]);

  const current = items[index];

  const choose = (option: string) => {
    if (picked !== null) return; // one answer per item
    setPicked(option);
    setScore((s) => ({
      right: s.right + (option === current.answer ? 1 : 0),
      total: s.total + 1,
    }));
  };

  if (loading) {
    return (
      <Card className="text-center py-12">
        <p className="text-gray-400">Loading exercises…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <h3 className="text-lg font-bold mb-2">Couldn&apos;t load exercises</h3>
        <p className="text-gray-400 mb-4">{error}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Level" value={level} onChange={setLevel} options={LEVELS} />
          <Select label="Exercise type" value={kind} onChange={setKind} options={KINDS} />
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-xl font-bold mb-2">Nothing at this combination</h3>
          <p className="text-gray-400">
            Not every type exists at every level — the bank only contains items the
            corpus actually supports.
          </p>
        </Card>
      ) : index >= items.length ? (
        <Card className="text-center py-12">
          <h3 className="text-2xl font-bold mb-2">
            {score.right} of {score.total}
          </h3>
          <p className="text-gray-400 mb-6">
            {score.right === score.total
              ? 'All correct.'
              : 'Explanations cite the ayah each word came from.'}
          </p>
          <Button onClick={load}>Another set</Button>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between text-sm text-gray-400 mb-6">
            <span>
              {index + 1} of {items.length}
            </span>
            <span>
              Level {current.level} · {KINDS.find((k) => k.value === current.kind)?.label ?? current.kind}
            </span>
          </div>

          {/* The word under examination. Naskh, and dir="auto" — the prompt mixes
              English with Arabic, and forcing RTL is what put question marks on
              the wrong side across this app. */}
          {/* find_word puts a whole ayah here, not one word, so the size steps
              down and it is allowed to wrap. */}
          <p
            className={`text-center mb-6 text-naskh leading-loose ${
              current.kind === 'find_word' ? 'text-2xl' : 'text-5xl'
            }`}
            dir="rtl"
          >
            {current.word}
          </p>

          <h3 dir="auto" className="text-lg font-semibold mb-6 text-naskh">
            {current.prompt}
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {current.options.map((option) => {
              const isAnswer = option === current.answer;
              const isPicked = option === picked;
              const settled = picked !== null;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  disabled={settled}
                  dir="auto"
                  className={`text-left px-4 py-3 rounded-lg border transition-colors text-naskh ${
                    settled && isAnswer
                      ? 'border-leaf-500 bg-leaf-500/15 text-leaf-400'
                      : settled && isPicked
                        ? 'border-red-500 bg-red-500/10 text-red-400'
                        : settled
                          ? 'border-gray-700 bg-gray-800 text-gray-500'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600 text-gray-200'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div className="mt-6 space-y-4">
              <p dir="auto" className="text-sm text-gray-300 text-naskh">
                {current.explanation}
              </p>
              <p className="text-xs text-gray-500">
                Source: Quran {current.source}
                {getSurah(Number(current.source.split(':')[0]))
                  ? ` — ${getSurah(Number(current.source.split(':')[0]))!.name}`
                  : ''}
                {current.root ? ` · root ${current.root}` : ''}
              </p>
              <Button
                onClick={() => {
                  setIndex((i) => i + 1);
                  setPicked(null);
                }}
              >
                {index + 1 === items.length ? 'See results' : 'Next'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Licence condition, not a courtesy: the corpus is GPL and requires a
          visible link wherever its data is surfaced. */}
      {attribution && (
        <p className="text-xs text-gray-500">
          Grammar data from{' '}
          <a
            href={attribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold-400 hover:underline"
          >
            {attribution.source}
          </a>{' '}
          ({attribution.licence}).
        </p>
      )}
    </div>
  );
}
