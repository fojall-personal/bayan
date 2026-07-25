'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

interface MemorizationEntry {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: 'new' | 'learning' | 'reviewing' | 'mastered';
  next_review: string;
  quality: number;
  interval: number;
  ease_factor: number;
  revision_count: number;
}

interface SurahProgressProps {
  surahId: number;
  surahName: string;
  totalAyahs: number;
}

export function SurahProgress({ surahId, surahName, totalAyahs }: SurahProgressProps) {
  const [entries, setEntries] = useState<MemorizationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSurahProgress();
  }, [surahId]);

  const fetchSurahProgress = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ entries: MemorizationEntry[] }>(
        `/api/memorization/surah/${surahId}`
      );
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Failed to fetch surah progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center py-8 text-gray-400">Loading surah progress...</div>
      </Card>
    );
  }

  const masteredCount = entries.filter((e) => e.status === 'mastered').length;
  const learningCount = entries.filter((e) => e.status === 'learning').length;
  const reviewingCount = entries.filter((e) => e.status === 'reviewing').length;
  const percentage = totalAyahs > 0 ? (masteredCount / totalAyahs) * 100 : 0;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{surahName}</h2>
          <p className="text-gray-400 text-sm mt-1">Surah {surahId}</p>
        </div>
        <Badge variant={percentage >= 100 ? 'success' : percentage >= 50 ? 'warning' : 'default'}>
          {Math.round(percentage)}%
        </Badge>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>{masteredCount} / {totalAyahs} ayahs memorized</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <ProgressBar progress={percentage} tone="leaf" />
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 bg-leaf-500/10 rounded-lg">
          <div className="text-2xl font-bold text-leaf-400">{masteredCount}</div>
          <div className="text-sm text-gray-400">Mastered</div>
        </div>
        <div className="text-center p-4 bg-gold-500/10 rounded-lg">
          <div className="text-2xl font-bold text-gold-400">{learningCount}</div>
          <div className="text-sm text-gray-400">Learning</div>
        </div>
        <div className="text-center p-4 bg-info/10 rounded-lg">
          <div className="text-2xl font-bold text-info">{reviewingCount}</div>
          <div className="text-sm text-gray-400">Reviewing</div>
        </div>
      </div>

      {/* Ayah grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {Array.from({ length: totalAyahs }, (_, i) => i + 1).map((ayah) => {
          const entry = entries.find((e) => e.ayah_from <= ayah && e.ayah_to >= ayah);
          const status = entry?.status || 'new';

          const statusColors = {
            mastered: 'bg-leaf-500 text-ground-50',
            learning: 'bg-gold-500 text-black',
            reviewing: 'bg-info text-ground-50',
            new: 'bg-gray-700 text-gray-400',
          };

          return (
            <div
              key={ayah}
              className={`p-2 rounded text-center text-sm font-medium transition-colors ${
                statusColors[status] || statusColors.new
              }`}
            >
              {ayah}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
