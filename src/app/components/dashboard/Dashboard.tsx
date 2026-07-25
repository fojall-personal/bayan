'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/dashboard/StatCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Onboarding } from '@/components/onboarding/Onboarding';

interface DashboardData {
  user: {
    id: string;
    goal: string;
    onboarding_completed: boolean;
    current_path: string;
    created_at: string;
  };
  latestAssessment: {
    literacy_score: number;
    comprehension_score: number;
    grammar_score: number;
    memorization_score: number;
    details: { paths: Record<string, { name: string; description: string }> };
  } | null;
  todayReview: Array<{
    id: string;
    surah_id: number;
    ayah_from: number;
    ayah_to: number;
    status: string;
  }>;
  streak: number;
  stats: {
    totalLessons: number;
    completedLessons: number;
    memorizedSurahs: number;
    vocabularyReviewed: number;
  };
  weeklyProgress: {
    lessonsCompleted: number;
    reviewsCompleted: number;
    targetLessons: number;
    targetReviews: number;
  };
  lastLesson: { lesson_id: string; score: number } | null;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch('/api/progress/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!data || !data.user.onboarding_completed) {
    return <Onboarding onComplete={() => fetchDashboard()} />;
  }

  const pathName = data.latestAssessment?.details?.paths?.[data.user.current_path];

  return (
    <div className="page-transition space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome back!</h1>
          <p className="text-gray-400 mt-1">
            {pathName ? `Path: ${pathName.name}` : 'Your personalized learning path'}
          </p>
        </div>
        {data.streak > 0 && (
          <div className="flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-full">
            <span className="text-xl">🔥</span>
            <span className="font-bold">{data.streak} day streak</span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="/learning" className="p-4 bg-green-500/10 border border-green-500 rounded-lg hover:bg-green-500/20 transition-colors">
          <div className="text-2xl mb-2">📖</div>
          <div className="font-semibold">Continue Lesson</div>
          <div className="text-sm text-gray-400">Grammar-05 (20 min)</div>
        </a>
        <a href="/memorization" className="p-4 bg-blue-500/10 border border-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors">
          <div className="text-2xl mb-2">🕌</div>
          <div className="font-semibold">Memorization Review</div>
          <div className="text-sm text-gray-400">{data.todayReview.length} ayahs due</div>
        </a>
        <a href="/assessment" className="p-4 bg-purple-500/10 border border-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors">
          <div className="text-2xl mb-2">📝</div>
          <div className="font-semibold">Quick Quiz</div>
          <div className="text-sm text-gray-400">Test your knowledge</div>
        </a>
      </div>

      {/* Progress overview */}
      {data.latestAssessment && (
        <Card>
          <h2 className="text-xl font-bold mb-4">Progress Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ModuleProgress label="Literacy" score={data.latestAssessment.literacy_score} color="green" />
            <ModuleProgress label="Comprehension" score={data.latestAssessment.comprehension_score} color="blue" />
            <ModuleProgress label="Grammar" score={data.latestAssessment.grammar_score} color="purple" />
            <ModuleProgress label="Memorization" score={data.latestAssessment.memorization_score} color="orange" />
          </div>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Lessons Complete"
          value={`${data.stats.completedLessons}/${data.stats.totalLessons}`}
        />
        <StatCard
          label="Surahs Memorized"
          value={data.stats.memorizedSurahs.toString()}
        />
        <StatCard
          label="Words Reviewed"
          value={data.stats.vocabularyReviewed.toString()}
        />
        <StatCard
          label="This Week"
          value={`${data.weeklyProgress.lessonsCompleted}/${data.weeklyProgress.targetLessons}`}
        />
      </div>

      {/* Weekly progress */}
      <Card>
        <h2 className="text-xl font-bold mb-4">This Week</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <WeeklyStat
            label="Lessons"
            current={data.weeklyProgress.lessonsCompleted}
            target={data.weeklyProgress.targetLessons}
          />
          <WeeklyStat
            label="Reviews"
            current={data.weeklyProgress.reviewsCompleted}
            target={data.weeklyProgress.targetReviews}
          />
        </div>
      </Card>
    </div>
  );
}

function ModuleProgress({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-bold">{score}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorMap[color] || 'bg-green-500'} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function WeeklyStat({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{current}</span>
        <span className="text-gray-500">/ {target}</span>
      </div>
      <ProgressBar progress={percentage} />
    </div>
  );
}
