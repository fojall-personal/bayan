'use client';

interface ProgressBarProps {
  progress: number;
  label?: string;
  /** Semantic tone. Not interpolated into a class name — see TONES. */
  tone?: 'gold' | 'leaf' | 'info' | 'muted';
}

// Previously this built `bg-${color}-500` at runtime, so Tailwind never emitted
// the class and *every* progress bar in the app rendered with no fill. The
// default was `arabic-green`, which was not even in the palette.
const TONES: Record<string, string> = {
  gold: 'bg-gold-500',
  leaf: 'bg-leaf-500',
  info: 'bg-info',
  muted: 'bg-ground-500',
};

export function ProgressBar({ progress, label, tone = 'leaf' }: ProgressBarProps) {
  const clamped = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-ground-300">{label}</span>
          <span className="font-medium tabular-nums text-ground-100">
            {Math.round(clamped)}%
          </span>
        </div>
      )}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-ground-800"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${TONES[tone]}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
