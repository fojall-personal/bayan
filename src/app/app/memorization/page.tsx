'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SurahProgress } from '@/components/memorization/SurahProgress';
import { ReviewSession } from '@/components/memorization/ReviewSession';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch, apiErrorMessage } from '@/lib/api';

interface SurahSummary {
  surah_id: number;
  mastered: number;
  learning: number;
  reviewing: number;
  new_ayahs: number;
}

interface MemorizationEntry {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: string;
  next_review: string;
  quality: number;
  interval: number;
  ease_factor: number;
  revision_count: number;
  ayah_text?: string;
}

export default function MemorizationPage() {
  const [view, setView] = useState<'surahs' | 'review'>('surahs');
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [dueEntries, setDueEntries] = useState<MemorizationEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<MemorizationEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'surahs') {
      fetchSurahs();
    } else {
      fetchTodayReview();
    }
  }, [view]);

  const fetchSurahs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ surahs: SurahSummary[] }>('/api/memorization/surahs');
      setSurahs(data.surahs || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch surahs:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayReview = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ due: MemorizationEntry[] }>(
        '/api/memorization/review/today'
      );
      setDueEntries(data.due || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch today review:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = (entry: MemorizationEntry) => {
    setCurrentEntry(entry);
  };

  const handleReviewComplete = () => {
    setCurrentEntry(null);
    fetchTodayReview();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (currentEntry && view === 'review') {
    return (
      <div>
        <PageHeader title="Memorization Review" subtitle="Review your memorized ayahs" />
        <ReviewSession
          entry={currentEntry}
          onComplete={handleReviewComplete}
          onSkip={() => {
            setCurrentEntry(null);
            fetchTodayReview();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-2">Couldn&apos;t load your memorization data</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => (view === 'surahs' ? fetchSurahs() : fetchTodayReview())}>Try again</Button>
        </Card>
      )}

      <PageHeader
        title="Memorization"
        subtitle="Track your Quran memorization progress"
        actions={
          <div className="flex gap-2">
            <Button
              variant={view === 'surahs' ? 'primary' : 'secondary'}
              onClick={() => setView('surahs')}
            >
              Surahs
            </Button>
            <Button
              variant={view === 'review' ? 'primary' : 'secondary'}
              onClick={() => setView('review')}
            >
              Today's Review
            </Button>
          </div>
        }
      />

      {view === 'surahs' && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-leaf-400">
                  {surahs.reduce((sum, s) => sum + (s.mastered as number), 0)}
                </div>
                <div className="text-sm text-gray-400">Mastered</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gold-400">
                  {surahs.reduce((sum, s) => sum + (s.learning as number), 0)}
                </div>
                <div className="text-sm text-gray-400">Learning</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-info">
                  {surahs.reduce((sum, s) => sum + (s.reviewing as number), 0)}
                </div>
                <div className="text-sm text-gray-400">Reviewing</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-400">
                  {surahs.reduce((sum, s) => sum + (s.new_ayahs as number), 0)}
                </div>
                <div className="text-sm text-gray-400">New</div>
              </div>
            </div>
          </Card>

          {/* Surah list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surahs.map((surah) => (
              <SurahProgress
                key={surah.surah_id}
                surahId={surah.surah_id as number}
                surahName={`Surah ${surah.surah_id}`}
                totalAyahs={surah.mastered as number + (surah.learning as number) + (surah.reviewing as number) + (surah.new_ayahs as number)}
              />
            ))}
          </div>
        </div>
      )}

      {view === 'review' && (
        <div className="space-y-4">
          {dueEntries.length === 0 ? (
            <Card className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">All Caught Up!</h2>
              <p className="text-gray-400">No entries due for review today.</p>
            </Card>
          ) : (
            dueEntries.map((entry) => (
              <Card key={entry.id} className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold" dir="rtl">
                    {entry.ayah_text || `Surah ${entry.surah_id}`}
                  </div>
                  <div className="text-sm text-gray-400">
                    Ayahs {entry.ayah_from}-{entry.ayah_to}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Status: {entry.status} | Reviews: {entry.revision_count}
                  </div>
                </div>
                <Button onClick={() => handleStartReview(entry)}>
                  Review
                </Button>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
