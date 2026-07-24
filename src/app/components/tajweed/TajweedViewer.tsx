'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface QuranVerse {
  surah: number;
  ayah: number;
  text_uthmani: string;
  text_simple: string;
  tajweed_tags: TajweedTag[];
}

interface TajweedTag {
  start: number;
  end: number;
  rule: string;
  color: string;
}

interface TajweedViewerProps {
  surahId: number;
  surahName: string;
  verses: QuranVerse[];
}

export function TajweedViewer({ surahId, surahName, verses }: TajweedViewerProps) {
  const [highlightedRule, setHighlightedRule] = useState<string | null>(null);
  const [currentAyah, setCurrentAyah] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Collect all unique rules
  const allRules = new Map<string, string>();
  verses.forEach((v) =>
    v.tajweed_tags?.forEach((t) => allRules.set(t.rule, t.color))
  );

  const handlePlayAudio = () => {
    setAudioPlaying(true);
    setTimeout(() => setAudioPlaying(false), 5000);
  };

  const handleRuleHover = (rule: string, color: string) => {
    setHighlightedRule(rule);
  };

  const handleRuleLeave = () => {
    setHighlightedRule(null);
  };

  const currentVerse = verses[currentAyah];

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{surahName}</h1>
          <p className="text-gray-400 text-sm">Surah {surahId}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={currentAyah}
            onChange={(e) => setCurrentAyah(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500/50"
          >
            {verses.map((v, i) => (
              <option key={i} value={i}>
                Ayah {v.ayah}
              </option>
            ))}
          </select>
          <button
            onClick={handlePlayAudio}
            disabled={audioPlaying}
            className="px-4 py-2 bg-green-500/20 text-green-500 rounded-lg text-sm hover:bg-green-500/30 disabled:opacity-50 transition-colors"
          >
            {audioPlaying ? '▶ Playing...' : '▶ Play'}
          </button>
        </div>
      </div>

      {/* Current verse with tajweed colors */}
      {currentVerse && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="text-sm text-gray-400">
              Surah {currentVerse.surah}, Ayah {currentVerse.ayah}
            </div>
          </div>

          <div
            className="text-3xl text-center leading-loose"
            dir="rtl"
            dangerouslySetInnerHTML={{
              __html: highlightTajweed(
                currentVerse.text_uthmani,
                currentVerse.tajweed_tags,
                highlightedRule
              ),
            }}
          />
        </Card>
      )}

      {/* All verses preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {verses.slice(0, 20).map((verse, i) => (
          <button
            key={i}
            onClick={() => setCurrentAyah(i)}
            className={`text-right p-4 rounded-lg border transition-all text-xl ${
              currentAyah === i
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
            }`}
          >
            <div className="text-sm text-gray-500 mb-1">
              Ayah {verse.ayah}
            </div>
            <div
              className="leading-loose"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: highlightTajweed(
                  verse.text_uthmani,
                  verse.tajweed_tags,
                  highlightedRule
                ),
              }}
            />
          </button>
        ))}
      </div>

      {/* Tajweed Legend */}
      <Card>
        <h3 className="text-lg font-bold mb-4">Tajweed Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from(allRules.entries()).map(([rule, color]) => (
            <button
              key={rule}
              onMouseEnter={() => handleRuleHover(rule, color)}
              onMouseLeave={handleRuleLeave}
              className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-300 capitalize">
                {rule.replace(/_/g, ' ')}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function highlightTajweed(
  text: string,
  tags?: TajweedTag[],
  highlightedRule?: string
): string {
  if (!tags || tags.length === 0) return text;

  let result = text;
  const sortedTags = [...tags].sort((a, b) => b.start - a.start);

  for (const tag of sortedTags) {
    const word = text.substring(tag.start, tag.end + 1);
    const shouldHighlight = !highlightedRule || highlightedRule === tag.rule;
    const bgColor = shouldHighlight ? tag.color : 'transparent';

    result = result.replace(
      word,
      `<span style="background-color: ${bgColor}; padding: 0 2px; border-radius: 3px;">${word}</span>`
    );
  }

  return result;
}
