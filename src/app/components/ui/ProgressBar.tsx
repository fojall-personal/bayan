'use client';

interface ProgressBarProps {
  progress: number;
  label?: string;
  color?: string;
}

export function ProgressBar({ progress, label, color = 'arabic-green' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">{label}</span>
          <span className="font-medium">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
