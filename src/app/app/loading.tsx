import { LoadingCard } from '@/components/ui/Skeleton';

/**
 * Route-level loading UI. Without one, navigating between routes showed nothing
 * until the new page's own loading state mounted.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="mb-10 space-y-3 border-b border-ground-800 pb-6">
        <div className="h-3 w-24 animate-pulse rounded bg-ground-800" />
        <div className="h-8 w-64 animate-pulse rounded bg-ground-800" />
      </div>
      <LoadingCard />
      <LoadingCard lines={4} />
    </div>
  );
}
