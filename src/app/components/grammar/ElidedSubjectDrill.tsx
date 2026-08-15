'use client';

/**
 * Name the unwritten فاعل. Answer is the treebank's reconstructed token.
 * Distractors are other pronouns that table actually reconstructs.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface ElidedItem {
  id: string;
  prompt: string;
  answer: string;
  options: string[];
  explanation: string;
  source: string;
  ayahText: string | null;
}

export function ElidedSubjectDrill({ onDone }: { onDone?: () => void }) {
  const [item, setItem] = useState<ElidedItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPicked(null);
    try {
      const res = await apiFetch<{ data: ElidedItem | null }>('/api/grammar/elided');
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
    return <p className="text-sm text-ground-300">Loading an implied subject…</p>;
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
          No reconstructed subjects in this database. The treebank layer is empty
          locally unless it has been ingested.
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
      {item.ayahText && (
        <p className="text-arabic text-xl leading-loose" dir="rtl" lang="ar">
          {item.ayahText}
        </p>
      )}
      <p className="text-sm text-ground-300">{item.prompt}</p>
      <p className="text-xs text-ground-400">{item.source}</p>
      <div className="grid grid-cols-2 gap-2">
        {item.options.map((opt) => (
          <Button
            key={opt}
            variant={picked === opt ? 'primary' : 'secondary'}
            disabled={revealed}
            className="w-full"
            onClick={async () => {
              setPicked(opt);
              setSaving(true);
              try {
                await apiPost('/api/grammar/exercise', {
                  exerciseId: item.id,
                  answer: opt,
                  correct: opt === item.answer,
                });
              } catch {
                // Mastery write is best-effort; the learner still sees the result.
              } finally {
                setSaving(false);
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
          <p className="text-sm text-ground-100">
            {correct ? 'Yes.' : `The treebank reconstructs ${item.answer}.`}
          </p>
          <p className="mt-1 text-sm text-ground-400">{item.explanation}</p>
          {onDone && (
            <Button className="mt-4 w-full" disabled={saving} onClick={onDone}>
              Continue
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
