'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { practiceHref } from '@/lib/lesson-practice';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { Input } from '@/components/ui/Input';

interface Lesson {
  id: string;
  title: string;
  module: string;
  level: number;
  content: LessonContent;
  exercises: Exercise[];
  progress?: {
    completed: boolean;
    score: number;
    attempts: number;
    streak: number;
  };
}

interface LessonContent {
  explanation: string;
  examples?: Array<{
    arabic: string;
    transliteration: string;
    meaning: string;
    rule?: string;
  }>;
  rules?: Array<{
    name: string;
    description: string;
    letters?: string;
    examples: string[];
  }>;
}

interface Exercise {
  type: 'multiple_choice' | 'fill_blank' | 'match' | 'audio_repeat' | 'pattern_recognition' | 'translation';
  question: string;
  options?: string[];
  correct?: string | number;
  pairs?: Array<{ item: string; answer: string }>;
  explanation?: string;
}

interface LearningPageProps {
  userId: string;
}

/**
 * One exercise's outcome, from the submit response.
 *
 * The score alone told the learner nothing actionable: "1 of 2 correct" with no way to
 * find out which, what the answer was, or why. The grading loop knew all of it and
 * discarded it, and the `explanation` prose in every exercise had never been read.
 */
interface ReviewItem {
  index: number;
  type: string;
  question: string | null;
  /** Already rendered as readable text by the server. */
  given: string | null;
  expected: string | null;
  correct: boolean;
  answered: boolean;
  explanation: string | null;
}

export function LearningPage({ userId }: LearningPageProps) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [result, setResult] = useState<{
    score: number;
    correct: number;
    total: number;
    completed: boolean;
    review?: ReviewItem[];
  } | null>(null);

  // ?lesson=<id> opens that lesson instead of the next unlocked one.
  //
  // The tutor's "Worth practising" rows link here, and without this the parameter
  // was silently ignored — the learner clicked "Practise" on Articles and Nouns and
  // landed on whatever lesson was next, which is the dead-click pattern the audit
  // already flagged once for the tutor's suggestion chips.
  const requestedLesson = useSearchParams().get('lesson');

  useEffect(() => {
    fetchNextLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLesson]);

  const fetchNextLesson = async () => {
    setLoading(true);
    try {
      // Both endpoints now answer with {data}; they differ only in what sits
      // inside it — /lessons/:id returns the lesson itself, /next wraps it
      // alongside progress and a message for the all-complete case.
      const data = await apiFetch<{
        data?: Lesson & { lesson?: Lesson | null; message?: string };
      }>(
        requestedLesson
          ? `/api/learning/lessons/${encodeURIComponent(requestedLesson)}`
          : '/api/learning/next'
      );
      const loaded = requestedLesson ? data.data : (data.data?.lesson ?? null);
      if (loaded) {
        setLesson(loaded as Lesson);
        setError(null);
        setResult(null);
      } else {
        setError(data.data?.message || 'No more lessons available');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (exerciseIndex: number, answer: string | number) => {
    setAnswers((prev) => ({ ...prev, [exerciseIndex]: answer }));
  };

  /**
   * Whether the current exercise has actually been answered.
   *
   * `answers[i] !== undefined` was enough while every type had a single response. A
   * match has one per pair, and a partly filled one is not a wrong answer — it is an
   * unanswered question — so advancing from it would score a zero the learner never
   * chose. Empty strings also count as unanswered, which covers a fill-in-the-blank
   * left blank after being typed into and cleared.
   */
  const isAnswered = (exerciseIndex: number): boolean => {
    const raw = answers[exerciseIndex];
    if (raw === undefined) return false;
    const exercise = lesson?.exercises?.[exerciseIndex];
    if (exercise?.type === 'match') {
      const expected = exercise.pairs?.length ?? 0;
      try {
        const chosen = typeof raw === 'string' ? JSON.parse(raw) : [];
        return (
          Array.isArray(chosen) &&
          chosen.length === expected &&
          chosen.every((v: unknown) => typeof v === 'string' && v.length > 0)
        );
      } catch {
        return false;
      }
    }
    return String(raw).trim().length > 0;
  };

  // Every authored type is now gradable: multiple_choice and fill_blank always were,
  // and match became so once it started asking instead of telling.
  const gradable = lesson?.exercises ?? [];
  const isLastExercise =
    !!lesson && currentExerciseIndex >= lesson.exercises.length - 1;

  const handleSubmit = async () => {
    if (!lesson) return;

    try {
      // Positional: answers[i] is the response to exercises[i]. This used to
      // send [{index, answer}] objects, which the server compared against
      // scalars — so every lesson scored 0% and none could ever complete.
      const positional = lesson.exercises.map((_, i) => answers[i] ?? null);

      const data = await apiPost<{ data: typeof result }>(
        `/api/learning/lessons/${lesson.id}/submit`,
        { answers: positional }
      );
      setResult(data.data);
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(apiErrorMessage(err));
    }
  };

  const handleNextLesson = () => {
    setLesson(null);
    setResult(null);
    setAnswers({});
    setCurrentExerciseIndex(0);
    fetchNextLesson();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading lesson...</div>
      </div>
    );
  }

  if (error && !lesson) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">No Lessons Available</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <Button onClick={fetchNextLesson}>Refresh</Button>
      </div>
    );
  }

  if (!lesson) return null;

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6">
      {/* Lesson Header */}
      <div className="flex items-start justify-between">
        <div>
          <Badge variant="info">{lesson.module}</Badge>
          <h1 className="text-3xl font-bold mt-2">{lesson.title}</h1>
          <p className="text-gray-400 mt-1">Level {lesson.level}</p>
        </div>
        {lesson.progress && (
          <div className="text-right">
            <div className="text-sm text-gray-400">Progress</div>
            <div className="text-2xl font-bold">
              {lesson.progress.completed ? '✓' : `${lesson.progress.attempts}x`}
            </div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <ProgressBar
        progress={
          lesson.exercises.length
            ? ((currentExerciseIndex + 1) / lesson.exercises.length) * 100
            : 0
        }
        label={`Exercise ${currentExerciseIndex + 1} of ${lesson.exercises.length}`}
        tone="leaf"
      />

      {/* Lesson Content */}
      {lesson.content.explanation && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Explanation</h2>
          <div className="prose prose-invert max-w-none">
            <p className="text-gray-300 leading-relaxed">{lesson.content.explanation}</p>
          </div>
        </Card>
      )}

      {/* Examples */}
      {lesson.content.examples && lesson.content.examples.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Examples</h2>
          <div className="space-y-4">
            {lesson.content.examples.map((example, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4">
                <div className="text-2xl text-arabic mb-2" dir="rtl" lang="ar">
                  {example.arabic}
                </div>
                <div className="text-sm text-gray-400 mb-1">
                  {example.transliteration}
                </div>
                <div className="text-sm text-gray-300">
                  {example.meaning}
                </div>
                {example.rule && (
                  <div className="text-xs text-gold-400 mt-2">
                    Rule: {example.rule}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Rules */}
      {lesson.content.rules && lesson.content.rules.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Grammar Rules</h2>
          <div className="space-y-4">
            {lesson.content.rules.map((rule, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-semibold text-gold-400 mb-2">
                  {rule.name}
                </h3>
                <p className="text-gray-300 text-sm mb-2">{rule.description}</p>
                {rule.letters && (
                  <div className="text-sm text-gray-400 mb-2">
                    Letters: <span className="text-arabic text-lg" dir="rtl" lang="ar">{rule.letters}</span>
                  </div>
                )}
                {rule.examples && (
                  <div className="flex flex-wrap gap-2">
                    {rule.examples.map((ex, j) => (
                      <span key={j} className="text-sm bg-gray-700 px-2 py-1 rounded">
                        {ex}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Exercise */}
      {lesson.exercises.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">
            Exercise {currentExerciseIndex + 1} of {lesson.exercises.length}
          </h2>

          {result ? (
            /* Result View */
            <div className="text-center py-8">
              <div className="text-6xl font-bold mb-4">
                {result.completed ? '✓' : '✗'}
              </div>
              <div className="text-3xl font-bold mb-2">
                {result.score}%
              </div>
              <div className="mb-6 text-ground-300">
                {result.correct} of {result.total} correct
              </div>

              {/* What went wrong, and why.
                *
                * Wrong answers first: they are the reason to read this at all. The
                * explanation is the authored prose that had been stored and never
                * shown, which is the whole point of the screen. */}
              {result.review && result.review.length > 0 && (
                <ul className="mb-6 space-y-3 text-left">
                  {[...result.review]
                    .sort((a, b) => Number(a.correct) - Number(b.correct))
                    .map((item) => (
                      <li
                        key={item.index}
                        className={`rounded-md border p-4 ${
                          item.correct ? 'border-ground-800' : 'border-error/40'
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span
                            aria-hidden="true"
                            className={item.correct ? 'text-leaf-400' : 'text-error'}
                          >
                            {item.correct ? '✓' : '✗'}
                          </span>
                          <p className="text-sm" dir="auto">
                            {item.question ?? `Exercise ${item.index + 1}`}
                          </p>
                        </div>

                        {!item.correct && (
                          <p className="mt-2 text-sm text-ground-300" dir="auto">
                            You answered{' '}
                            <span className="text-arabic text-ground-100" lang="ar">
                              {item.given ?? 'not answered'}
                            </span>
                            {item.expected && (
                              <>
                                {' · answer: '}
                                <span className="text-arabic text-leaf-400" lang="ar">
                                  {item.expected}
                                </span>
                              </>
                            )}
                          </p>
                        )}

                        {item.explanation && (
                          <p className="mt-2 text-sm text-ground-400" dir="auto">
                            {item.explanation}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              )}

              {/* Topic practice from the derived bank, where a defensible mapping
                * exists. Three lessons have none — definiteness, predication and
                * negation are not things the corpus annotates — and those simply show
                * no link rather than a drill that looks related and is not. */}
              {(() => {
                const practice = practiceHref(lesson.id, lesson.level);
                return practice ? (
                  <p className="mb-4 text-sm text-ground-300">
                    Practise this topic against the corpus:{' '}
                    <Link href={practice.href} className="text-gold-400 hover:underline">
                      {practice.label}
                    </Link>
                  </p>
                ) : null;
              })()}

              <div className="flex flex-wrap items-center justify-center gap-3">
                {result.completed ? (
                  <Button onClick={handleNextLesson}>Next Lesson</Button>
                ) : (
                  <>
                    {/* Retrying the SAME lesson is the point when you have just been
                      * told what you got wrong. The only button used to skip to the
                      * next one, which is the opposite of what a failed attempt calls
                      * for. */}
                    <Button
                      onClick={() => {
                        setResult(null);
                        setAnswers({});
                        setCurrentExerciseIndex(0);
                      }}
                    >
                      Try this lesson again
                    </Button>
                    <Button variant="secondary" onClick={fetchNextLesson}>
                      Skip to next lesson
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Exercise View */
            <div className="space-y-6">
              <div className="text-lg">
                {lesson.exercises[currentExerciseIndex].question}
              </div>

              {/* Multiple Choice */}
              {lesson.exercises[currentExerciseIndex].type === 'multiple_choice' &&
                lesson.exercises[currentExerciseIndex].options && (
                  <div className="space-y-3">
                    {lesson.exercises[currentExerciseIndex].options.map(
                      (option, i) => (
                        <button
                          key={i}
                          onClick={() => handleAnswer(currentExerciseIndex, i)}
                          className={`w-full rounded-md border p-4 text-left transition-colors ${
                            answers[currentExerciseIndex] === i
                              ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                              : 'border-ground-700 hover:border-ground-600 hover:bg-ground-800'
                          }`}
                        >
                          {option}
                        </button>
                      )
                    )}
                  </div>
                )}

              {/* Fill in Blank */}
              {lesson.exercises[currentExerciseIndex].type === 'fill_blank' && (
                <Input
                  dir="auto"
                  value={String(answers[currentExerciseIndex] ?? '')}
                  onChange={(e) => handleAnswer(currentExerciseIndex, e.target.value)}
                  placeholder="Type your answer"
                  aria-label="Your answer"
                />
              )}

              {/* Match
                *
                * This used to print each item beside its own answer and record
                * nothing — a reference table labelled as a question. Since "Next
                * exercise" is disabled until an answer exists, and grammar-02 opens
                * with a match, that lesson could not be advanced past exercise one.
                *
                * Now it asks. Each item gets a picker over the same set of answers,
                * sorted alphabetically rather than shuffled: a stable order means the
                * options do not jump around as you choose, and for three English
                * glosses alphabetical order gives nothing away. */}
              {lesson.exercises[currentExerciseIndex].type === 'match' &&
                lesson.exercises[currentExerciseIndex].pairs && (
                  <div className="space-y-3">
                    {lesson.exercises[currentExerciseIndex].pairs!.map((pair, i) => {
                      const pairs = lesson.exercises[currentExerciseIndex].pairs!;
                      const choices = [...pairs.map((p) => p.answer)].sort();
                      // Selections travel as a JSON array in pair order, which is what
                      // the server grades against.
                      let current: string[] = [];
                      try {
                        const raw = answers[currentExerciseIndex];
                        current = typeof raw === 'string' && raw ? JSON.parse(raw) : [];
                      } catch {
                        current = [];
                      }
                      return (
                        <div
                          key={i}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-ground-700 p-3"
                        >
                          <span
                            className="text-arabic min-w-24 text-lg"
                            dir="rtl"
                            lang="ar"
                          >
                            {pair.item}
                          </span>
                          <span className="text-ground-400" aria-hidden="true">
                            →
                          </span>
                          <select
                            aria-label={`Meaning of ${pair.item}`}
                            value={current[i] ?? ''}
                            onChange={(e) => {
                              const next = [...current];
                              next[i] = e.target.value;
                              // Padded to full length so a partially answered match
                              // still serialises as an array the server can compare.
                              for (let k = 0; k < pairs.length; k += 1) {
                                next[k] = next[k] ?? '';
                              }
                              handleAnswer(currentExerciseIndex, JSON.stringify(next));
                            }}
                            className="min-h-11 flex-1 rounded-md border border-ground-700 bg-ground-900 px-3 text-sm"
                          >
                            <option value="">Choose…</option>
                            {choices.map((choice) => (
                              <option key={choice} value={choice}>
                                {choice}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* Advance through the exercises, then grade the lot. The
                * index was previously never incremented, so only the first
                * exercise was ever reachable. */}
              <div className="flex items-center gap-3">
                {isLastExercise ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!isAnswered(currentExerciseIndex)}
                  >
                    Finish lesson
                  </Button>
                ) : (
                  <Button
                    onClick={() => setCurrentExerciseIndex((i) => i + 1)}
                    disabled={!isAnswered(currentExerciseIndex)}
                  >
                    Next exercise
                  </Button>
                )}
                {currentExerciseIndex > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentExerciseIndex((i) => i - 1)}
                  >
                    Back
                  </Button>
                )}
                <span className="ml-auto text-sm text-ground-400">
                  {gradable.length} graded
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
