'use client';

/**
 * Name the token ʿāmil. Answer is the head word the treebank points at.
 * QAC GPL · treebank CC BY · Tanzil CC BY.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface GovernorItem {
  id: string;
  prompt: string;
  word: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
  ayahText: string | null;
}

export function GovernorDrill({ onDone }: { onDone?: () => void }) {
  const [item, setItem] = useState<GovernorItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPicked(null);
    try {
      const res = await apiFetch<{ data: GovernorItem | null }>('/api/grammar/governor');
      setItem(res.data);
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
    return <p className="text-sm text-ground-300">Loading a governor item…</p>;
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
          No governor drill is ready. The treebank layer is empty in this database.
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
  const marked = item.ayahText
    ? item.ayahText
        .split(/\s+/)
        .map((w) => (w === item.word ? `⟪${w}⟫` : w))
        .join(' ')
    : null;

  return (
    <div className="space-y-4">
      {marked && (
        <p className="text-arabic text-xl leading-loose" dir="rtl" lang="ar">
          {marked}
        </p>
      )}
      <p className="text-sm text-ground-300">{item.prompt}</p>
      <p className="text-xs text-ground-400">
        {item.source} · QAC GPL · treebank CC BY · Tanzil CC BY
      </p>
      <div className="grid grid-cols-2 gap-2">
        {item.options.map((opt) => (
          <Button
            key={opt}
            variant={picked === opt ? 'primary' : 'secondary'}
            className="h-auto min-h-11 w-full touch-manipulation whitespace-normal py-2"
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
            <span dir="rtl" lang="ar" className="text-naskh text-lg">
              {opt}
            </span>
          </Button>
        ))}
      </div>
      {revealed && (
        <div>
          <p className="text-sm text-ground-100">{correct ? 'Yes.' : `The ʿāmil is ${item.answer}.`}</p>
          <p className="mt-1 text-sm text-ground-400">{item.explanation}</p>
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