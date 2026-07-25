'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

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

export function LearningPage({ userId }: LearningPageProps) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; correct: number; total: number; completed: boolean } | null>(null);

  useEffect(() => {
    fetchNextLesson();
  }, []);

  const fetchNextLesson = async () => {
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch('/api/learning/next', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch lesson');
      }

      const data = await res.json();
      if (data.lesson) {
        setLesson(data.lesson);
        setResult(null);
      } else {
        setError(data.message || 'No more lessons available');
      }
    } catch (err) {
      setError('Failed to load lesson. Check API connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (exerciseIndex: number, answer: string) => {
    setAnswers((prev) => ({
      ...prev,
      [exerciseIndex]: answer,
    }));
  };

  const handleSubmit = async () => {
    if (!lesson) return;

    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch(`/api/learning/lessons/${lesson.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([k, v]) => ({ index: Number(k), answer: v })),
          exerciseIndex: currentExerciseIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.data);
      }
    } catch (err) {
      console.error('Failed to submit:', err);
    }
  };

  const handleNextLesson = () => {
    setLesson(null);
    setResult(null);
    setAnswers({});
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
        progress={((currentExerciseIndex + 1) / lesson.exercises.length) * 100}
        label="Exercise Progress"
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
                <div className="text-2xl text-arabic mb-2" dir="rtl">
                  {example.arabic}
                </div>
                <div className="text-sm text-gray-400 mb-1">
                  {example.transliteration}
                </div>
                <div className="text-sm text-gray-300">
                  {example.meaning}
                </div>
                {example.rule && (
                  <div className="text-xs text-primary-400 mt-2">
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
                <h3 className="font-semibold text-primary-400 mb-2">
                  {rule.name}
                </h3>
                <p className="text-gray-300 text-sm mb-2">{rule.description}</p>
                {rule.letters && (
                  <div className="text-sm text-gray-400 mb-2">
                    Letters: <span className="text-arabic text-lg" dir="rtl">{rule.letters}</span>
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
              <div className="text-gray-400 mb-6">
                {result.correct} of {result.total} correct
              </div>
              {result.completed ? (
                <Button onClick={handleNextLesson}>Next Lesson</Button>
              ) : (
                <Button variant="secondary" onClick={fetchNextLesson}>
                  Try Next Lesson
                </Button>
              )}
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
                          onClick={() =>
                            handleAnswer(currentExerciseIndex, option)
                          }
                          className={`w-full p-4 text-left rounded-lg border transition-all ${
                            answers[currentExerciseIndex] === option
                              ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                              : 'border-gray-700 hover:border-gray-600'
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
                <div>
                  <input
                    type="text"
                    value={answers[currentExerciseIndex] || ''}
                    onChange={(e) =>
                      handleAnswer(currentExerciseIndex, e.target.value)
                    }
                    placeholder="Type your answer..."
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                  />
                </div>
              )}

              {/* Match */}
              {lesson.exercises[currentExerciseIndex].type === 'match' &&
                lesson.exercises[currentExerciseIndex].pairs && (
                  <div className="space-y-3">
                    {lesson.exercises[currentExerciseIndex].pairs.map(
                      (pair, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                        >
                          <span className="text-arabic text-lg" dir="rtl">
                            {pair.item}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-300">
                            {pair.answer}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                )}

              {/* Submit Button */}
              <Button onClick={handleSubmit} disabled={!answers[currentExerciseIndex]}>
                Check Answer
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
