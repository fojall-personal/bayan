'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';

interface WordData {
  word: string;
  transliteration: string | null;
  meaning: string;
  root: string | null;
  partOfSpeech: string | null;
  frequencyRank: number;
  mastery: { correctAttempts: number; totalAttempts: number; masteryLevel: number };
}

interface WordDetailProps {
  word: string;
  onBack: () => void;
}

const POS_LABELS: Record<string, string> = {
  V: 'verb', N: 'noun', ADJ: 'adjective', PN: 'proper noun', P: 'preposition', PRON: 'pronoun',
};

/**
 * Expanded view for a single unrooted word (function words: مِن, فِي, عَلَى, etc.).
 *
 * Fetches from /api/vocabulary/word/:word. No family/corpus section here —
 * function words carry no root, so there is nothing to show beyond the word
 * itself and its mastery. Mirrors RootFamilyDetail's shape so the two feel
 * like the same feature, not a second one bolted on.
 */
export function WordDetail({ word, onBack }: WordDetailProps) {
  const [data, setData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: WordData }>(`/api/vocabulary/word/${encodeURIComponent(word)}`);
      setData(res.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load word');
    } finally {
      setLoading(false);
    }
  }, [word]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="py-12 text-center text-ground-400">Loading word...</div>;
  if (error) return <div className="py-12 text-center"><p className="text-error text-sm">{error}</p><Button onClick={onBack} variant="secondary" size="sm" className="mt-4">Go back</Button></div>;
  if (!data) return <div className="py-12 text-center text-ground-400">No data available for this word.</div>;

  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="ghost" size="sm" aria-label="Back to all roots">← Back to all roots</Button>

      <div className="rounded-lg border border-ground-800 p-6 bg-ground-900 text-center space-y-2">
        <div
          className="text-5xl font-arabic text-gold-400"
          dir="rtl"
          style={{
            fontFamily: 'var(--font-arabic)',
            lineHeight: 'var(--leading-arabic)',
            fontFeatureSettings: 'liga 1, calt 1',
            fontVariantLigatures: 'contextual',
          }}
        >
          {data.word}
        </div>
        <p className="text-ground-300 text-lg" style={{ fontFamily: 'var(--font-naskh)' }}>
          {data.meaning}
        </p>
        {data.transliteration && (
          <p className="text-ground-400 text-sm">{data.transliteration}</p>
        )}
        <div className="flex items-center justify-center gap-4 text-sm text-ground-400">
          <span>{POS_LABELS[data.partOfSpeech ?? ''] || data.partOfSpeech || 'function word'}</span>
          <span>•</span>
          <span>
            Mastery: {data.mastery.masteryLevel}/5 ({data.mastery.correctAttempts}/{data.mastery.totalAttempts} correct)
          </span>
        </div>
      </div>
    </div>
  );
}
