'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  TajweedViewer,
  type TajweedLegendEntry,
} from '@/components/tajweed/TajweedViewer';
import { MakharijDiagram } from '@/components/tajweed/MakharijDiagram';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { Tabs } from '@/components/ui/Tabs';
import { SURAHS, getSurah } from '@/lib/surahs';

interface TajweedRule {
  id: string;
  name: string;
  color: string;
  colorName: string;
  totalAttempts: number;
  correct: number;
  masteryPercentage: number;
}

interface TajweedVerse {
  surah: number;
  ayah: number;
  text_uthmani: string;
  text_simple: string;
  tajweed_tags: {
    start: number;
    end: number;
    rule: string;
    color: string | null;
    category: string | null;
    categoryName: string | null;
  }[];
}

export default function TajweedPage() {
  const [view, setView] = useState<'viewer' | 'makharij' | 'mastery'>('viewer');
  const [rules, setRules] = useState<TajweedRule[]>([]);
  // Was initialised true while the fetch only runs for the mastery tab, so the
  // default Reader view showed "Loading..." permanently and the page was
  // effectively unreachable.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [surahId, setSurahId] = useState(1);
  const [verses, setVerses] = useState<TajweedVerse[]>([]);
  const [legend, setLegend] = useState<TajweedLegendEntry[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);
  const [versesError, setVersesError] = useState<string | null>(null);

  const surahName = getSurah(surahId)?.name ?? `Surah ${surahId}`;

  const fetchVerses = useCallback(async () => {
    setVersesLoading(true);
    setVersesError(null);
    try {
      // surahId is no longer echoed back — it is already in the request path.
      const { data } = await apiFetch<{
        data: { verses: TajweedVerse[]; legend?: TajweedLegendEntry[] };
      }>(`/api/tajweed/verses/${surahId}`);
      setVerses(data.verses ?? []);
      setLegend(data.legend ?? []);
    } catch (err) {
      console.error('Failed to fetch tajweed verses:', err);
      setVersesError(apiErrorMessage(err));
      setVerses([]);
      setLegend([]);
    } finally {
      setVersesLoading(false);
    }
  }, [surahId]);

  useEffect(() => {
    if (view === 'viewer') fetchVerses();
  }, [view, fetchVerses]);

  useEffect(() => {
    if (view === 'mastery') {
      fetchMastery();
    }
  }, [view]);

  const fetchMastery = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ data: TajweedRule[] }>('/api/tajweed/mastery');
      setRules(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch mastery:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading && view === 'mastery') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-2">Couldn&apos;t load tajweed mastery</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button variant="secondary" onClick={fetchMastery}>Try again</Button>
        </Card>
      )}

      <PageHeader
        title="Tajweed"
        subtitle="A whole surah, colour-coded — for reciting through. For one ayah in depth, use Read."
        actions={
          <Tabs
            label="Tajweed views"
            value={view}
            onChange={setView}
            items={[
              { id: 'viewer', label: 'Reader' },
              { id: 'makharij', label: 'Makharij' },
              { id: 'mastery', label: 'Mastery' },
            ]}
          />
        }
      />

      {view === 'viewer' && (
        <div className="space-y-6">
          <Card>
            <Select
              label="Surah"
              value={String(surahId)}
              onChange={(value) => setSurahId(Number(value))}
              options={SURAHS.map((s) => ({
                value: String(s.id),
                label: `${s.id}. ${s.name} — ${s.translation} (${s.ayahCount} ayah${s.ayahCount === 1 ? '' : 's'})`,
              }))}
            />
          </Card>

          {versesLoading && (
            <Card className="text-center py-12">
              <p className="text-gray-400">Loading surah…</p>
            </Card>
          )}

          {!versesLoading && versesError && (
            <Card>
              <h2 className="text-lg font-bold mb-2">Couldn&apos;t load this surah</h2>
              <p className="text-gray-400 mb-4">{versesError}</p>
              <Button variant="secondary" onClick={fetchVerses}>
                Try again
              </Button>
            </Card>
          )}

          {/* An empty result is honest rather than broken: the ingest leaves
              quran_verses empty unless the pinned text has been loaded. */}
          {!versesLoading && !versesError && verses.length === 0 && (
            <Card className="text-center py-12">
              <h2 className="text-xl font-bold mb-2">No text loaded</h2>
              <p className="text-gray-400">
                The Quran text has not been ingested for this deployment yet.
              </p>
            </Card>
          )}

          {!versesLoading && !versesError && verses.length > 0 && (
            <TajweedViewer
              surahId={surahId}
              surahName={surahName}
              verses={verses}
              legend={legend}
            />
          )}
        </div>
      )}

      {view === 'makharij' && <MakharijDiagram />}

      {view === 'mastery' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card className="text-center py-12">
              <h2 className="text-2xl font-bold mb-4">No Practice Data</h2>
              <p className="text-gray-400">
                Practice tajweed rules to see your mastery progress here.
              </p>
            </Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: rule.color }}
                  />
                  <div>
                    <div className="font-semibold">{rule.name}</div>
                    <div className="text-sm text-gray-400">
                      {rule.totalAttempts} attempts · {rule.correct} correct
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{rule.masteryPercentage}%</div>
                  <div className="text-sm text-gray-400">mastery</div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
