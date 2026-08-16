'use client';

// The ayah as one object, seen through five lenses.
//
// Reciting, reading, parsing, memorizing and asking about an ayah were five pages,
// each with its own surah picker, each making you navigate away and find your place
// again. They are lenses on one thing. This is that thing.
//
// One API call — GET /api/quran/ayah/:surah/:ayah — returns the text, the words
// with gloss and parse and a known-root flag, and the tajweed tags. The unknown-word
// marking is the coverage model made visible where you actually read: "2 words to
// learn" is a specific, finishable task, and tapping one offers its root.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { AyahAudioButton, type AyahAudioHandle } from '@/components/audio/AyahAudioButton';
import { ayahWordClass, reciterById, TIMED_RECITERS, DEFAULT_RECITER } from '@/lib/ayah-audio';
import { segmentVerse } from '@/lib/tajweed-render';
import { rootToArabic as rootArabic } from '@/lib/arabic-root';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { SURAHS, getSurah } from '@/lib/surahs';
import { nextInRun } from '@/lib/freeflow-run';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type Lens = 'recite' | 'meaning' | 'parse' | 'memorize' | 'ask';

interface Segment {
  index: number;
  arabic: string | null;
  root: string | null;
  lemma: string | null;
  partOfSpeech: string | null;
  verbForm: string | null;
  aspect: string | null;
  case: string | null;
  gender: string | null;
  number: string | null;
  person: string | null;
  /**
   * What the word DOES — subject, object, predicate, possessor — from the treebank.
   * Null where the treebank records only structure for this segment.
   */
  role: string | null;
  /** The Arabic term, taken from the treebank rather than written here. */
  roleArabic: string | null;
}
interface Word {
  position: number;
  arabic: string | null;
  transliteration: string | null;
  english: string | null;
  roots: string[];
  known: boolean;
  unknownRoots: string[];
  segments: Segment[];
  /** Whole-Quran frequency of this word's root(s), commonest first. */
  rootOccurrences?: { root: string; occurrences: number }[];
  /** Where this word sounds in the recitation, or null if unaligned. */
  timing?: { startMs: number; endMs: number } | null;
}
interface TajweedTag {
  start: number;
  end: number;
  rule: string;
  color: string | null;
  category: string | null;
  categoryName: string | null;
}
interface Ayah {
  surah: number;
  ayah: number;
  ayahsInSurah: number | null;
  textUthmani: string;
  translation: string | null;
  words: Word[];
  /** Grammatically present, absent from the page — mostly the subject inside a verb. */
  elided?: {
    belongsToWord: number | null;
    role: string | null;
    roleArabic: string | null;
    arabic: string | null;
  }[];
  tajweed: TajweedTag[];
  wordsToLearn: number;
  fullyReadable: boolean;
}


const POS: Record<string, string> = {
  N: 'Noun', V: 'Verb', ADJ: 'Adjective', PN: 'Proper noun', P: 'Preposition',
  PRON: 'Pronoun', DET: 'Determiner', CONJ: 'Conjunction', REL: 'Relative pronoun',
  DEM: 'Demonstrative', NEG: 'Negative particle', INTG: 'Interrogative',
  ADV: 'Adverb', ACC: 'Accusative particle', RES: 'Restriction particle',
};

const LENSES: { id: Lens; label: string }[] = [
  { id: 'recite', label: 'Recite' },
  { id: 'meaning', label: 'Meaning' },
  { id: 'parse', label: 'Parse' },
  { id: 'memorize', label: 'Memorize' },
  { id: 'ask', label: 'Ask' },
];

/** Timings belong to a recording. The path is the same key the player uses. */
function ayahPath(surah: number, ayah: number, reciterPath: string): string {
  return `/api/quran/ayah/${surah}/${ayah}?reciter=${encodeURIComponent(reciterPath)}`;
}

export function AyahReader() {
  const router = useRouter();
  const params = useSearchParams();
  const surah = Math.min(114, Math.max(1, Number(params.get('s')) || 1));
  const ayah = Math.max(1, Number(params.get('a')) || 1);
  // Static surah metadata (name, ayah count) — available synchronously, no
  // fetch needed. Used below to default a continuous run's end to "the rest
  // of this surah" when no explicit ayahTo is given.
  const s = getSurah(surah);

  /**
   * Continuous reading mode: play a run of ayat at pace, advancing on each
   * ayah's real 'ended' event rather than a per-ayah router.push + refetch.
   *
   * `ayah` (above) is the run's first ayah; `ayahTo` is the last. Ordinary
   * single-ayah reading (continuousMode false) is completely unaffected by
   * everything below — `data`/`loading`/`error` still come from exactly one
   * fetch, exactly as before.
   *
   * Two different callers reach this mode, and neither has to pass every
   * param: the freeflow card (Today.tsx) always passes an explicit `ayahTo`
   * — a coverage-vetted run it already computed. The plain "play on
   * continuously" button below passes none, and gets the rest of the
   * current surah — no coverage requirement, because unlike freeflow this
   * is not claiming the ayat are already known, only that playback should
   * keep going.
   */
  const continuousMode = params.get('continuous') === '1';
  // Whether this run is freeflow's coverage-vetted range (explicit ayahTo) or
  // the unbounded "keep playing" button below (no ayahTo, defaults to the
  // rest of the surah) — the two mean different things and say so in the UI.
  const isVettedRun = params.get('ayahTo') !== null;
  const ayahTo = continuousMode
    ? Math.max(ayah, Number(params.get('ayahTo')) || s?.ayahCount || ayah)
    : ayah;

  const [data, setData] = useState<Ayah | null>(null);
  /** The whole prefetched run, only populated in continuous mode. */
  const [runAyahs, setRunAyahs] = useState<Ayah[] | null>(null);
  /** Position within runAyahs of the ayah currently shown/sounding. */
  const [runIndex, setRunIndex] = useState(0);
  const [runComplete, setRunComplete] = useState(false);
  /**
   * Playback position in milliseconds, or null when silent.
   *
   * Held here rather than inside the audio button because the highlight belongs to
   * the words, and the words are rendered by this component.
   */
  const [positionMs, setPositionMs] = useState<number | null>(null);
  // Continuous mode is about listening at pace, not parsing — default there,
  // but the tabs stay live; a learner mid-run may still want to check meaning
  // on one ayah. Lazy initializer: only the FIRST render's mode matters here,
  // matching how the rest of this component treats the URL as a starting
  // point rather than something re-read every render.
  const [lens, setLens] = useState<Lens>(() => (continuousMode ? 'recite' : 'meaning'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const audioRef = useRef<AyahAudioHandle>(null);
  // Timed reciters only. Husary is in RECITERS for full-ayah Play elsewhere;
  // he has no verified word alignment, so he is not a Read choice.
  const [reciterId, setReciterId] = useLocalStorage<string>(
    'bayan.reciter',
    DEFAULT_RECITER.id
  );
  const reciter = reciterById(reciterId);

  /** The ayah actually on screen: the run's current position in continuous
   * mode, the URL's ayah otherwise. Everything that displays or plays "the
   * current ayah" reads this, not the raw `ayah` param. */
  const currentAyah = continuousMode ? ayah + runIndex : ayah;

  const go = (s: number, a: number) => router.push(`/read?s=${s}&a=${a}`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRunComplete(false);
    try {
      if (continuousMode) {
        // One call per ayah, in parallel — the existing single-ayah endpoint,
        // no new backend work. Runs are short by construction: they only
        // exist because GET /api/progress/freeflow already filtered them to
        // a contiguous run above the 98% coverage threshold.
        const ayahNumbers = Array.from(
          { length: ayahTo - ayah + 1 },
          (_, i) => ayah + i
        );
        const results = await Promise.all(
          ayahNumbers.map((a) =>
            apiFetch<{ data: Ayah }>(ayahPath(surah, a, reciter.path))
          )
        );
        const run = results.map((r) => r.data);
        setRunAyahs(run);
        setRunIndex(0);
        setData(run[0] ?? null);
      } else {
        const res = await apiFetch<{ data: Ayah }>(ayahPath(surah, ayah, reciter.path));
        setRunAyahs(null);
        setData(res.data);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      setData(null);
      setRunAyahs(null);
    } finally {
      setLoading(false);
    }
  }, [surah, ayah, ayahTo, continuousMode, reciter.path]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Advances the run on the current ayah's real 'ended' event — never a
   * timer, never assumed. Only wired to AyahAudioButton when continuousMode
   * is true.
   */
  const handleAyahEnded = useCallback(() => {
    if (!runAyahs) return;
    const result = nextInRun({ surah, ayahFrom: ayah, ayahTo }, currentAyah);
    if (result.done) {
      setRunComplete(true);
      return;
    }
    const nextIndex = runIndex + 1;
    setRunIndex(nextIndex);
    setData(runAyahs[nextIndex] ?? null);
  }, [runAyahs, runIndex, surah, ayah, ayahTo, currentAyah]);

  /** Learn the root of a word you just hit, without leaving the ayah. */
  const learnRoot = async (root: string) => {
    setNotice(null);
    try {
      const res = await apiPost<{ data: { ayahsUnlocked: number; ayahsReadable: number } }>(
        `/api/progress/roots/${encodeURIComponent(root)}/known`,
        {}
      );
      const { ayahsUnlocked, ayahsReadable } = res.data;
      setNotice(
        `${rootArabic(root)} marked known — ${
          ayahsUnlocked > 0
            ? `${ayahsUnlocked} more ayah${ayahsUnlocked === 1 ? '' : 's'} now fully readable`
            : 'no new ayahs yet, but it counts toward the ones that need it'
        } · ${ayahsReadable.toLocaleString()} of 6,236`
      );
      load();
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  const total = data?.ayahsInSurah ?? s?.ayahCount ?? 1;

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Loading {surah}:{ayah}…</p>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-bold">Couldn&apos;t load {surah}:{ayah}</h2>
        <p className="mb-4 text-sm text-ground-300">{error}</p>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </Card>
    );
  }

  return (
    <div className="page-transition mx-auto max-w-3xl space-y-5">
      {/* Where you are, and how to move */}
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
        <Select
          label="Surah"
          value={String(surah)}
          onChange={(v) => go(Number(v), 1)}
          options={SURAHS.map((x) => ({
            value: String(x.id),
            label: `${x.id}. ${x.name} — ${x.translation}`,
          }))}
        />
        <Select
          label="Ayah"
          value={String(ayah)}
          onChange={(v) => go(surah, Number(v))}
          options={Array.from({ length: total }, (_, i) => ({
            value: String(i + 1),
            label: `Ayah ${i + 1}`,
          }))}
        />
        <Select
          label="Reciter"
          value={reciter.id}
          onChange={setReciterId}
          options={TIMED_RECITERS.map((r) => ({
            value: r.id,
            label: r.name,
          }))}
        />
      </div>

      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ground-300">
              {s?.name ?? `Surah ${surah}`} · {surah}:{currentAyah}
            </p>
            {/* The coverage model, at the only scale where it is actionable. */}
            <p
              className={`text-sm ${
                data.fullyReadable ? 'text-leaf-400' : 'text-gold-400'
              }`}
            >
              {data.fullyReadable
                ? 'every word known'
                : `${data.wordsToLearn} word${data.wordsToLearn === 1 ? '' : 's'} to learn`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <AyahAudioButton
              ref={audioRef}
              surah={surah}
              ayah={currentAyah}
              reciter={reciter}
              onPositionChange={setPositionMs}
              onEnded={continuousMode ? handleAyahEnded : undefined}
              autoPlay={continuousMode}
            />
            {/* Not the freeflow band (that requires 98% known coverage first,
                which most learners have not calibrated yet). This is unbounded
                — plays every ayah in the surah, one after another, whatever
                the coverage. A real <Link> rather than a state toggle, because
                autoplay-with-sound needs the click that navigates here to
                count as the user gesture (verified, see
                .hermes/plans/2026-08-10_CONTINUOUS-READ-for-orinth.md). */}
            {!continuousMode && (
              <Link
                href={`/read?s=${surah}&a=${ayah}&continuous=1`}
                aria-label={`Play ${s?.name ?? `surah ${surah}`} continuously from ${surah}:${ayah}`}
                title="Play on continuously from here"
                className="rounded-lg bg-leaf-500/10 px-3 py-2 text-sm text-leaf-400 transition-colors hover:bg-leaf-500/20"
              >
                ▶▶
              </Link>
            )}
          </div>
        </div>

        {/* The ayah. Amiri, lang="ar", leading-arabic — and tajweed colours only
            under the Recite lens, because colour means "recitation rule" and
            showing it while reading for meaning is noise. */}
        <p
          className="text-arabic text-center text-3xl leading-arabic"
          dir="rtl"
          lang="ar"
        >
          {lens === 'recite' ? (
            // segmentVerse splits the ayah at the annotation boundaries and returns
            // runs with a colour. Colour ONLY — no padding, background or radius —
            // because a span carrying horizontal padding breaks the Arabic cursive
            // join, which is how the old reader inflated بِسْمِ by 78% and rendered
            // its letters in isolated forms.
            segmentVerse(data.textUthmani, data.tajweed).map((seg, i) =>
              seg.color ? (
                <span key={i} style={{ color: seg.color }} title={seg.rule ?? undefined}>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )
          ) : data.words.length > 0 && data.words.every((w) => w.arabic) ? (
            data.words.map((w, i) => {
              const sounding =
                positionMs !== null &&
                Boolean(w.timing) &&
                positionMs >= w.timing!.startMs &&
                positionMs < w.timing!.endMs;
              const cls = ayahWordClass({ known: w.known, sounding });
              const playable = !continuousMode && w.timing;
              return (
                <span key={w.position}>
                  {i > 0 ? ' ' : ''}
                  {playable ? (
                    <button
                      type="button"
                      className={`m-0 cursor-pointer border-0 bg-transparent p-0 align-baseline ${cls}`}
                      onClick={() =>
                        audioRef.current?.playSlice(w.timing!.startMs, w.timing!.endMs)
                      }
                      aria-label={`Play word ${w.position}`}
                    >
                      {w.arabic}
                    </button>
                  ) : (
                    <span className={cls}>{w.arabic}</span>
                  )}
                </span>
              );
            })
          ) : (
            data.textUthmani
          )}
        </p>
        {lens === 'meaning' && (
          <p className="mt-2 text-center text-xs text-ground-400">
            Gold underline = a root you have not marked known.
          </p>
        )}

        {/* Word chips. Gold with a dotted underline means "you do not know this
            root yet" — a finishable list rather than a percentage. */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-3" dir="rtl">
          {data.words.map((w) => (
            <div
              key={w.position}
              className={`min-w-[86px] rounded-md text-center transition-colors ${
                // Sounding right now. Background rather than colour: colour already
                // means "root you do not know yet" in this grid, and two meanings on
                // one channel is how a legend stops being readable.
                positionMs !== null &&
                w.timing &&
                positionMs >= w.timing.startMs &&
                positionMs < w.timing.endMs
                  ? 'bg-leaf-500/20'
                  : ''
              }`}
            >
              <span
                className={`text-arabic block text-xl ${
                  w.known
                    ? 'text-ground-50'
                    : 'border-b border-dotted border-gold-500 pb-0.5 text-gold-400'
                }`}
                lang="ar"
              >
                {w.arabic}
              </span>
              <span className="mt-1 block text-[0.7rem] text-ground-400" dir="ltr">
                {w.english}
              </span>
              {w.unknownRoots.length > 0 && (
                <button
                  type="button"
                  onClick={() => learnRoot(w.unknownRoots[0])}
                  dir="ltr"
                  className="mt-1 min-h-9 rounded px-2 text-[0.68rem] text-gold-400 transition-colors hover:bg-gold-500/10"
                >
                  learn {rootArabic(w.unknownRoots[0])}
                </button>
              )}
            </div>
          ))}
        </div>

        {notice && (
          <p
            className="mt-5 rounded-md border border-leaf-500/50 bg-leaf-500/10 px-4 py-3 text-sm text-leaf-400"
            role="status"
          >
            {notice}
          </p>
        )}
      </Card>

      <Tabs
        label="Lens"
        value={lens}
        onChange={(v) => setLens(v as Lens)}
        items={LENSES.map((l) => ({ id: l.id, label: l.label }))}
      />

      <Card>
        {lens === 'recite' && <ReciteLens data={data} />}
        {lens === 'meaning' && <MeaningLens data={data} />}
        {lens === 'parse' && <ParseLens data={data} />}
        {lens === 'memorize' && <MemorizeLens surah={surah} ayah={currentAyah} />}
        {lens === 'ask' && <AskLens surah={surah} ayah={currentAyah} />}
      </Card>

      {continuousMode ? (
        runComplete ? (
          // Deliberately does not auto-loop or auto-navigate — Refold's "only
          // mining, never freeflowing" framing is about a learner CHOOSING pace
          // reading, not the app deciding what plays next indefinitely.
          <Card className="border-leaf-500/40 text-center">
            <p className="text-xs uppercase tracking-label text-leaf-400">Run complete</p>
            <h2 className="mt-1.5 text-xl font-semibold">
              {s?.name ?? `Surah ${surah}`} {ayah}–{ayahTo}
            </h2>
            <p className="mt-1 text-sm text-ground-300">
              {ayahTo - ayah + 1} ayahs
              {isVettedRun ? ', at speed, no lookups.' : ' played through.'}
            </p>
            <Link href="/today" className="mt-4 block">
              <Button className="w-full">Back to Today</Button>
            </Link>
          </Card>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-ground-400">
              ayah {runIndex + 1} of {ayahTo - ayah + 1} in this run
            </span>
            <Button variant="secondary" onClick={() => go(surah, currentAyah)}>
              Exit
            </Button>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            disabled={ayah <= 1}
            onClick={() => go(surah, ayah - 1)}
          >
            ← Previous
          </Button>
          <span className="text-sm text-ground-400">
            {ayah} of {total}
          </span>
          <Button
            variant="secondary"
            disabled={ayah >= total}
            onClick={() => go(surah, ayah + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}

function ReciteLens({ data }: { data: Ayah }) {
  const legend = new Map<string, { name: string; color: string }>();
  for (const t of data.tajweed) {
    if (t.category && t.color && !legend.has(t.category)) {
      legend.set(t.category, { name: t.categoryName ?? t.category, color: t.color });
    }
  }
  if (legend.size === 0) {
    return (
      <p className="text-sm text-ground-300">
        The corpus annotates no recitation rules in this ayah.
      </p>
    );
  }
  return (
    <div>
      <h3 className="mb-3 text-xs uppercase tracking-label text-ground-400">
        Rules in this ayah
      </h3>
      <div className="flex flex-wrap gap-3">
        {[...legend.entries()].map(([cat, v]) => (
          <span key={cat} className="flex items-center gap-2 text-sm text-ground-300">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: v.color }}
            />
            {v.name}
          </span>
        ))}
      </div>
      {/* /tajweed is the whole-surah reader and is deliberately not in the nav —
          this is the point in the journey where someone wants it: they have
          understood the ayah and now want to recite through the surah. */}
      <p className="mt-4 text-xs text-ground-400">
        <Link href="/tajweed" className="text-gold-400 hover:underline">
          Recite the whole surah with colours →
        </Link>
      </p>
    </div>
  );
}

function MeaningLens({ data }: { data: Ayah }) {
  return (
    <div>
      <h3 className="mb-3 text-xs uppercase tracking-label text-ground-400">
        Word by word
      </h3>
      <ul className="divide-y divide-ground-800">
        {data.words.map((w) => (
          <li key={w.position} className="flex items-baseline gap-4 py-2">
            <span className="text-arabic min-w-[6rem] text-lg" dir="rtl" lang="ar">
              {w.arabic}
            </span>
            <span className="flex-1 text-sm text-ground-200">{w.english}</span>
            <span className="text-xs text-ground-400">{w.transliteration}</span>
          </li>
        ))}
      </ul>
      {/* The translation is a separate claim from the gloss chain, so it gets its
          own block rather than sitting in the caption. A gloss chain read as prose
          is what made three glosses look wrong earlier when they were fine in
          sequence — worth keeping the two visually distinct. */}
      {data.translation ? (
        <div className="mt-5 border-t border-ground-800 pt-4">
          <h3 className="mb-2 text-xs uppercase tracking-label text-ground-400">
            Translation
          </h3>
          <p className="text-sm leading-relaxed text-ground-200">{data.translation}</p>
          <p className="mt-2 text-xs text-ground-400">
            Saheeh International, via tanzil.net. The word-by-word list above is a
            parsing aid and is meant to be read in sequence, not as a sentence.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ground-400">
          Word-by-word glosses only — no translation stored for this ayah.
        </p>
      )}
    </div>
  );
}

function ParseLens({ data }: { data: Ayah }) {
  return (
    <div>
      <h3 className="mb-1 text-xs uppercase tracking-label text-ground-400">
        What the corpus states
      </h3>
      {/* The two sources are NOT of equal standing, and this heading used to imply they
          were — everything under it came from hand-verified morphology until the roles
          arrived. Those come from a treebank whose parser reports 95.7% LAS, so roughly
          one role in twenty-three is wrong.
          The exercise bank handles this by emitting only items where the role and the
          hand-verified case concur. A reference display cannot filter the same way without
          blanking every pronoun and verb — they carry no case — so it says so instead.
          Stating the provenance is the honest option; presenting a parser's output as
          settled fact under this heading is not. */}
      <p className="mb-3 text-xs text-ground-400">
        Morphology from the Quranic Arabic Corpus, hand-verified. Grammatical roles
        (shown in gold) from the Extended Quranic Treebank, where a parser supplied
        much of the syntax — accurate to about 96%, so treat a surprising role as a
        question rather than a verdict.
      </p>
      <div className="space-y-3">
        {data.words.map((w) => (
          <div key={w.position} className="rounded-md border border-ground-800 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-arabic text-lg" dir="rtl" lang="ar">
                {w.arabic}
              </span>
              <span className="text-xs text-ground-400">word {w.position}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {w.segments.map((seg) => {
                const facts = [
                  seg.partOfSpeech ? (POS[seg.partOfSpeech] ?? seg.partOfSpeech) : null,
                  seg.root
                    ? `root ${rootArabic(seg.root)}` +
                      // The frequency is the argument for learning it: a root
                      // occurring 854 times repays an afternoon, one occurring twice
                      // does not. Al Quran by Greentech shows this for free and it
                      // was the one thing this reader lacked.
                      (() => {
                        const n = w.rootOccurrences?.find((r) => r.root === seg.root)
                          ?.occurrences;
                        return n ? ` (${n.toLocaleString()}×)` : '';
                      })()
                    : null,
                  seg.lemma ? `lemma ${seg.lemma}` : null,
                  seg.verbForm ? `Form ${seg.verbForm}` : null,
                  seg.aspect,
                  seg.case,
                  seg.gender,
                  seg.number,
                  seg.person,
                ].filter(Boolean);
                return (
                  <li key={seg.index} className="text-sm text-ground-300">
                    {facts.length > 0 ? (
                      facts.join(' · ')
                    ) : (
                      // Honest absence. The corpus leaves prefixes largely
                      // unannotated, and guessing would be worse than saying so.
                      <span className="text-ground-400">not annotated</span>
                    )}
                    {/* What the word DOES, on its own line and in the accent colour,
                        because it is a different KIND of fact from the ones above: those
                        describe the word in isolation, this one describes its job in this
                        sentence. It also comes from a different source, and one whose
                        parser is 95.7% accurate — so it is never the only thing shown. */}
                    {seg.role && (
                      <div className="mt-1 text-gold-400">
                        {seg.roleArabic && (
                          <span className="text-arabic" dir="rtl" lang="ar">
                            {seg.roleArabic}
                          </span>
                        )}
                        {seg.roleArabic ? ' — ' : ''}
                        {seg.role}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Elided words: grammatically present, never written.
          Arabic carries the subject inside its verb, so نَعْبُدُ means "WE worship" with no
          separate word for "we" — and a reader looking for one finds nothing. This is the
          only part of the parse that cannot be pointed at on the page, which is exactly
          why it is worth saying out loud. */}
      {(data.elided?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-md border border-ground-800 p-3">
          <h4 className="mb-2 text-xs uppercase tracking-label text-ground-400">
            Implied, not written (حذف)
          </h4>
          <ul className="space-y-1">
            {data.elided!.map((e, i) => (
              <li key={i} className="text-sm text-ground-300">
                {e.arabic && (
                  <span className="text-arabic text-gold-400" dir="rtl" lang="ar">
                    {e.arabic}
                  </span>
                )}{' '}
                <span className="text-ground-400">
                  {e.roleArabic ? `${e.roleArabic} — ` : ''}
                  {e.role ?? 'implied'}
                  {e.belongsToWord ? `, inside word ${e.belongsToWord}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MemorizeLens({ surah, ayah }: { surah: number; ayah: number }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const add = async () => {
    setState('saving');
    try {
      await apiPost('/api/memorization/add', {
        surahId: surah,
        ayahFrom: ayah,
        ayahTo: ayah,
      });
      setState('done');
      setMessage('Added. Reviews are scheduled automatically from here.');
    } catch (err) {
      setState('error');
      setMessage(apiErrorMessage(err));
    }
  };

  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-label text-ground-400">
        Add to your schedule
      </h3>
      <p className="mb-4 text-sm text-ground-300">
        Adds {surah}:{ayah} on its own. Spaced review decides when it comes back —
        you never pick the date.
      </p>
      <Button onClick={add} disabled={state === 'saving' || state === 'done'}>
        {state === 'saving' ? 'Adding…' : state === 'done' ? 'Added' : 'Memorize this ayah'}
      </Button>
      {message && (
        <p
          className={`mt-3 text-sm ${state === 'error' ? 'text-error' : 'text-leaf-400'}`}
          role="status"
        >
          {message}
        </p>
      )}
      <p className="mt-4 text-xs text-ground-400">
        Longer passages, and the ordered curriculum across all 114 surahs, are on{' '}
        <Link href="/memorization" className="text-gold-400 hover:underline">
          Memorize
        </Link>
        .
      </p>
    </div>
  );
}

function AskLens({ surah, ayah }: { surah: number; ayah: number }) {
  const [question, setQuestion] = useState(`${surah}:${ayah}`);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setAnswer(null);
    try {
      const res = await apiPost<{ data?: { reply?: string }; reply?: string }>(
        '/api/tutor/chat',
        { message: question }
      );
      setAnswer(res.data?.reply ?? res.reply ?? 'No answer returned.');
    } catch (err) {
      setAnswer(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-label text-ground-400">
        Ask about this ayah
      </h3>
      {/* Pre-scoped to the location. The tutor already classifies "2:255" as a
          location intent, so the default question is the one you are looking at. */}
      <label htmlFor="ask-input" className="mb-1 block text-sm text-ground-300">
        Question
      </label>
      <input
        id="ask-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="w-full rounded-md border border-ground-700 bg-ground-900 px-3 py-2 text-sm text-ground-50 focus:border-gold-500"
        dir="auto"
      />
      <Button className="mt-3" onClick={ask} disabled={busy || !question.trim()}>
        {busy ? 'Asking…' : 'Ask'}
      </Button>
      {answer && (
        <p dir="auto" className="text-naskh mt-4 whitespace-pre-wrap text-sm text-ground-200">
          {answer}
        </p>
      )}
      <p className="mt-4 text-xs text-ground-400">
        Answers come from the corpus record — a word, a root, a location, or a named
        tajweed rule. It refuses rather than guessing when the corpus is silent.
      </p>
    </div>
  );
}
