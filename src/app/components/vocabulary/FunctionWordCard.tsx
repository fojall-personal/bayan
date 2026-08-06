'use client';

interface FunctionWordProps {
  word: string;
  meaning: string;
  transliteration?: string;
  onClick: () => void;
}

/**
 * A smaller card for unrooted function words (مِن, فِي, عَلَى, etc.).
 *
 * Same design language as RootCard but smaller, with a muted label.
 * Function words carry the same weight in the Quran as rooted content words.
 */
export function FunctionWordCard({ word, meaning, transliteration, onClick }: FunctionWordProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`${word}${transliteration ? ` (${transliteration})` : ''} — ${meaning}`}
      className="w-full text-left rounded-lg border border-ground-700 p-3 bg-ground-900
        hover:border-ground-600 hover:bg-ground-800
        transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-xl font-arabic text-ground-200"
            dir="rtl"
            style={{ fontFamily: 'var(--font-arabic)', lineHeight: 'var(--leading-arabic)', fontFeatureSettings: 'liga 1, calt 1' }}
          >
            {word}
          </div>
          {transliteration && (
            <p
              className="text-ground-400 text-xs mt-0.5"
              style={{ fontFamily: 'var(--font-naskh)' }}
            >
              {transliteration}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs text-ground-500">function word</span>
        </div>
      </div>
      <p
        className="text-ground-300 text-sm mt-1"
        style={{ fontFamily: 'var(--font-naskh)' }}
      >
        {meaning}
      </p>
    </button>
  );
}
