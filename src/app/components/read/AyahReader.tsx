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

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Select } from '@/components/ui/Select';
import { AyahAudioButton } from '@/components/audio/AyahAudioButton';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { SURAHS, getSurah } from '@/lib/surahs';

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
  tajweed: TajweedTag[];
  wordsToLearn: number;
  fullyReadable: boolean;
}

/** Buckwalter → Arabic letters, spaced, so a root reads as letters not ASCII. */
const BW: Record<string, string> = {
  "'": 'ء', '|': 'آ', '>': 'أ', '&': 'ؤ', '<': 'إ', '}': 'ئ', A: 'ا', b: 'ب',
  p: 'ة', t: 'ت', v: 'ث', j: 'ج', H: 'ح', x: 'خ', d: 'د', '*': 'ذ', r: 'ر',
  z: 'ز', s: 'س', $: 'ش', S: 'ص', D: 'ض', T: 'ط', Z: 'ظ', E: 'ع', g: 'غ',
  f: 'ف', q: 'ق', k: 'ك', l: 'ل', m: 'م', n: 'ن', h: 'ه', w: 'و', y: 'ي',
  Y: 'ى', '`': 'ٰ',
};
const rootArabic = (r: string) => [...r].map((c) => BW[c] ?? c).join(' ');

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

export function AyahReader() {
  const router = useRouter();
  const params = useSearchParams();
  const surah = Math.min(114, Math.max(1, Number(params.get('s')) || 1));
  const ayah = Math.max(1, Number(params.get('a')) || 1);

  const [data, setData] = useState<Ayah | null>(null);
  const [lens, setLens] = useState<Lens>('meaning');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (s: number, a: number) => router.push(`/read?s=${s}&a=${a}`);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: Ayah }>(`/api/quran/ayah/${surah}/${ayah}`);
      setData(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [surah, ayah]);

  useEffect(() => {
    load();
  }, [load]);

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

  const s = getSurah(surah);
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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
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
      </div>

      <Card>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ground-300">
              {s?.name ?? `Surah ${surah}`} · {surah}:{ayah}
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
          <AyahAudioButton surah={surah} ayah={ayah} />
        </div>

        {/* The ayah. Amiri, lang="ar", leading-arabic — and tajweed colours only
            under the Recite lens, because colour means "recitation rule" and
            showing it while reading for meaning is noise. */}
        <p
          className="text-arabic text-center text-3xl leading-arabic"
          dir="rtl"
          lang="ar"
        >
          {lens === 'recite'
            ? data.words.map((w) => (
                <span key={w.position}>{w.arabic} </span>
              ))
            : data.textUthmani}
        </p>

        {/* Word chips. Gold with a dotted underline means "you do not know this
            root yet" — a finishable list rather than a percentage. */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-3" dir="rtl">
          {data.words.map((w) => (
            <div key={w.position} className="min-w-[86px] text-center">
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
        {lens === 'memorize' && <MemorizeLens surah={surah} ayah={ayah} />}
        {lens === 'ask' && <AskLens surah={surah} ayah={ayah} />}
      </Card>

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
      {/* Said rather than implied: there is no full translation in the database.
          The column exists on quran_verses and is empty for all 6,236 verses, so
          claiming a translation here would be inventing one. */}
      <p className="mt-4 text-xs text-ground-400">
        {data.translation ??
          'Word-by-word glosses only — no full translation is stored yet, and the gloss chain is meant to be read in sequence rather than as a sentence.'}
      </p>
    </div>
  );
}

function ParseLens({ data }: { data: Ayah }) {
  return (
    <div>
      <h3 className="mb-3 text-xs uppercase tracking-label text-ground-400">
        What the corpus states
      </h3>
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
                  seg.root ? `root ${rootArabic(seg.root)}` : null,
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
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
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
