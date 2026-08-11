'use client';

// The retention target FSRS schedules toward, with the workload cost shown
// before it's chosen — GET/POST/DELETE /api/memorization/retention existed
// with no screen calling them. A higher target means more, closer-together
// reviews; a learner should see that trade-off in real reviews/day for their
// own items, not just move a slider blind.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface PreviewRow {
  retention: number;
  estimatedReviewsPerDay: number;
}

interface RetentionData {
  current: number;
  isDefault: boolean;
  suggestedHifz: number;
  itemCount: number;
  preview: PreviewRow[];
}

export function RetentionSettings() {
  const [data, setData] = useState<RetentionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: RetentionData }>('/api/memorization/retention');
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRetention = async (retention: number) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/memorization/retention', { retention });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    setBusy(false);
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/memorization/retention', { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    setBusy(false);
  };

  if (!data) {
    return error ? (
      <Card>
        <p className="text-sm text-ground-300">{error}</p>
      </Card>
    ) : null;
  }

  return (
    <Card>
      <p className="text-xs uppercase tracking-label text-gold-400">Review retention target</p>
      <p className="mt-1 text-sm text-ground-300">
        {Math.round(data.current * 100)}%
        {data.isDefault ? ' (default)' : ''} — higher holds material longer but costs more
        reviews per day.{' '}
        {data.itemCount > 0
          ? `Estimated from your own ${data.itemCount} tracked item${data.itemCount === 1 ? '' : 's'}.`
          : 'Add something to memorize to see a real estimate.'}
      </p>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <div className="mt-3 space-y-1.5">
        {data.preview.map((row) => {
          const isCurrent = Math.abs(row.retention - data.current) < 0.001;
          const isSuggestedHifz = Math.abs(row.retention - data.suggestedHifz) < 0.001;
          return (
            <button
              key={row.retention}
              type="button"
              onClick={() => setRetention(row.retention)}
              disabled={busy || isCurrent}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors disabled:opacity-70 ${
                isCurrent
                  ? 'bg-leaf-500/20 text-leaf-400'
                  : 'bg-ground-800 text-ground-300 hover:bg-ground-700'
              }`}
            >
              <span>
                {Math.round(row.retention * 100)}%
                {isSuggestedHifz ? ' — suggested for hifz' : ''}
                {isCurrent ? ' — current' : ''}
              </span>
              <span className="text-xs text-ground-400">
                ~{row.estimatedReviewsPerDay}/day
              </span>
            </button>
          );
        })}
      </div>

      {!data.isDefault && (
        <Button variant="ghost" onClick={reset} disabled={busy} className="mt-3 w-full">
          Reset to default (90%)
        </Button>
      )}
    </Card>
  );
}
