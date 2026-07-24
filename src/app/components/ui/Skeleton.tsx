'use client';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width, height, className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-800 animate-pulse rounded ${className}`}
      style={{ width, height }}
    />
  );
}

interface LoadingCardProps {
  lines?: number;
}

export function LoadingCard({ lines = 3 }: LoadingCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <Skeleton width="120px" height="20px" />
      <Skeleton width="100%" height="100px" />
      <Skeleton width="80%" height="20px" />
      {lines > 3 && <Skeleton width="60%" height="20px" />}
    </div>
  );
}
