'use client';

// Runs the corpus-derived grammar exercise bank.
//
// 38,995 items across 25 kinds and 5 levels, all generated from the morphology
// corpus. Every one carries the surah:ayah it came from, which is shown after
// answering — the citation is the point. An exercise you can trace is one you can
// disprove, which is exactly what the five hand-written grammar errors were not.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
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
  // Kinds 6–10, from annotation the generator had never read.
  { value: 'subject_agreement', label: 'Who is the subject' },
  { value: 'definiteness', label: 'Definite or indefinite' },
  { value: 'mood', label: 'Mood (indicative / subjunctive / jussive)' },
  { value: 'voice', label: 'Active or passive' },
  { value: 'negation', label: 'Which word negates' },
  // Kinds 13–16. word_role asks what a word DOES, which the find-the-word kinds cannot.
  { value: 'word_role', label: 'What role does this word play' },
  { value: 'relative_pronoun', label: 'Which word is the relative pronoun' },
  { value: 'demonstrative', label: 'Which word is the demonstrative' },
  { value: 'conditional', label: 'Which word makes it conditional' },
  // Kind 17, for grammar-03 — the one lesson that had no practice at all.
  { value: 'sentence_type', label: 'Nominal or verbal sentence' },
  // Kinds 18–23, from the treebank's syntax layer: what a word DOES, which the
  // morphology corpus never recorded. Every one is cross-checked against the
  // hand-verified case before it reaches the bank.
  { value: 'mubtada_khabar', label: 'Which word is the predicate (خبر)' },
  { value: 'subject_word', label: 'Which word is the doer (فاعل)' },
  { value: 'object', label: 'Which word is the object (مفعول به)' },
  { value: 'idafa', label: 'Which word is the مضاف إليه' },
  { value: 'derived_noun', label: 'Participle or verbal noun' },
  { value: 'fronting', label: 'Which word is fronted (تقديم)' },
  // Kind 24. Paronomasia — ARDT device CA-1, and the only device of ʿilm al-badīʿ that
  // falls out of data this project already trusts, since it is a fact about roots.
  { value: 'jinas', label: 'Two words, one root (al-jinās)' },
  // Kind 25 — ARDT B-1. The one device of ʿilm al-bayān with a particle to find.
  { value: 'simile', label: 'Which word opens a comparison (al-tashbīh)' },
  // One spelling, two jobs — only the sentence decides. The first kind here that
  // cannot be answered from the word alone.
  { value: 'homograph', label: 'Which مَا is this? (one spelling, two jobs)' },
];

/**
 * Kinds whose subject is a whole ayah rather than one word, so the type steps down and is
 * allowed to wrap. derived_noun is deliberately absent: it asks about a single word's
 * pattern, and shrinking that would hide the diacritics that distinguish مُفْعِل from مُفْعَل.
 */
const WHOLE_AYAH_KINDS = new Set([
  'find_word', 'mubtada_khabar', 'subject_word', 'object', 'idafa', 'fronting', 'jinas',
  'simile',
]);

const LEVELS = [
  { value: '', label: 'All levels' },
  // Level is how often the word occurs in the Quran, and it now means that for
  // every kind. It used to be a constant for three of the five — pos_id was
  // always level 1, aspect always 2 — so "Level 5 — rare roots" described only
  // verb_form, and picking level 5 returned 34 items out of a possible 750.
  { value: '1', label: 'Level 1 — the commonest words' },
  { value: '2', label: 'Level 2 — very frequent' },
  { value: '3', label: 'Level 3 — frequent' },
  { value: '4', label: 'Level 4 — occasional' },
  { value: '5', label: 'Level 5 — rare words' },
];

export function ExerciseRunner() {
  // ?kind= and ?level= open the runner already filtered.
  //
  // Lessons link here for topic practice — /grammar?kind=aspect&level=1 after the
  // past-tense lesson — which reuses this runner rather than building a second one
  // that would need its own grading and its own mastery recording.
  const params = useSearchParams();
  const [level, setLevel] = useState(params.get('level') ?? '1');
  const [kind, setKind] = useState(params.get('kind') ?? '');
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
    const isCorrect = option === current.answer;
    setPicked(option);
    setScore((s) => ({
      right: s.right + (isCorrect ? 1 : 0),
      total: s.total + 1,
    }));

    // Record it. This was local state only, so a learner could work through the whole
    // bank — 4,950 items at the time — and the app would remember none of it. POST
    // /api/grammar/exercise existed throughout, with no caller.
    //
    // Deliberately not awaited and deliberately silent: recording is bookkeeping,
    // and blocking the answer reveal or showing an error over a failed write would
    // punish the learner for something that is not their problem.
    apiPost('/api/grammar/exercise', {
      exerciseId: current.id,
      answer: option,
      correct: isCorrect,
    }).catch(() => {
      // Progress bookkeeping is best-effort; the exercise itself still works.
    });
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
          {/* sentence_type has nothing to show: its four ayat ARE the options, so there is
              no single subject above the prompt. Rendered conditionally rather than as an
              empty element, which would leave a 5xl line-height of dead space. */}
          {current.word !== '' && (
            <p
              className={`text-center mb-6 text-naskh leading-loose ${
                WHOLE_AYAH_KINDS.has(current.kind) ? 'text-2xl' : 'text-5xl'
              }`}
              dir="rtl"
            >
              {current.word}
            </p>
          )}

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
                  // text-start, not text-left: with dir="auto" an Arabic option is RTL, and
                  // text-left pushed it to the far side of the button away from where the
                  // reading starts. Affects every kind whose options are Arabic — most of
                  // them — and is most visible on sentence_type, whose options are ayat.
                  className={`text-start px-4 py-3 rounded-lg border transition-colors text-naskh ${
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
              <p className="text-xs text-ground-400">
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
        <p className="text-xs text-ground-400">
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
