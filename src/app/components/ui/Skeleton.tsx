'use client';

interface SkeletonProps {
  className?: string;
}

/** Sized with utility classes so no inline style is needed. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-ground-800 ${className}`} />;
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="space-y-4 rounded-lg border border-ground-800 bg-ground-900 p-card"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-24 w-full" />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <Skeleton key={i} className={i % 2 ? 'h-4 w-3/5' : 'h-4 w-4/5'} />
      ))}
    </div>
  );
}
