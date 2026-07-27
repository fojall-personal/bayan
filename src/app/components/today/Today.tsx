'use client';

// The home screen.
//
// This replaces a dashboard of eight equal tiles. Every value here comes from an
// endpoint that already existed — /api/memorization/review/today for what is due,
// /api/learning/next for the next unlocked lesson, /api/progress/coverage for how
// much of the text is within reach. The machinery for "here is your next thing"
// was complete; nothing was using it, and the entry point showed a goal picker.
//
// One primary action, chosen by what is actually due rather than by a grid. A
// dashboard of equal cards is how you avoid deciding what matters — anti-slop
// tells 3 and 11, both feature-tile grids.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { rootToArabic as rootArabic } from '@/lib/arabic-root';
import { apiFetch, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';

interface Coverage {
  ayahsReadable: number;
  ayahsTotal: number;
  ayahsReadablePct: number;
  rootsKnown: number;
  rootsTotal: number;
  segmentsKnownPct: number;
  surahsReadable: number;
  surahsTotal: number;
  nextRoots: { root: string; occurrences: number }[];
}

interface DueItem {
  id: string;
  surah_id: number;
  ayah_from: number;
  ayah_to: number;
}

interface NextLesson {
  id: string;
  title: string;
  level: number;
  estimated_minutes?: number;
}


/** One ayah from GET /api/progress/reading-queue. */
interface ReadingQueueItem {
  surah: number;
  ayah: number;
  text: string | null;
  blockingRoot: string;
  rootOccurrences: number;
  knownWords: number;
  totalWords: number;
  coveragePct: number;
}

export function Today() {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [due, setDue] = useState<DueItem[]>([]);
  const [reading, setReading] = useState<ReadingQueueItem[]>([]);
  const [lesson, setLesson] = useState<NextLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Settled rather than all: a learner with no memorization rows should still
    // see their coverage and next lesson, not a single error for the whole page.
    const [cov, dueRes, next, queue] = await Promise.allSettled([
      apiFetch<{ data: Coverage }>('/api/progress/coverage'),
      apiFetch<{ data: DueItem[] }>('/api/memorization/review/today'),
      apiFetch<{ data: { lesson: NextLesson | null } }>('/api/learning/next'),
      apiFetch<{ data: { items: ReadingQueueItem[] } }>(
        '/api/progress/reading-queue?limit=3'
      ),
    ]);
    if (cov.status === 'fulfilled') setCoverage(cov.value.data);
    else setError(apiErrorMessage(cov.reason));
    if (dueRes.status === 'fulfilled') setDue(dueRes.value.data ?? []);
    if (next.status === 'fulfilled') setLesson(next.value.data?.lesson ?? null);
    if (queue.status === 'fulfilled') setReading(queue.value.data?.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Working out what is due…</p>
      </Card>
    );
  }

  const dueCount = due.length;
  const nextRoot = coverage?.nextRoots?.[0];

  return (
    <div className="page-transition mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl">Today</h1>
        {coverage && (
          <p className="mt-1 text-sm text-ground-300">
            {coverage.ayahsReadable.toLocaleString()} of{' '}
            {coverage.ayahsTotal.toLocaleString()} ayahs within reach ·{' '}
            {coverage.rootsKnown} root{coverage.rootsKnown === 1 ? '' : 's'} known
          </p>
        )}
      </div>

      {error && (
        <Card>
          <p className="mb-3 text-sm text-ground-300">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {/* Coverage starts empty, and a learner who already reads some Arabic should
          not have to click "I know this root" a hundred times to say so. Offered
          rather than forced, and only while it is still true. */}
      {coverage && coverage.rootsKnown === 0 && (
        <Card className="border-gold-500/40">
          <p className="text-xs uppercase tracking-label text-gold-400">First</p>
          <h2 className="mt-1.5 text-xl font-semibold">Which roots do you already know?</h2>
          <p className="mt-1 text-sm text-ground-300">
            Twelve questions, about a minute. Everything on this page counts from the
            answers, so it is worth doing before anything else.
          </p>
          <Link href="/calibrate" className="mt-4 block">
            <Button className="w-full">Start</Button>
          </Link>
        </Card>
      )}

      {/* ── The one primary action ──────────────────────────────────────────
          Chosen, not offered alongside seven equals. Reviews first because SM-2
          decides when they are due and a missed review costs retention; the next
          root only when nothing is owed. */}
      {dueCount > 0 ? (
        <Card className="border-gold-500/40">
          <p className="text-xs uppercase tracking-label text-gold-400">Next</p>
          <h2 className="mt-1.5 text-xl font-semibold">
            {dueCount} {dueCount === 1 ? 'passage' : 'passages'} due for review
          </h2>
          <p className="mt-1 text-sm text-ground-300">
            {due
              .slice(0, 3)
              .map((d) => {
                const s = getSurah(d.surah_id);
                const range =
                  d.ayah_from === d.ayah_to
                    ? `${d.ayah_from}`
                    : `${d.ayah_from}–${d.ayah_to}`;
                return `${s?.name ?? `Surah ${d.surah_id}`} ${range}`;
              })
              .join(' · ')}
            {dueCount > 3 ? ` and ${dueCount - 3} more` : ''}
          </p>
          <Link href="/memorization" className="mt-4 block">
            <Button className="w-full">Start review</Button>
          </Link>
        </Card>
      ) : nextRoot ? (
        <Card className="border-gold-500/40">
          <p className="text-xs uppercase tracking-label text-gold-400">Next</p>
          <h2 className="mt-1.5 text-xl font-semibold">Learn one new root</h2>
          <p className="text-arabic mt-3 text-center text-4xl text-gold-400" dir="rtl" lang="ar">
            {rootArabic(nextRoot.root)}
          </p>
          <p className="mt-2 text-sm text-ground-300">
            The commonest root you do not know yet — it appears{' '}
            {nextRoot.occurrences.toLocaleString()} times in the Quran.
          </p>
          <Link href={`/root?r=${encodeURIComponent(nextRoot.root)}`} className="mt-4 block">
            <Button className="w-full">Study this root</Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <h2 className="text-xl font-semibold">Nothing is due</h2>
          <p className="mt-1 text-sm text-ground-300">
            Reviews are scheduled, not invented to fill the slot. Read something, or
            add an ayah to memorize.
          </p>
        </Card>
      )}

      {/* ── Then ────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-xs uppercase tracking-label text-ground-400">Then</h3>
        <div className="space-y-3">
          {/* Always present. Rendering this only when the API returns a next
              lesson made the lesson path unreachable once every lesson was done,
              or whenever that call failed — and "Learn" is no longer in the nav. */}
          <Link href="/learning" className="block">
            <Card interactive>
              <p className="font-semibold">{lesson ? lesson.title : 'Grammar lessons'}</p>
              <p className="mt-0.5 text-sm text-ground-300">
                {lesson
                  ? `Level ${lesson.level}${lesson.estimated_minutes ? ` · ${lesson.estimated_minutes} min` : ''}`
                  : 'The authored path — ten lessons, each gated on the one before'}
              </p>
            </Card>
          </Link>
          <Link href="/grammar" className="block">
            <Card interactive>
              <p className="font-semibold">Practise grammar</p>
              <p className="mt-0.5 text-sm text-ground-300">
                Corpus-derived exercises, graded by how common the word is
              </p>
            </Card>
          </Link>
          <Link href="/read?s=1&a=1" className="block">
            <Card interactive>
              <p className="font-semibold">Read an ayah</p>
              <p className="mt-0.5 text-sm text-ground-300">
                Recite, meaning, parse, memorize or ask — one ayah, five lenses
              </p>
            </Card>
          </Link>
        </div>
      </div>

      {/* ── Just past the edge ──────────────────────────────────────────── */}
      {reading.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-label text-ground-400">
            Just past your edge
          </p>
          <div className="space-y-2">
            {reading.map((r) => (
              <Link key={`${r.surah}:${r.ayah}`} href={`/read?s=${r.surah}&a=${r.ayah}`} className="block">
                <Card interactive>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">
                      {getSurah(r.surah)?.name ?? `Surah ${r.surah}`} {r.surah}:{r.ayah}
                    </p>
                    {/* The number, so the claim is checkable rather than a vibe. */}
                    <span className="shrink-0 text-xs text-ground-400">
                      {r.knownWords} of {r.totalWords} words · {r.coveragePct}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ground-300">
                    One root away:{' '}
                    <span className="text-arabic text-gold-400" dir="rtl" lang="ar">
                      {rootArabic(r.blockingRoot)}
                    </span>
                    {' '}— {r.rootOccurrences.toLocaleString()} occurrence
                    {r.rootOccurrences === 1 ? '' : 's'} in the Quran
                  </p>
                </Card>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-xs text-ground-400">
            Reading is productive at around 95% of words known — below that it is a
            wall, above it there is nothing new. These sit at the edge.
          </p>
        </div>
      )}

      {/* ── Coverage, stated plainly ────────────────────────────────────── */}
      {coverage && (
        <Card>
          <h3 className="mb-4 text-xs uppercase tracking-label text-ground-400">
            How much of the Quran you can read
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: 'Ayahs',
                value: coverage.ayahsReadable.toLocaleString(),
                sub: `of ${coverage.ayahsTotal.toLocaleString()} · ${coverage.ayahsReadablePct}%`,
              },
              {
                label: 'Roots',
                value: coverage.rootsKnown.toLocaleString(),
                sub: `of ${coverage.rootsTotal.toLocaleString()}`,
              },
              {
                label: 'Words met',
                value: `${coverage.segmentsKnownPct}%`,
                sub: 'of all rooted words',
              },
              {
                label: 'Whole surahs',
                value: coverage.surahsReadable.toLocaleString(),
                // Measured: the first surah to complete is Al-Kafirun at the 114
                // commonest roots, and the second does not arrive until ~417. A bare
                // "0 of 114" reads as failure, so say what it takes.
                sub:
                  coverage.surahsReadable === 0
                    ? 'first at ~114 roots (Al-Kafirun)'
                    : `of ${coverage.surahsTotal}`,
              },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xs uppercase tracking-label text-ground-400">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-gold-400">{s.value}</p>
                <p className="text-xs text-ground-400">{s.sub}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-ground-400">
            An ayah counts once every rooted word in it has a root you know. 63 roots
            cover half the rooted words in the Quran, and 400 make half of all ayahs
            readable end to end. Whole surahs come much later — they need every rare
            word too, so ayahs are the metric that actually moves.
          </p>
          {/* Always reachable, not only while coverage is zero. Someone who skipped
              calibration, or whose estimate came out wrong, previously had no way
              back to it — /calibrate worked but nothing linked to it. */}
          <p className="mt-3 text-xs">
            <Link href="/calibrate" className="text-gold-400 hover:underline">
              {coverage.rootsKnown === 0
                ? 'Tell us which roots you already know →'
                : 'Recheck which roots you know →'}
            </Link>
          </p>
        </Card>
      )}
    </div>
  );
}
