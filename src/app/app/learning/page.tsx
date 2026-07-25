'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LearningPage } from '@/components/learning/LearningPage';
import { Flashcards } from '@/components/learning/Flashcards';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiErrorMessage } from '@/lib/api';

const PATH_NAMES: Record<string, string> = {
  path1: 'Complete Beginner',
  path2: 'Conversational Speaker',
  path3: 'Advanced Reader',
};

export default function LearningPageRoute() {
  const [view, setView] = useState<'lesson' | 'flashcards'>('lesson');
  const [user, setUser] = useState<{ id: string; current_path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const data = await apiFetch<{ data: { id: string; current_path: string } }>(
        '/api/auth/profile'
      );
      setUser(data.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-3">Couldn&apos;t load your profile</h2>
        <p className="text-gray-400 mb-6">{error ?? 'No profile found for this account.'}</p>
        <Button onClick={fetchUserProfile}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Learning"
        subtitle="Your personalized learning path"
        actions={
          <div className="flex gap-2">
            <Button
              variant={view === 'lesson' ? 'primary' : 'secondary'}
              onClick={() => setView('lesson')}
            >
              Lessons
            </Button>
            <Button
              variant={view === 'flashcards' ? 'primary' : 'secondary'}
              onClick={() => setView('flashcards')}
            >
              Flashcards
            </Button>
          </div>
        }
      />

      {user?.current_path && (
        <Card className="mb-8" flush>
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-label text-gold-400">
                Your path
              </div>
              {/* `capitalize` was title-casing the whole sentence, and the label
                * read "Path path2". Map the stored id to its real name. */}
              <div className="mt-1.5 font-display text-lg text-ground-50">
                {PATH_NAMES[user.current_path] ?? 'Personalised path'}
              </div>
            </div>
            <p className="text-sm text-ground-400">Continue where you left off</p>
          </div>
        </Card>
      )}

      {view === 'lesson' && user && <LearningPage userId={user.id} />}
      {view === 'flashcards' && user && <Flashcards userId={user.id} />}
    </div>
  );
}
