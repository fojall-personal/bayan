'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Route-level error boundary. Without one, an unhandled render error in any
 * page produced a blank region with nothing in the UI to indicate a failure.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-label text-gold-400">
        Something broke
      </p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ground-50">
        This page didn&apos;t load
      </h1>
      <p className="mt-3 text-ground-300">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="secondary" onClick={() => (window.location.href = '/')}>
          Start over
        </Button>
      </div>
    </div>
  );
}
