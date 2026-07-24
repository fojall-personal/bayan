'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string;
  goal: string;
  onboarding_completed: boolean;
  current_path: string;
  created_at: string;
}

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/profile', {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || 'dev-token'}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          setError('Authentication required. Set NEXT_PUBLIC_API_TOKEN in your environment.');
          setLoading(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.data) {
          setUser(data.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to connect to API server.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-gray-400 text-sm">
            For development, set <code className="bg-gray-800 px-2 py-1 rounded">NEXT_PUBLIC_API_TOKEN</code> to match your Workers API_TOKEN.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-transition">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-400 mt-2">
            {user?.onboarding_completed
              ? 'Welcome back!'
              : 'Welcome to Language Builder — complete your assessment to get started.'}
          </p>
        </div>
      </div>

      {!user?.onboarding_completed && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-3">Get Started</h2>
          <p className="text-gray-400 mb-4">
            Take a diagnostic assessment to determine your current level and create a personalized learning path.
          </p>
          <a
            href="/assessment"
            className="inline-block bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors"
          >
            Start Assessment
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-1">Next Lesson</h3>
          <p className="text-2xl font-bold">Arabic Alphabet</p>
          <p className="text-sm text-gray-500 mt-1">Letter Recognition</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-1">Memorization</h3>
          <p className="text-2xl font-bold">0</p>
          <p className="text-sm text-gray-500 mt-1">Surahs in progress</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm text-gray-400 mb-1">Current Path</h3>
          <p className="text-2xl font-bold capitalize">{user?.current_path || '—'}</p>
          <p className="text-sm text-gray-500 mt-1">Based on assessment</p>
        </div>
      </div>
    </div>
  );
}
