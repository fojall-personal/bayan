'use client';

/**
 * Mixed daily session — due hifz, due vocabulary, next lesson, one at a time.
 *
 * Grades go to POST /api/session/complete, which applies FSRS to the live
 * rows. A failed save stays on the last item with a retry; it does not
 * celebrate.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';
import { rootToArabic } from '@/lib/arabic-root';

type SessionItemType = 'hifz' | 'vocabulary' | 'lesson';
type Grade = 'again' | 'hard' | 'good' | 'easy';

interface SessionItem {
  id: string;
  type: SessionItemType;
  label: string;
  estimatedSeconds: number;
  payload: Record<string, unknown>;
}

interface SessionPlan {
  sessionId: string;
  items: SessionItem[];
  plannedSeconds: number;
  summary: { hifz: number; vocabulary: number; lesson: number };
}

interface ItemResult {
  itemId: string;
  grade?: Grade;
  correct?: boolean;
  seconds?: number;
}

const GRADE_OPTIONS: { grade: Grade; label: string }[] = [
  { grade: 'again', label: "Didn't remember" },
  { grade: 'hard', label: 'With difficulty' },
  { grade: 'good', label: 'Correctly' },
  { grade: 'easy', label: 'Effortlessly' },
];

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Arabic as-is; Buckwalter (roots / test words) converted. */
function displayArabic(value: string): string {
  if (/[\u0600-\u06FF]/.test(value)) return value;
  return rootToArabic(value) || value;
}

function sourceLine(payload: Record<string, unknown>): string | null {
  const surah = asNumber(payload.sourceSurah);
  const ayah = asNumber(payload.sourceAyah);
  if (surah == null || ayah == null) return null;
  const name = getSurah(surah)?.name;
  return name ? `${name} ${surah}:${ayah}` : `${surah}:${ayah}`;
}

export function MixedSessionRunner() {
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ItemResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [done, setDone] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<Grade | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: SessionPlan }>('/api/session/plan');
      setPlan(res.data);
      if (!res.data.items.length) setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = plan?.items[index] ?? null;
  const total = plan?.items.length ?? 0;
  const progressPct = total === 0 ? 100 : Math.round((index / total) * 100);

  const finish = async (finalResults: ItemResult[]) => {
    if (!plan) return;
    setFinishing(true);
    setSaveError(null);
    try {
      await apiPost('/api/session/complete', {
        sessionId: plan.sessionId,
        results: finalResults,
        actualSeconds: Math.round((Date.now() - startedAt) / 1000),
      });
      setDone(true);
    } catch (err) {
      setSaveError(apiErrorMessage(err));
    } finally {
      setFinishing(false);
    }
  };

  const recordAndAdvance = async (result: ItemResult) => {
    const nextResults = [...results, result];
    setResults(nextResults);
    setRevealed(false);
    setSelectedGrade(null);
    if (index + 1 >= total) {
      await finish(nextResults);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Building today’s mixed session…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="mb-3 text-sm text-ground-300">{error}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </Card>
    );
  }

  if (done) {
    const hifzCount = results.filter((r) => r.itemId.startsWith('hifz:')).length;
    const vocabCount = results.filter((r) => r.itemId.startsWith('vocab:')).length;
    const lessonCount = results.filter((r) => r.itemId.startsWith('lesson:')).length;

    return (
      <div className="page-transition mx-auto max-w-2xl space-y-6">
        <Card className="border-gold-500/40 py-10 text-center">
          <p className="text-xs uppercase tracking-label text-gold-400">Session complete</p>
          <h1 className="mt-2 font-display text-3xl">Well done</h1>
          <p className="mt-2 text-sm text-ground-300">
            {results.length === 0
              ? 'Nothing was due today — a good place to be.'
              : `You worked through ${results.length} item${results.length === 1 ? '' : 's'}.`}
          </p>

          {results.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-gold-400">{hifzCount}</p>
                <p className="text-xs text-ground-400">Hifz</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gold-400">{vocabCount}</p>
                <p className="text-xs text-ground-400">Vocabulary</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gold-400">{lessonCount}</p>
                <p className="text-xs text-ground-400">Lesson</p>
              </div>
            </div>
          )}

          <div className="mt-8 space-y-2">
            <Link href="/today" className="block">
              <Button className="w-full">Back to Today</Button>
            </Link>
            {results.length === 0 && (
              <Link href="/learning" className="block">
                <Button variant="secondary" className="w-full">
                  Browse lessons
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (!current || !plan) return null;

  const word = asString(current.payload.word);
  const meaning = asString(current.payload.meaning);
  const transliteration = asString(current.payload.transliteration);
  const source = sourceLine(current.payload);
  const ayahText =
    asString(current.payload.textUthmani) ?? asString(current.payload.textSimple);

  return (
    <div className="page-transition mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="font-display text-2xl sm:text-3xl">Today’s session</h1>
          <p className="shrink-0 text-sm tabular-nums text-ground-400">
            {index + 1} / {total}
          </p>
        </div>
        <p className="mt-1 text-sm text-ground-300">
          Mixed practice · ~{Math.round(plan.plannedSeconds / 60)} min planned
        </p>
        <div className="mt-4">
          <ProgressBar progress={progressPct} tone="gold" />
        </div>
      </div>

      <Card>
        <p className="text-xs uppercase tracking-label text-gold-400">
          {current.type === 'hifz' && 'Hifz review'}
          {current.type === 'vocabulary' && 'Vocabulary'}
          {current.type === 'lesson' && 'Lesson'}
        </p>
        <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>

        {current.type === 'hifz' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md bg-ground-950 p-4 text-center" dir="rtl" lang="ar">
              <p className="text-arabic text-2xl leading-loose text-ground-50">
                {ayahText ?? '…'}
              </p>
            </div>
            <p className="text-sm text-ground-400">
              {getSurah(asNumber(current.payload.surahId) ?? 0)?.name ??
                `Surah ${current.payload.surahId}`}{' '}
              {asNumber(current.payload.ayahFrom)}
              {current.payload.ayahTo !== current.payload.ayahFrom
                ? `–${current.payload.ayahTo}`
                : ''}
            </p>

            {!revealed ? (
              <Button className="w-full" onClick={() => setRevealed(true)}>
                I have recalled it
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-ground-300">How well did you remember it?</p>
                <div className="grid grid-cols-2 gap-2">
                  {GRADE_OPTIONS.map(({ grade, label }) => (
                    <Button
                      key={grade}
                      variant={selectedGrade === grade ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setSelectedGrade(grade)}
                      className="w-full"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Button
                  className="mt-3 w-full"
                  disabled={!selectedGrade || finishing || !!saveError}
                  onClick={() =>
                    selectedGrade &&
                    recordAndAdvance({
                      itemId: current.id,
                      grade: selectedGrade,
                      seconds: current.estimatedSeconds,
                    })
                  }
                >
                  {finishing ? 'Saving…' : 'Continue'}
                </Button>
              </div>
            )}
          </div>
        )}

        {current.type === 'vocabulary' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md bg-ground-950 p-6 text-center">
              <p className="text-naskh text-3xl text-ground-50" dir="rtl" lang="ar">
                {word ? displayArabic(word) : current.label}
              </p>
              {transliteration && (
                <p className="mt-2 text-sm text-ground-400">{transliteration}</p>
              )}
            </div>

            {!revealed ? (
              <Button className="w-full" onClick={() => setRevealed(true)}>
                Show meaning
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-center text-ground-100">
                  {meaning ?? 'No gloss is stored for this word yet.'}
                </p>
                {source && <p className="text-center text-xs text-ground-400">{source}</p>}
                <p className="text-sm text-ground-300">Did you know it?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    disabled={finishing || !!saveError}
                    onClick={() =>
                      recordAndAdvance({
                        itemId: current.id,
                        correct: false,
                        grade: 'again',
                        seconds: current.estimatedSeconds,
                      })
                    }
                  >
                    Not yet
                  </Button>
                  <Button
                    disabled={finishing || !!saveError}
                    onClick={() =>
                      recordAndAdvance({
                        itemId: current.id,
                        correct: true,
                        grade: 'good',
                        seconds: current.estimatedSeconds,
                      })
                    }
                  >
                    Knew it
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {current.type === 'lesson' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-ground-300">
              Open the lesson and work through it. Coming back here only records
              that you reached it — the lesson marks itself complete when you
              submit the exercises.
            </p>
            <Link
              href={`/learning?lesson=${current.payload.lessonId}`}
              className="block"
            >
              <Button variant="secondary" className="w-full">
                Open lesson
              </Button>
            </Link>
            <Button
              className="w-full"
              disabled={finishing || !!saveError}
              onClick={() =>
                recordAndAdvance({
                  itemId: current.id,
                  seconds: current.estimatedSeconds,
                })
              }
            >
              {finishing ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        )}

        {saveError && (
          <div className="mt-4 rounded-md border border-error/40 bg-error/10 p-3">
            <p className="mb-2 text-sm text-ground-100">{saveError}</p>
            <Button
              variant="secondary"
              disabled={finishing}
              onClick={() => finish(results)}
            >
              {finishing ? 'Saving…' : 'Retry save'}
            </Button>
          </div>
        )}
      </Card>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-ground-400 hover:text-ground-300 disabled:opacity-40"
          disabled={finishing || !!saveError}
          onClick={() =>
            recordAndAdvance({
              itemId: current.id,
              seconds: 0,
            })
          }
        >
          Skip this item
        </button>
      </div>
    </div>
  );
}
