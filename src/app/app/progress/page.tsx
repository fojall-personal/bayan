'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { apiFetch, apiErrorMessage } from '@/lib/api';

interface ScoreEntry {
  literacy_score: number;
  comprehension_score: number;
  grammar_score: number;
  memorization_score: number;
  completed_at: string;
}

export default function ProgressPage() {
  const [scores, setScores] = useState<ScoreEntry[]>([]);
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

      <Card>
        <h2 className="text-xl font-bold mb-4">Score History</h2>
        {scores.length === 0 ? (
          <div>
            <p className="text-gray-400 mb-4">
              No assessment data yet. Take the diagnostic assessment to get started.
            </p>
            <Link href="/assessment" className="inline-block text-gold-400 hover:text-gold-400 font-medium">
              Take Diagnostic Assessment →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scores.map((score, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="text-sm text-gray-400 w-24 shrink-0">
                  {new Date(score.completed_at).toLocaleDateString()}
                </div>
                <div className="flex-1 grid grid-cols-4 gap-2">
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
        <WeeklyCalendar />
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

function WeeklyCalendar() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const isToday = date.toDateString() === today.toDateString();

        return (
          <div
            key={day}
            className={`p-3 rounded-lg text-center ${
              isToday
                ? 'bg-leaf-500/20 border border-leaf-500'
                : 'bg-gray-800'
            }`}
          >
            <div className="text-sm text-gray-400">{day}</div>
            <div className="text-lg font-bold">{date.getDate()}</div>
          </div>
        );
      })}
    </div>
  );
}
