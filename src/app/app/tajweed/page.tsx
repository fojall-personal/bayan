'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { TajweedViewer } from '@/components/tajweed/TajweedViewer';
import { MakharijDiagram } from '@/components/tajweed/MakharijDiagram';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch, apiErrorMessage } from '@/lib/api';

interface TajweedRule {
  id: string;
  name: string;
  color: string;
  colorName: string;
  totalAttempts: number;
  correct: number;
  masteryPercentage: number;
}

export default function TajweedPage() {
  const [view, setView] = useState<'viewer' | 'makharij' | 'mastery'>('viewer');
  const [rules, setRules] = useState<TajweedRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
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
        subtitle="Color-coded Quran text with rule visualization"
        actions={
          <div className="flex gap-2">
            <Button
              variant={view === 'viewer' ? 'primary' : 'secondary'}
              onClick={() => setView('viewer')}
            >
              Viewer
            </Button>
            <Button
              variant={view === 'makharij' ? 'primary' : 'secondary'}
              onClick={() => setView('makharij')}
            >
              Makharij
            </Button>
            <Button
              variant={view === 'mastery' ? 'primary' : 'secondary'}
              onClick={() => setView('mastery')}
            >
              Mastery
            </Button>
          </div>
        }
      />

      {view === 'viewer' && (
        <div>
          {/* Placeholder — would load surah data from API */}
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Tajweed Viewer</h2>
            <p className="text-gray-400 mb-6">
              Select a surah to view color-coded text with tajweed rule highlights.
              Hover over the legend to highlight all instances of a rule.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {rules.length > 0 ? (
                rules.map((rule) => (
                  <Badge key={rule.id} variant="default" className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: rule.color }}
                    />
                    {rule.name}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Tajweed data will be loaded from the Quran API.
                </p>
              )}
            </div>
          </Card>
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
