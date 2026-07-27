'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';

interface ScoreEntry {
  literacy_score: number;
  comprehension_score: number;
  grammar_score: number;
  memorization_score: number;
  completed_at: string;
}

/** One row of GET /api/grammar/mastery. */
interface MasteryEntry {
  category: string;
  masteryLevel: number;
  totalAttempts: number;
  correctAttempts: number;
  percentage: number;
}

/**
 * Human labels for the seven exercise kinds the derived bank actually contains.
 *
 * Mirrors the list in ExerciseRunner so both screens name a kind the same way. The
 * raw values are database enums — `case_ending`, `pos_id` — and showing those to a
 * learner would be leaking a column name into the UI.
 */
const KIND_LABELS: Record<string, string> = {
  word_meaning: 'Word meaning',
  find_word: 'Find the word in an ayah',
  verb_form: 'Verb form (I–XII)',
  case_ending: "Case ending (i'rab)",
  root_id: 'Root identification',
  pos_id: 'Part of speech',
  aspect: 'Verb aspect',
  // Lesson-driven attempts record their module instead of a bank kind.
  grammar: 'Lesson exercises — grammar',
  tajweed: 'Lesson exercises — tajweed',
  literacy: 'Lesson exercises — literacy',
};

export default function ProgressPage() {
  const router = useRouter();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [mastery, setMastery] = useState<MasteryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScores();
  }, []);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: ScoreEntry[] }>('/api/progress/scores');
      setScores(data.data || []);
      setError(null);
      // Separate try: grammar mastery is additive, and failing to load it should not
      // blank out the score history that did load.
      try {
        const m = await apiFetch<{ data: MasteryEntry[] }>('/api/grammar/mastery');
        setMastery(m.data || []);
      } catch {
        setMastery([]);
      }
    } catch (err) {
      console.error('Failed to fetch scores:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading progress...</div>
      </div>
    );
  }

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6">
      {/* Score history */}
      {error && (
        <Card>
          <h2 className="text-xl font-bold mb-2">Couldn&apos;t load your progress</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchScores}
            className="text-gold-400 hover:text-gold-400 font-medium"
          >
            Try again
          </button>
        </Card>
      )}

      {/* Grammar by exercise type.
          
          Nothing showed this before, because nothing recorded it: the runner kept
          the score in local state and POST /api/grammar/exercise had no caller, so
          4,950 exercises produced no durable result. Only attempted kinds appear —
          an untouched kind is not a weakness, and listing all seven would imply
          measurements that were never taken. */}
      {mastery.length > 0 && (
        <Card>
          <h2 className="mb-4 text-xl font-bold">Grammar by exercise type</h2>
          <div className="space-y-3">
            {[...mastery]
              .sort((a, b) => a.percentage - b.percentage)
              .map((m) => (
                <div key={m.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span>{KIND_LABELS[m.category] ?? m.category}</span>
                    {/* Raw counts beside the percentage: "3 of 3 · 100%" reads very
                        differently from "47 of 52 · 90%". */}
                    <span className="text-ground-400">
                      {m.correctAttempts} of {m.totalAttempts} · {m.percentage}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-ground-800"
                    role="progressbar"
                    aria-valuenow={m.percentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={KIND_LABELS[m.category] ?? m.category}
                  >
                    <div
                      className={`h-full rounded-full ${
                        m.percentage >= 80
                          ? 'bg-leaf-500'
                          : m.percentage >= 50
                            ? 'bg-gold-500'
                            : 'bg-error'
                      }`}
                      style={{ width: `${m.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
          <p className="mt-4 text-xs text-ground-400">
            Only types you have attempted appear. Practise more in{' '}
            <Link href="/grammar" className="text-gold-400 hover:underline">
              Grammar
            </Link>
            .
          </p>
        </Card>
      )}

      <Card>
        <h2 className="text-xl font-bold mb-4">Score History</h2>
        {scores.length === 0 ? (
          <EmptyState
            title="No scores yet"
            description="The placement assessment sets your starting level and the path that follows from it. It takes about fifteen minutes."
            action={{
              label: 'Take the assessment',
              // router.push rather than window.location.href, which threw away
              // the loaded app and reloaded the whole document.
              onClick: () => router.push('/assessment'),
            }}
          />
        ) : (
          <div className="space-y-4">
            {scores.map((score, i) => (
              <div key={i} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="shrink-0 text-sm text-ground-400 sm:w-24">
                  {new Date(score.completed_at).toLocaleDateString()}
                </div>
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-2">
                  <ScoreBar
                    label="Literacy"
                    value={score.literacy_score}
                    max={100}
                    color="bg-leaf-500"
                  />
                  <ScoreBar
                    label="Grammar"
                    value={score.grammar_score}
                    max={100}
                    color="bg-tajweed-makharij"
                  />
                  <ScoreBar
                    label="Comprehension"
                    value={score.comprehension_score}
                    max={100}
                    color="bg-info"
                  />
                  <ScoreBar
                    label="Memorization"
                    value={score.memorization_score}
                    max={100}
                    color="bg-tajweed-qalqalah"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Weekly calendar */}
      <Card>
        <h2 className="text-xl font-bold mb-4">This Week</h2>
        <WeeklyCalendar activeDates={scores.map((s) => s.completed_at)} />
      </Card>
    </div>
  );
}

function ScoreBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The week, marked with days that actually had activity.
 *
 * This previously rendered seven date boxes and nothing else — real dates, but no
 * information, so it looked like a streak tracker that never tracked anything.
 * Assessment completion dates are the one activity signal already fetched by this
 * page, so it uses those rather than adding a request.
 */
function WeeklyCalendar({ activeDates }: { activeDates: string[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const startOfWeek = new Date(today);
  // getDay() is 0 for Sunday, so a plain -getDay()+1 lands on the NEXT Monday
  // when today is Sunday. Treat Sunday as day 7.
  const offset = today.getDay() === 0 ? 6 : today.getDay() - 1;
  startOfWeek.setDate(today.getDate() - offset);

  const active = new Set(activeDates.map((d) => new Date(d).toDateString()));

  return (
    <>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day, i) => {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          const isToday = date.toDateString() === today.toDateString();
          const wasActive = active.has(date.toDateString());
          const future = date > today;

          return (
            <div
              key={day}
              aria-label={`${day} ${date.getDate()}${wasActive ? ', activity recorded' : ''}`}
              className={`p-3 rounded-lg text-center border ${
                isToday
                  ? 'bg-leaf-500/20 border-leaf-500'
                  : wasActive
                    ? 'bg-leaf-500/10 border-leaf-600'
                    : future
                      ? 'bg-gray-800/40 border-transparent'
                      : 'bg-gray-800 border-transparent'
              }`}
            >
              <div className="text-sm text-gray-400">{day}</div>
              <div className={`text-lg font-bold ${future ? 'text-gray-600' : ''}`}>
                {date.getDate()}
              </div>
              {/* A dot only where something happened, so an empty week reads as
                  empty rather than as un-implemented. */}
              <div
                className={`mt-1 h-1.5 w-1.5 mx-auto rounded-full ${
                  wasActive ? 'bg-leaf-400' : 'bg-transparent'
                }`}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        {activeDates.length === 0
          ? 'No assessment activity recorded yet — days will fill in as you go.'
          : 'Marked days are ones with a recorded assessment.'}
      </p>
    </>
  );
}
