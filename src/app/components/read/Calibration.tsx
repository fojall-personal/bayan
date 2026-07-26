'use client';

// Find out which roots the learner already knows, by asking.
//
// The tempting alternative was to seed this from the placement score — level 3
// implies the top 120 roots. That would be fabrication: the assessment's eighteen
// questions cover literacy, comprehension, grammar and memorization, and not one
// tests which roots you know. A vocabulary inferred from a comprehension score is
// a confident number with nothing behind it.
//
// Twelve sampled roots takes about a minute and is a measurement. The bulk fill
// afterwards is clearly labelled as the estimate it is, and only happens if asked.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { rootToArabic as rootArabic } from '@/lib/arabic-root';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface Item {
  root: string;
  rank: number;
  occurrences: number;
  exampleArabic: string | null;
  exampleEnglish: string | null;
}
interface Saved {
  rootsRecorded: number;
  measured: number;
  inferred: number;
  ayahsUnlocked: number;
  ayahsReadable: number;
  ayahsTotal: number;
}


export function Calibration() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<'asking' | 'offer' | 'done'>('asking');
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: { items: Item[] } }>('/api/progress/calibration');
      setItems(res.data.items);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const answer = (known: boolean) => {
    const item = items[at];
    setAnswers((a) => ({ ...a, [item.root]: known }));
    if (at + 1 < items.length) setAt(at + 1);
    else setPhase('offer');
  };

  /**
   * The highest rank below which every answer was "known".
   *
   * Frequency ordering means knowledge is roughly monotonic in rank, so a run of
   * yes-answers from the commonest end is the signal. Deliberately conservative:
   * it stops at the FIRST "not yet", rather than taking the highest yes and
   * assuming everything below it.
   */
  const solidToRank = (() => {
    let rank = 0;
    for (const it of items) {
      if (answers[it.root]) rank = it.rank;
      else break;
    }
    return rank;
  })();

  const save = async (fill: boolean) => {
    setBusy(true);
    try {
      const known = Object.entries(answers)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await apiPost<{ data: Saved }>('/api/progress/calibration', {
        known,
        ...(fill && solidToRank > 0 ? { fillToRank: solidToRank } : {}),
      });
      setSaved(res.data);
      setPhase('done');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Picking roots…</p>
      </Card>
    );
  }
  if (error && items.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-bold">Couldn&apos;t start</h2>
        <p className="mb-4 text-sm text-ground-300">{error}</p>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </Card>
    );
  }

  if (phase === 'done' && saved) {
    return (
      <div className="page-transition mx-auto max-w-lg space-y-5">
        <div className="rounded-lg border border-leaf-500/50 bg-leaf-500/10 p-6" role="status">
          <p className="text-2xl font-semibold text-leaf-400">
            {saved.ayahsReadable.toLocaleString()} ayahs within reach
          </p>
          <p className="mt-2 text-sm text-ground-300">
            {saved.rootsRecorded.toLocaleString()} roots recorded —{' '}
            {saved.measured} you answered
            {saved.inferred > 0 ? `, ${saved.inferred} filled in from the band` : ''}. That
            is {((saved.ayahsReadable / saved.ayahsTotal) * 100).toFixed(1)}% of the
            Quran you can read end to end.
          </p>
        </div>
        <Card>
          <p className="text-sm text-ground-300">
            Any of these can be corrected. Open a root from Today or from a word while
            reading, and mark it either way.
          </p>
          <Button className="mt-4" onClick={() => router.push('/today')}>
            Go to Today
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === 'offer') {
    const yes = Object.values(answers).filter(Boolean).length;
    return (
      <div className="page-transition mx-auto max-w-lg space-y-5">
        <Card>
          <h1 className="font-display text-2xl">
            {yes} of {items.length} known
          </h1>
          <p className="mt-2 text-sm text-ground-300">
            Those {yes} are recorded as fact.
          </p>
        </Card>

        {solidToRank > 0 ? (
          <Card className="border-gold-500/40">
            <p className="font-semibold">
              You knew every root up to rank {solidToRank}.
            </p>
            <p className="mt-2 text-sm text-ground-300">
              Mark the rest of that band as known too? Frequency ordering means
              knowledge is roughly monotonic in rank, so this is usually right — but it
              is an <strong>estimate, not a measurement</strong>, and you can correct
              any of them later.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => save(true)} disabled={busy}>
                {busy ? 'Saving…' : `Yes, mark the top ${solidToRank}`}
              </Button>
              <Button variant="secondary" onClick={() => save(false)} disabled={busy}>
                Only the ones I answered
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-ground-300">
              Starting from the beginning, then. The commonest root in the Quran
              appears 2,851 times — you will meet it immediately.
            </p>
            <Button className="mt-4" onClick={() => save(false)} disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </Button>
          </Card>
        )}
      </div>
    );
  }

  const item = items[at];
  return (
    <div className="page-transition mx-auto max-w-lg space-y-5">
      <Card>
        <div className="flex items-baseline justify-between text-sm text-ground-400">
          <span>
            {at + 1} of {items.length}
          </span>
          <span>rank {item.rank} of 1,642</span>
        </div>

        <p
          className="text-arabic mt-5 text-center text-5xl text-gold-400"
          dir="rtl"
          lang="ar"
        >
          {rootArabic(item.root)}
        </p>

        {/* The root alone is recognisable to almost nobody. The commonest word
            built on it is what a learner has actually met. */}
        {item.exampleArabic && (
          <p className="text-arabic mt-4 text-center text-2xl" dir="rtl" lang="ar">
            {item.exampleArabic}
          </p>
        )}
        <p className="mt-2 text-center text-sm text-ground-300">
          {item.exampleEnglish ? `“${item.exampleEnglish}” · ` : ''}
          {item.occurrences.toLocaleString()} occurrence
          {item.occurrences === 1 ? '' : 's'}
        </p>

        <div className="mt-7 flex gap-3">
          <Button className="flex-1" onClick={() => answer(true)}>
            I know this
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => answer(false)}>
            Not yet
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-ground-400">
        About a minute. This measures rather than guesses — the placement test never
        asked which roots you know, so it cannot answer this.{' '}
        <Link href="/today" className="text-gold-400 hover:underline">
          Skip
        </Link>
      </p>
    </div>
  );
}
