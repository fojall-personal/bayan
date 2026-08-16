'use client';

/**
 * Daily sitting: due hifz (typed recall), vocab, then the loop —
 * function words, intensive, tashkil production, elided فاعل, freeflow.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';
import { rootToArabic } from '@/lib/arabic-root';
import { ReviewSession } from '@/components/memorization/ReviewSession';
import { FunctionWords } from '@/components/vocabulary/FunctionWords';
import { TashkilDrill } from '@/components/grammar/TashkilDrill';
import { ElidedSubjectDrill } from '@/components/grammar/ElidedSubjectDrill';
import { GovernorDrill } from '@/components/grammar/GovernorDrill';
import { IrabParseDrill } from '@/components/grammar/IrabParseDrill';
import { MutashabihatDrill } from '@/components/grammar/MutashabihatDrill';
import { LetterPad } from '@/components/ui/LetterPad';

type SessionItemType =
  | 'hifz'
  | 'vocabulary'
  | 'lesson'
  | 'function_word'
  | 'intensive'
  | 'production'
  | 'elided'
  | 'freeflow'
  | 'root_lesson'
  | 'root_type'
  | 'governor'
  | 'irab_parse'
  | 'mutashabihat';
type Grade = 'again' | 'hard' | 'good' | 'easy';
type Reflection = 'recall' | 'particles' | 'meaning' | 'production';

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
}

interface ItemResult {
  itemId: string;
  grade?: Grade;
  correct?: boolean;
  seconds?: number;
  scheduled?: boolean;
}

interface Coverage {
  ayahsReadable: number;
  ayahsTotal: number;
  rootsKnown: number;
  nextRoots: { root: string; occurrences: number }[];
}

interface ReadingQueueItem {
  surah: number;
  ayah: number;
  blockingRoot: string;
  knownWords: number;
  totalWords: number;
  coveragePct: number;
}

interface FreeflowRun {
  surah: number;
  ayahFrom: number;
  ayahTo: number;
  ayahCount: number;
  estimatedSeconds: number;
}

const TYPE_LABEL: Record<SessionItemType, string> = {
  hifz: 'Hifz review',
  vocabulary: 'Vocabulary',
  lesson: 'Lesson',
  function_word: 'Function words',
  intensive: 'Intensive reading',
  production: 'Grammar production',
  elided: 'Implied subject',
  freeflow: 'Freeflow',
  root_lesson: 'Root family',
  root_type: 'Type the root',
  governor: 'Name the ʿāmil',
  irab_parse: 'Parse an ayah',
  mutashabihat: 'Near-identical ayahs',
};

const REFLECTIONS: { id: Reflection; label: string }[] = [
  { id: 'recall', label: 'Recalling the wording' },
  { id: 'particles', label: 'The small words (من، في، الذي…)' },
  { id: 'meaning', label: 'What the ayah means' },
  { id: 'production', label: 'Putting the vowels on' },
];

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function displayArabic(value: string): string {
  if (/[\u0600-\u06FF]/.test(value)) return value;
  return rootToArabic(value) || value;
}

function gradePadRoot(given: string, expected: string): boolean {
  const fold = (s: string) =>
    s
      .replace(/\s+/g, '')
      .normalize('NFC')
      .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '')
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      .replace(/\u0624/g, '\u0648')
      .replace(/\u0626/g, '\u064A')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647');
  return fold(given) === fold(expected);
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
  const [reflecting, setReflecting] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);
  const [typedRoot, setTypedRoot] = useState('');
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [reading, setReading] = useState<ReadingQueueItem | null>(null);

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

  const finish = async (finalResults: ItemResult[], reflection?: Reflection) => {
    if (!plan) return;
    setFinishing(true);
    setSaveError(null);
    try {
      await apiPost('/api/session/complete', {
        sessionId: plan.sessionId,
        results: finalResults,
        actualSeconds: Math.round((Date.now() - startedAt) / 1000),
        reflection: reflection ?? null,
      });
      const [cov, queue] = await Promise.allSettled([
        apiFetch<{ data: Coverage }>('/api/progress/coverage'),
        apiFetch<{ data: { items: ReadingQueueItem[] } }>('/api/progress/reading-queue?limit=1'),
      ]);
      if (cov.status === 'fulfilled') setCoverage(cov.value.data);
      if (queue.status === 'fulfilled') {
        setReading(queue.value.data?.items?.[0] ?? null);
      }
      setDone(true);
      setReflecting(false);
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
    if (index + 1 >= total) {
      setReflecting(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Building today’s session…</p>
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
    const nextRoot = coverage?.nextRoots?.[0];
    return (
      <div className="page-transition mx-auto max-w-2xl space-y-6">
        <Card className="border-gold-500/40 py-10 text-center">
          <p className="text-xs uppercase tracking-label text-gold-400">Session complete</p>
          <h1 className="mt-2 font-display text-3xl">Well done</h1>
          <p className="mt-2 text-sm text-ground-300">
            {results.length === 0
              ? 'Nothing was queued today.'
              : `You worked through ${results.length} piece${results.length === 1 ? '' : 's'}.`}
          </p>
          {coverage && (
            <div className="mt-6">
              <p className="text-3xl font-bold text-gold-400">
                {coverage.ayahsReadable.toLocaleString()}
              </p>
              <p className="text-sm text-ground-400">
                of {coverage.ayahsTotal.toLocaleString()} ayahs within reach ·{' '}
                {coverage.rootsKnown} roots known
              </p>
            </div>
          )}
          {nextRoot && (
            <p className="mt-4 text-sm text-ground-300">
              Next root that unlocks the most text:{' '}
              <span className="text-arabic text-gold-400" dir="rtl" lang="ar">
                {rootToArabic(nextRoot.root)}
              </span>
            </p>
          )}
          {reading && (
            <p className="mt-2 text-sm text-ground-400">
              Just past the edge: {getSurah(reading.surah)?.name ?? `Surah ${reading.surah}`}{' '}
              {reading.ayah} · {reading.coveragePct}%
            </p>
          )}
          <div className="mt-8">
            <Link href="/today" className="block">
              <Button className="w-full">Back to Today</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (reflecting && plan) {
    return (
      <div className="page-transition mx-auto max-w-2xl space-y-6">
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">Before you go</p>
          <h1 className="mt-2 font-display text-2xl">What felt hardest?</h1>
          <p className="mt-2 text-sm text-ground-300">
            Tomorrow’s mix starts from this. One tap.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {REFLECTIONS.map((r) => (
              <Button
                key={r.id}
                variant="secondary"
                className="w-full"
                disabled={finishing}
                onClick={() => finish(results, r.id)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          {saveError && (
            <p className="mt-4 text-sm text-ground-100">{saveError}</p>
          )}
        </Card>
      </div>
    );
  }

  if (!current || !plan) return null;

  const word = asString(current.payload.word);
  const meaning = asString(current.payload.meaning);
  const transliteration = asString(current.payload.transliteration);
  const source = sourceLine(current.payload);

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

      {current.type === 'hifz' && (
        <ReviewSession
          entry={{
            id: String(current.payload.memorizationId ?? ''),
            surah_id: Number(current.payload.surahId),
            ayah_from: Number(current.payload.ayahFrom),
            ayah_to: Number(current.payload.ayahTo),
            status: String(current.payload.status ?? 'learning'),
            ayah_text:
              asString(current.payload.textUthmani) ??
              asString(current.payload.textSimple) ??
              undefined,
          }}
          onComplete={(grade) =>
            recordAndAdvance({
              itemId: current.id,
              grade,
              seconds: current.estimatedSeconds,
              scheduled: true,
            })
          }
          onSkip={() => recordAndAdvance({ itemId: current.id, seconds: 0 })}
        />
      )}

      {current.type === 'vocabulary' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">
            {TYPE_LABEL.vocabulary}
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
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
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
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
        </Card>
      )}

      {current.type === 'function_word' && (
        <div className="space-y-4">
          {asString(current.payload.lemma) ? (
            <Card>
              <p className="text-xs uppercase tracking-label text-gold-400">
                {TYPE_LABEL.function_word}
              </p>
              <p className="mt-3 text-center text-3xl" dir="rtl" lang="ar">
                {String(current.payload.lemma)}
              </p>
              <p className="mt-2 text-center text-sm text-ground-300">
                {String(current.payload.pos)} · {String(current.payload.occurrences)} times
              </p>
              <Button
                className="mt-4 w-full"
                onClick={async () => {
                  await apiPost(
                    `/api/progress/function-words/${encodeURIComponent(String(current.payload.lemma))}/${encodeURIComponent(String(current.payload.pos))}/known`,
                    {}
                  );
                  recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds });
                }}
              >
                Mark known
              </Button>
            </Card>
          ) : (
            <FunctionWords compact />
          )}
          <Button
            className="w-full"
            onClick={() =>
              recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
            }
          >
            Continue
          </Button>
        </div>
      )}

      {current.type === 'intensive' && (
        <IntensiveCard
          onContinue={() =>
            recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
          }
        />
      )}

      {current.type === 'production' && (
        <div className="space-y-4">
          <TashkilDrill />
          <Button
            className="w-full"
            onClick={() =>
              recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
            }
          >
            Continue
          </Button>
        </div>
      )}

      {current.type === 'elided' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.elided}</p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <div className="mt-4">
            <ElidedSubjectDrill
              onDone={() =>
                recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
              }
            />
          </div>
        </Card>
      )}

      {current.type === 'freeflow' && (
        <FreeflowCard
          onContinue={() =>
            recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
          }
        />
      )}

      {current.type === 'lesson' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.lesson}</p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <p className="mt-4 text-sm text-ground-300">
            Open the lesson and work through it. Coming back here only records that
            you reached it.
          </p>
          <Link href={`/learning?lesson=${current.payload.lessonId}`} className="mt-4 block">
            <Button variant="secondary" className="w-full">
              Open lesson
            </Button>
          </Link>
          <Button
            className="mt-2 w-full"
            onClick={() =>
              recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
            }
          >
            Continue
          </Button>
        </Card>
      )}

      {current.type === 'root_lesson' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.root_lesson}</p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <Link href={`/learning?lesson=${current.payload.lessonId}`} className="mt-4 block">
            <Button variant="secondary" className="w-full">
              Open root lesson
            </Button>
          </Link>
          <Button
            className="mt-2 w-full"
            onClick={() =>
              recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
            }
          >
            Continue
          </Button>
        </Card>
      )}

      {current.type === 'root_type' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.root_type}</p>
          <h2 className="mt-1.5 text-xl font-semibold">Type the root</h2>
          <div className="mt-4">
            <LetterPad value={typedRoot} onChange={setTypedRoot} />
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => {
              const expected = asString(current.payload.expectedRoot) ?? '';
              recordAndAdvance({
                itemId: current.id,
                correct: gradePadRoot(typedRoot, expected),
                seconds: current.estimatedSeconds,
              });
              setTypedRoot('');
            }}
          >
            Check
          </Button>
        </Card>
      )}

      {current.type === 'mutashabihat' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">
            {TYPE_LABEL.mutashabihat}
          </p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <div className="mt-4">
            <MutashabihatDrill
              onDone={() =>
                recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
              }
            />
          </div>
        </Card>
      )}

      {current.type === 'governor' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.governor}</p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <div className="mt-4">
            <GovernorDrill
              onDone={() =>
                recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
              }
            />
          </div>
        </Card>
      )}

      {current.type === 'irab_parse' && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{TYPE_LABEL.irab_parse}</p>
          <h2 className="mt-1.5 text-xl font-semibold">{current.label}</h2>
          <div className="mt-4">
            <IrabParseDrill
              onDone={() =>
                recordAndAdvance({ itemId: current.id, seconds: current.estimatedSeconds })
              }
            />
          </div>
        </Card>
      )}

      {saveError && (
        <Card>
          <p className="mb-2 text-sm text-ground-100">{saveError}</p>
          <Button variant="secondary" disabled={finishing} onClick={() => finish(results)}>
            Retry save
          </Button>
        </Card>
      )}

      {current.type !== 'hifz' && (
        <div className="text-center">
          <button
            type="button"
            className="text-sm text-ground-400 hover:text-ground-300"
            onClick={() => recordAndAdvance({ itemId: current.id, seconds: 0 })}
          >
            Skip this item
          </button>
        </div>
      )}
    </div>
  );
}

function IntensiveCard({ onContinue }: { onContinue: () => void }) {
  const [item, setItem] = useState<ReadingQueueItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: { items: ReadingQueueItem[] } }>(
          '/api/progress/reading-queue?limit=1'
        );
        if (!cancelled) setItem(res.data?.items?.[0] ?? null);
      } catch {
        if (!cancelled) setItem(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <p className="text-xs uppercase tracking-label text-gold-400">Intensive reading</p>
      <h2 className="mt-1.5 text-xl font-semibold">Just past your edge</h2>
      {loading ? (
        <p className="mt-3 text-sm text-ground-300">Finding an ayah…</p>
      ) : item ? (
        <>
          <p className="mt-2 text-sm text-ground-300">
            {getSurah(item.surah)?.name ?? `Surah ${item.surah}`} {item.ayah} ·{' '}
            {item.knownWords} of {item.totalWords} words · {item.coveragePct}%
          </p>
          <p className="mt-1 text-sm text-ground-400">
            Blocking root:{' '}
            <span className="text-arabic text-gold-400" dir="rtl" lang="ar">
              {rootToArabic(item.blockingRoot)}
            </span>
          </p>
          <Link href={`/read?s=${item.surah}&a=${item.ayah}`} className="mt-4 block">
            <Button variant="secondary" className="w-full">
              Read this ayah
            </Button>
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm text-ground-300">
          No i+1 ayah yet. Mark a few roots first.
        </p>
      )}
      <Button className="mt-4 w-full" onClick={onContinue}>
        Continue
      </Button>
    </Card>
  );
}

function FreeflowCard({ onContinue }: { onContinue: () => void }) {
  const [run, setRun] = useState<FreeflowRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: { runs: FreeflowRun[] } }>(
          '/api/progress/freeflow?minWords=20'
        );
        if (!cancelled) setRun(res.data?.runs?.[0] ?? null);
      } catch {
        if (!cancelled) setRun(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <p className="text-xs uppercase tracking-label text-gold-400">Freeflow</p>
      <h2 className="mt-1.5 text-xl font-semibold">Read a page you already know</h2>
      {loading ? (
        <p className="mt-3 text-sm text-ground-300">Finding a run…</p>
      ) : run ? (
        <>
          <p className="mt-2 text-sm text-ground-300">
            {getSurah(run.surah)?.name ?? `Surah ${run.surah}`} {run.ayahFrom}–{run.ayahTo} ·{' '}
            {run.ayahCount} ayahs
          </p>
          <Link
            href={`/read?s=${run.surah}&a=${run.ayahFrom}&ayahTo=${run.ayahTo}&continuous=1`}
            className="mt-4 block"
          >
            <Button variant="secondary" className="w-full">
              Play continuously
            </Button>
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm text-ground-300">
          No 98% run yet. Freeflow appears once a stretch of ayahs is already readable.
        </p>
      )}
      <Button className="mt-4 w-full" onClick={onContinue}>
        Continue
      </Button>
    </Card>
  );
}
