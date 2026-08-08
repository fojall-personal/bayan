'use client';

interface RootCardProps {
  root: string;
  meaning: string;
  wordCount: number;
  mastery: number; // 0-5
  isFunctionWord?: boolean;
  onClick: () => void;
}

/**
 * A single vocabulary root card.
 *
 * Arabic root in Amiri at gold — the accent colour says "this is where you look next."
 * English meaning in Noto Naskh below. Word count and mastery bar complete the card.
 * Function words (no root) render as a smaller variant with a muted label.
 */
export function RootCard({ root, meaning, wordCount, mastery, isFunctionWord = false, onClick }: RootCardProps) {
  const pct = Math.min(100, (mastery / 5) * 100);
  const hasData = mastery > 0 || wordCount > 0;

  return (
    <button
      onClick={onClick}
      aria-label={`Root ${root}: ${meaning}, ${wordCount} word${wordCount !== 1 ? 's' : ''}`}
      className={`w-full text-left rounded-lg border p-4 bg-ground-900
        ${isFunctionWord
          ? 'border-ground-700'
          : 'border-ground-800 hover:border-gold-500/40 hover:bg-ground-800'
        }
        transition-all duration-200 flex flex-col gap-2.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className={`font-arabic ${
              isFunctionWord ? 'text-ground-200 text-xl' : 'text-gold-400 text-3xl'
            }`}
            dir="rtl"
            lang="ar"
            style={{
              fontFamily: 'var(--font-arabic)',
              lineHeight: 'var(--leading-arabic)',
            }}
          >
            {root}
          </div>
          <p
            className="text-ground-300 mt-1 text-sm"
            style={{ fontFamily: 'var(--font-naskh)' }}
          >
            {meaning}
          </p>
        </div>
        <div className="text-right shrink-0">
          {isFunctionWord ? (
            <span className="text-xs text-ground-400">function word</span>
          ) : (
            <span className="text-xs text-ground-500">
              {wordCount} word{wordCount !== 1 ? 's' : ''} in family
            </span>
          )}
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-ground-800">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: hasData ? 'var(--leaf-500)' : 'var(--ground-700)',
          }}
          role="progressbar"
          aria-valuenow={mastery}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label={`Mastery ${mastery} of 5`}
        />
      </div>

      <div className="text-xs text-ground-500">
        Mastery: {mastery}/5
      </div>
    </button>
  );
}
