'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { segmentVerse } from '@/lib/tajweed-render';
import { AyahAudioButton } from '@/components/audio/AyahAudioButton';

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
  /** Null when the rule maps to no colour category — renders unstyled. */
  color: string | null;
  category: string | null;
  categoryName: string | null;
}

/** One entry per colour category actually present in this surah. */
export interface TajweedLegendEntry {
  category: string;
  name: string;
  color: string;
}

interface TajweedViewerProps {
  surahId: number;
  surahName: string;
  verses: QuranVerse[];
  legend?: TajweedLegendEntry[];
}

export function TajweedViewer({
  surahId,
  surahName,
  verses,
  legend = [],
}: TajweedViewerProps) {
  // Hover highlights a whole CATEGORY, which is what the legend lists — the
  // underlying 18 rule names collapse into 10 taught categories.
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null);
  const [currentAyah, setCurrentAyah] = useState(0);

  // Fall back to deriving the legend from the tags when the caller does not pass
  // one, so the component still works against an older API response.
  const derivedLegend: TajweedLegendEntry[] = (() => {
    if (legend.length > 0) return legend;
    const seen = new Map<string, TajweedLegendEntry>();
    for (const v of verses) {
      for (const t of v.tajweed_tags ?? []) {
        if (t.category && t.color && !seen.has(t.category)) {
          seen.set(t.category, {
            category: t.category,
            name: t.categoryName ?? t.category,
            color: t.color,
          });
        }
      }
    }
    return [...seen.values()];
  })();

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
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-leaf-500/50"
          >
            {verses.map((v, i) => (
              <option key={i} value={i}>
                Ayah {v.ayah}
              </option>
            ))}
          </select>
          {currentVerse && (
            <AyahAudioButton surah={currentVerse.surah} ayah={currentVerse.ayah} />
          )}
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

          <div className="text-3xl text-center leading-loose" dir="rtl">
            <TajweedText
              text={currentVerse.text_uthmani}
              tags={currentVerse.tajweed_tags}
              highlightedCategory={highlightedCategory}
            />
          </div>
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
                ? 'border-leaf-500 bg-leaf-500/10'
                : 'border-gray-700 hover:border-gray-600 bg-gray-800'
            }`}
          >
            <div className="text-sm text-gray-500 mb-1">
              Ayah {verse.ayah}
            </div>
            <div className="leading-loose" dir="rtl">
              <TajweedText
                text={verse.text_uthmani}
                tags={verse.tajweed_tags}
                highlightedCategory={highlightedCategory}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Tajweed Legend — categories present in THIS surah, not every rule */}
      {derivedLegend.length > 0 && (
        <Card>
          <h3 className="text-lg font-bold mb-4">Tajweed Legend</h3>
          <p className="text-sm text-gray-400 mb-4">
            Hover a rule to show only its marks.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {derivedLegend.map((entry) => (
              <button
                key={entry.category}
                type="button"
                onMouseEnter={() => setHighlightedCategory(entry.category)}
                onMouseLeave={() => setHighlightedCategory(null)}
                onFocus={() => setHighlightedCategory(entry.category)}
                onBlur={() => setHighlightedCategory(null)}
                aria-pressed={highlightedCategory === entry.category}
                className={`flex items-center gap-2 p-3 rounded-lg transition-colors ${
                  highlightedCategory === entry.category
                    ? 'bg-gray-700'
                    : 'hover:bg-gray-700'
                }`}
              >
                <div
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-300 text-left">{entry.name}</span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/**
 * Renders an ayah as coloured runs.
 *
 * Deliberately not dangerouslySetInnerHTML: the previous implementation built an
 * HTML string with sequential String.replace, which put marks on the wrong
 * letters (see src/app/lib/tajweed-render.ts for the specifics). Segmentation is
 * pure and unit-tested in workers/test/tajweed-render.test.ts.
 */
function TajweedText({
  text,
  tags,
  highlightedCategory,
}: {
  text: string;
  tags?: TajweedTag[];
  highlightedCategory: string | null;
}) {
  const segments = segmentVerse(text, tags ?? [], highlightedCategory ?? undefined);

  return (
    <>
      {segments.map((seg, i) =>
        seg.color ? (
          <span
            key={i}
            style={{
              backgroundColor: seg.color,
              padding: '0 2px',
              borderRadius: '3px',
            }}
            title={seg.rule ?? undefined}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
