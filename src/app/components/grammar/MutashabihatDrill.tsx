'use client';

/**
 * Two near-identical ayahs: which text is the real one at this location?
 * Bank rows from find-mutashabihat.mjs + gen-mutashabihat-exercises.mjs. Tanzil CC BY.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface MutashabihatItem {
  id: string;
  prompt: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
}

export function MutashabihatDrill({ onDone }: { onDone?: () => void }) {
  const [item, setItem] = useState<MutashabihatItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPicked(null);
    try {
      const res = await apiFetch<{ data: MutashabihatItem[] }>(
        '/api/grammar/exercises?kind=mutashabihat&limit=1&random=1'
      );
      setItem(res.data[0] ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-ground-300">Loading a near-identical pair…</p>;
  }
  if (error) {
    return (
      <div>
        <p className="mb-3 text-sm text-ground-300">{error}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!item) {
    return (
      <div>
        <p className="text-sm text-ground-300">
          No mutashabihat items in this database. The pair generator has not been ingested.
        </p>
        {onDone && (
          <Button className="mt-4 w-full" onClick={onDone}>
            Continue
          </Button>
        )}
      </div>
    );
  }

  const revealed = picked !== null;
  const correct = picked === item.answer;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ground-300">{item.prompt}</p>
      <p className="text-xs text-ground-400">{item.source} · Tanzil CC BY</p>
      <div className="grid grid-cols-1 gap-2">
        {item.options.map((opt) => (
          <Button
            key={opt}
            variant={picked === opt ? 'primary' : 'secondary'}
            className="h-auto min-h-11 w-full touch-manipulation whitespace-normal py-3"
            onClick={async () => {
              if (revealed) return;
              setPicked(opt);
              try {
                await apiPost('/api/grammar/exercise', {
                  exerciseId: item.id,
                  answer: opt,
                  correct: opt === item.answer,
                });
              } catch {
                /* grade still shows */
              }
            }}
          >
            <span dir="rtl" lang="ar" className="text-naskh text-lg leading-loose">
              {opt}
            </span>
          </Button>
        ))}
      </div>
      {revealed && (
        <div>
          <p className="text-sm text-ground-100">{correct ? 'Yes.' : 'The other text is the real one here.'}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ground-400" dir="auto">
            {item.explanation}
          </p>
          {onDone && (
            <Button className="mt-4 w-full" onClick={onDone}>
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
