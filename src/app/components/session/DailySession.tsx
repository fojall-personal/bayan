'use client';

// One guided flow through the five pieces of the doc's daily session, in
// order of decay rate: hifz review, function words, intensive reading,
// grammar production, freeflow. Every step embeds or links to the real
// surface for that step — this composes, it does not reimplement.
//
// A stepper, not a tile grid: Today.tsx's whole point is one primary action
// chosen for you rather than a dashboard of equal choices. A session picker
// screen would be that same regression at session scope, so there is exactly
// one "Continue" affordance moving forward through a fixed order, never a
// menu of five things to pick from.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FunctionWords } from '@/components/vocabulary/FunctionWords';
import { TashkilDrill } from '@/components/grammar/TashkilDrill';
import { ReviewSession } from '@/components/memorization/ReviewSession';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';

type StepId = 'review' | 'words' | 'reading' | 'grammar' | 'freeflow' | 'done';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'review', label: 'Hifz review' },
  { id: 'words', label: 'Function words' },
  { id: 'reading', label: 'Intensive reading' },
  { id: 'grammar', label: 'Grammar production' },
  { id: 'freeflow', label: 'Freeflow' },
];

/** One due entry from GET /api/memorization/review/today. */
interface DueItem {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
  status: string;
  ayah_text?: string;
  tier?: string;
}

/** One ayah from GET /api/progress/reading-queue. */
interface ReadingQueueItem {
  surah: number;
  ayah: number;
  blockingRoot: string;
  rootOccurrences: number;
  knownWords: number;
  totalWords: number;
  coveragePct: number;
}

/** One run from GET /api/progress/freeflow. */
interface FreeflowRun {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  ayahCount: number;
  wordCount: number;
  estimatedSeconds: number;
}

export function DailySession() {
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [due, setDue] = useState<DueItem[]>([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [reading, setReading] = useState<ReadingQueueItem[]>([]);
  const [freeflow, setFreeflow] = useState<FreeflowRun | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [dueRes, queueRes, flowRes] = await Promise.allSettled([
      apiFetch<{ data: DueItem[] }>('/api/memorization/review/today'),
      apiFetch<{ data: { items: ReadingQueueItem[] } }>('/api/progress/reading-queue?limit=3'),
      apiFetch<{ data: { runs: FreeflowRun[] } }>('/api/progress/freeflow?minWords=20'),
    ]);
    if (dueRes.status === 'fulfilled') setDue(dueRes.value.data ?? []);
    else setError(apiErrorMessage(dueRes.reason));
    if (queueRes.status === 'fulfilled') setReading(queueRes.value.data?.items ?? []);
    if (flowRes.status === 'fulfilled') setFreeflow(flowRes.value.data?.runs?.[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const advance = () => setStepIdx((i) => Math.min(i + 1, STEPS.length));

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Putting today&apos;s session together…</p>
      </Card>
    );
  }

  const step = STEPS[stepIdx]?.id ?? 'done';

  return (
    <div className="page-transition mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Today&apos;s session</h1>
        <p className="mt-1 text-sm text-ground-300">
          {step === 'done'
            ? 'All five pieces, done.'
            : `Step ${stepIdx + 1} of ${STEPS.length}: ${STEPS[stepIdx].label}`}
        </p>
      </div>

      {error && (
        <Card>
          <p className="mb-3 text-sm text-ground-300">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {/* ── 1. Hifz review ─────────────────────────────────────────────── */}
      {step === 'review' &&
        (reviewPos < due.length ? (
          <ReviewSession
            entry={due[reviewPos]}
            onComplete={() => setReviewPos((p) => p + 1)}
            onSkip={() => setReviewPos((p) => p + 1)}
          />
        ) : (
          <Card>
            <p className="text-xs uppercase tracking-label text-gold-400">1 / 5</p>
            <h2 className="mt-1.5 text-xl font-semibold">
              {due.length === 0 ? 'Nothing due for review' : 'Review done'}
            </h2>
            <p className="mt-1 text-sm text-ground-300">
              {due.length === 0
                ? 'FSRS decides when a passage is due, not this session — there is nothing owed right now.'
                : `${due.length} passage${due.length === 1 ? '' : 's'} reviewed.`}
            </p>
            <Button onClick={advance} className="mt-4 w-full">
              Continue — function words
            </Button>
          </Card>
        ))}

      {/* ── 2. Function words ──────────────────────────────────────────── */}
      {step === 'words' && (
        <div className="space-y-4">
          <FunctionWords compact />
          <Card>
            <Button onClick={advance} className="w-full">
              Continue — intensive reading
            </Button>
          </Card>
        </div>
      )}

      {/* ── 3. Intensive reading ───────────────────────────────────────── */}
      {step === 'reading' && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs uppercase tracking-label text-gold-400">3 / 5</p>
            <h2 className="mt-1.5 text-xl font-semibold">Read at the edge of what you know</h2>
            <p className="mt-1 text-sm text-ground-300">
              A couple of ayahs at ~95% known words — close enough that one new root
              closes the gap.
            </p>
          </Card>
          {reading.length === 0 ? (
            <Card>
              <p className="text-sm text-ground-300">
                Nothing queued right now — coverage may already be ahead of the reading
                queue, or roots are still being learned.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {reading.map((r) => (
                <Link
                  key={`${r.surah}:${r.ayah}`}
                  href={`/read?s=${r.surah}&a=${r.ayah}`}
                  className="block"
                >
                  <Card interactive>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold">
                        {getSurah(r.surah)?.name ?? `Surah ${r.surah}`} {r.surah}:{r.ayah}
                      </p>
                      <span className="shrink-0 text-xs text-ground-400">
                        {r.knownWords} of {r.totalWords} words · {r.coveragePct}%
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          <Card>
            <Button onClick={advance} className="w-full">
              Continue — grammar production
            </Button>
          </Card>
        </div>
      )}

      {/* ── 4. Grammar production ──────────────────────────────────────── */}
      {step === 'grammar' && (
        <div className="space-y-4">
          <TashkilDrill />
          <Card>
            <Button onClick={advance} className="w-full">
              Continue — freeflow
            </Button>
          </Card>
        </div>
      )}

      {/* ── 5. Freeflow ─────────────────────────────────────────────────── */}
      {step === 'freeflow' && (
        <div className="space-y-4">
          <Card>
            <p className="text-xs uppercase tracking-label text-gold-400">5 / 5</p>
            <h2 className="mt-1.5 text-xl font-semibold">Read a page you already know</h2>
            <p className="mt-1 text-sm text-ground-300">
              Ayahs at speed, no lookups — the recall a due-date queue cannot measure.
            </p>
          </Card>
          {freeflow ? (
            <Link
              href={`/read?s=${freeflow.surah}&a=${freeflow.ayahFrom}&ayahTo=${freeflow.ayahTo}&continuous=1`}
              className="block"
            >
              <Card interactive>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">
                    {getSurah(freeflow.surah)?.name ?? `Surah ${freeflow.surah}`}{' '}
                    {freeflow.ayahFrom}–{freeflow.ayahTo}
                  </p>
                  <span className="shrink-0 text-xs text-ground-400">
                    ~{Math.round(freeflow.estimatedSeconds / 60) || 1} min
                  </span>
                </div>
                <p className="mt-1 text-sm text-ground-300">{freeflow.ayahCount} ayahs</p>
              </Card>
            </Link>
          ) : (
            <Card>
              <p className="text-sm text-ground-300">
                No band of 20+ known-word ayahs yet — freeflow opens up as more roots and
                function words are known.
              </p>
            </Card>
          )}
          <Card>
            <Button onClick={advance} className="w-full">
              Finish session
            </Button>
          </Card>
        </div>
      )}

      {/* ── Done ────────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <Card className="border-gold-500/40 text-center py-8">
          <h2 className="text-xl font-semibold">Session complete</h2>
          <p className="mt-1 text-sm text-ground-300">
            Review, function words, reading, grammar, freeflow — all five.
          </p>
          <Link href="/today" className="mt-4 block">
            <Button className="w-full">Back to Today</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
