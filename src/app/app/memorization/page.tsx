'use client';

import Link from 'next/link';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { SurahProgress } from '@/components/memorization/SurahProgress';
import { ReviewSession } from '@/components/memorization/ReviewSession';
import { AddAyahForm } from '@/components/memorization/AddAyahForm';
import { CurriculumPicker } from '@/components/memorization/CurriculumPicker';
import { RetentionSettings } from '@/components/memorization/RetentionSettings';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { getSurah, ayahCountFor } from '@/lib/surahs';

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
  const [view, setView] = useState<'surahs' | 'curriculum' | 'review'>('surahs');
  const [surahs, setSurahs] = useState<SurahSummary[]>([]);
  const [dueEntries, setDueEntries] = useState<MemorizationEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<MemorizationEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'surahs') {
      fetchSurahs();
    } else if (view === 'review') {
      fetchTodayReview();
    } else {
      // The curriculum view loads its own data. Without this the page-level
      // `loading` flag would stay true and blank the whole tab.
      setLoading(false);
    }
  }, [view]);

  /**
   * `silent` refreshes without the full-page spinner.
   *
   * The page early-returns a "Loading…" screen whenever `loading` is true, which
   * unmounts everything below it. After adding an ayah that meant the form — and
   * its "Added …" confirmation — vanished instantly, so the one feature whose
   * complaint was "no way to tell it worked" still gave no feedback.
   */
  const fetchSurahs = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<{ data: SurahSummary[] }>('/api/memorization/surahs');
      setSurahs(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch surahs:', err);
      setError(apiErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchTodayReview = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: MemorizationEntry[] }>(
        '/api/memorization/review/today'
      );
      setDueEntries(data.data || []);
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
        {/* Skip and Complete both exit back to the list, but each carries an SRS
            side effect (skip still advances scheduling). This is the neutral
            third option: changed your mind about which entry to review, no
            scheduling consequence, no need to type through Skip to get it. */}
        <button
          type="button"
          onClick={() => setCurrentEntry(null)}
          className="mb-6 inline-flex items-center gap-1 text-sm text-ground-400 transition-colors hover:text-gold-400"
        >
          ← Back to Due Today
        </button>
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
          <Tabs
            label="Memorization views"
            value={view}
            onChange={setView}
            items={[
              { id: 'surahs', label: 'Surahs' },
              { id: 'curriculum', label: 'Curriculum' },
              { id: 'review', label: 'Due today' },
            ]}
          />
        }
      />

      {view === 'surahs' && (
        <div className="space-y-6">
          <AddAyahForm onAdded={() => fetchSurahs({ silent: true })} />

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

          {/* Surah list. Empty until something is added — which was impossible
              before AddAyahForm existed. */}
          {surahs.length === 0 ? (
            <Card className="text-center py-12">
              <h2 className="text-xl font-bold mb-2">Nothing tracked yet</h2>
              <p className="text-gray-400">
                Add an ayah above to start a memorization schedule.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {surahs.map((surah) => (
                <SurahProgress
                  key={surah.surah_id}
                  surahId={surah.surah_id as number}
                  surahName={getSurah(surah.surah_id as number)?.name ?? `Surah ${surah.surah_id}`}
                  totalAyahs={ayahCountFor(surah.surah_id as number)}
                />
              ))}
            </div>
          )}

          <RetentionSettings />
        </div>
      )}

      {view === 'curriculum' && (
        <CurriculumPicker onAdded={() => fetchSurahs({ silent: true })} />
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
      {/* /advanced holds the audio testing, cross-references and certificate
          export. It was absent from every nav and every in-page link, so the only
          way to reach it was to type the URL. It is memorization tooling, so it
          belongs here rather than in a drawer called "Advanced". */}
      <div className="mt-8 border-t border-ground-800 pt-6">
        <Link
          href="/advanced"
          className="text-sm text-gold-400 underline-offset-4 hover:underline"
        >
          Advanced tools — audio testing, cross-references, certificate export →
        </Link>
      </div>

    </div>
  );
}
