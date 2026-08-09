'use client';

// Producing the case ending (i'rab), not recognising it — task 7 of the
// daily-loop build-slices plan.
//
// Typing Arabic diacritics is impossible on most keyboards, so unlike every
// other drill in this app the input here is a tap palette, not a text field:
// select a word, then tap the mark that belongs on its ending. Grading happens
// server-side (POST /api/grammar/tashkil) because the GET endpoint that serves
// the stripped prompt deliberately never sends the answer key — this is a
// production item, and handing over the answer would defeat the entire drill.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { SURAHS } from '@/lib/surahs';

interface TashkilWord {
  index: number;
  /** The stripped form — no final case ending. */
  prompt: string;
  /** NOM/ACC/GEN (or a corpus-specific variant), or null if this word takes no
   * case ending at all — those words render as plain text, no palette. */
  caseCase: string | null;
}

interface TashkilResponse {
  surah: number;
  ayah: number;
  words: TashkilWord[];
}

interface GradeResult {
  index: number;
  correct: boolean;
  /** Only present on a miss — revealed after the learner already committed
   * an answer, which is feedback, not the prompt. */
  correctWord?: string;
}

interface GradeResponse {
  results: GradeResult[];
  correctCount: number;
  total: number;
  accuracy: number;
}

/**
 * The marks this drill actually restores — matches FINAL_CASE_MARKS in
 * workers/src/lib/tashkil.ts exactly. Sukun is deliberately not offered: it
 * marks the ABSENCE of a case vowel, not one of the three cases (رفع/نصب/جر)
 * this drill quizzes, and stripFinalHarakat never strips it in the first
 * place — a word ending in sukun has caseCase: null and gets no palette.
 */
const MARKS: { char: string; label: string; name: string }[] = [
  { char: 'ُ', label: 'ـُ', name: 'ضمة (رفع)' },
  { char: 'َ', label: 'ـَ', name: 'فتحة (نصب)' },
  { char: 'ِ', label: 'ـِ', name: 'كسرة (جر)' },
  { char: 'ٌ', label: 'ـٌ', name: 'ضمتان' },
  { char: 'ً', label: 'ـً', name: 'فتحتان' },
  { char: 'ٍ', label: 'ـٍ', name: 'كسرتان' },
];

const SURAH_OPTIONS = SURAHS.map((s) => ({
  value: String(s.id),
  label: `${s.id}. ${s.name}`,
}));

export function TashkilDrill() {
  const [surah, setSurah] = useState(1);
  const [ayah, setAyah] = useState(1);
  const [data, setData] = useState<TashkilResponse | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<GradeResponse | null>(null);
  const [grading, setGrading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const maxAyah = SURAHS.find((s) => s.id === surah)?.ayahCount ?? 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      const res = await apiFetch<{ data: TashkilResponse }>(
        `/api/grammar/tashkil?surah=${surah}&ayah=${ayah}`
      );
      setData(res.data);
      const initial: Record<number, string> = {};
      for (const w of res.data.words) initial[w.index] = w.prompt;
      setAnswers(initial);
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

  const declinable = data?.words.filter((w) => w.caseCase !== null) ?? [];

  const applyMark = (mark: string) => {
    if (selected === null || !data) return;
    const word = data.words.find((w) => w.index === selected);
    if (!word) return;
    setAnswers((a) => ({ ...a, [selected]: word.prompt + mark }));
  };

  const clearMark = () => {
    if (selected === null || !data) return;
    const word = data.words.find((w) => w.index === selected);
    if (!word) return;
    setAnswers((a) => ({ ...a, [selected]: word.prompt }));
  };

  const check = async () => {
    if (!data || grading || declinable.length === 0) return;
    setGrading(true);
    setError(null);
    try {
      const submit: Record<number, string> = {};
      for (const w of declinable) submit[w.index] = answers[w.index];
      const res = await apiPost<{ data: GradeResponse }>('/api/grammar/tashkil', {
        surah,
        ayah,
        answers: submit,
      });
      setResult(res.data);
      setSelected(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGrading(false);
    }
  };

  const resultFor = (index: number) => result?.results.find((r) => r.index === index);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Surah"
            value={String(surah)}
            onChange={(v) => {
              const id = Number(v);
              setSurah(id);
              const count = SURAHS.find((s) => s.id === id)?.ayahCount ?? 1;
              if (ayah > count) setAyah(1);
            }}
            options={SURAH_OPTIONS}
          />
          <div className="space-y-2">
            <label htmlFor="tashkil-ayah" className="block text-sm font-medium text-ground-300">
              Ayah (1–{maxAyah})
            </label>
            <input
              id="tashkil-ayah"
              type="number"
              min={1}
              max={maxAyah}
              value={ayah}
              onChange={(e) => {
                const n = Math.min(maxAyah, Math.max(1, Number(e.target.value) || 1));
                setAyah(n);
              }}
              className="w-full rounded-md border border-ground-700 bg-ground-800 px-4 py-2.5 text-ground-50 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50"
            />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">Loading…</p>
        </Card>
      ) : error ? (
        <Card>
          <h3 className="text-lg font-bold mb-2">Couldn&apos;t load this ayah</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      ) : !data || declinable.length === 0 ? (
        <Card className="text-center py-12">
          <h3 className="text-xl font-bold mb-2">No case endings to restore here</h3>
          <p className="text-gray-400">
            Every word in this ayah is either indeclinable or has no attested case in
            the corpus. Try another ayah.
          </p>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-400 mb-4">
            Tap a word, then tap the ending that belongs on it. Words with a dotted
            underline are missing their case ending.
          </p>

          {/* The ayah, word by word — each declinable word is a button; the rest
              (particles, mabni words) render as plain, unselectable text. */}
          <div
            dir="rtl"
            lang="ar"
            className="text-naskh text-3xl leading-loose text-center mb-6 flex flex-wrap justify-center gap-x-2 gap-y-3"
          >
            {data.words.map((w) => {
              const graded = resultFor(w.index);
              const isDeclinable = w.caseCase !== null;
              const shown = answers[w.index] ?? w.prompt;
              if (!isDeclinable) {
                return (
                  <span key={w.index} className="text-ground-400">
                    {shown}
                  </span>
                );
              }
              const isSelected = selected === w.index;
              const stateClass = graded
                ? graded.correct
                  ? 'border-leaf-500 bg-leaf-500/15 text-leaf-400'
                  : 'border-error bg-error/10 text-error'
                : isSelected
                  ? 'border-gold-500 bg-gold-500/15 text-gold-400'
                  : shown === w.prompt
                    ? 'border-dotted border-ground-500 text-ground-50 hover:border-gold-500'
                    : 'border-ground-700 bg-ground-800 text-ground-50 hover:border-gold-500';
              return (
                <button
                  key={w.index}
                  type="button"
                  disabled={!!result}
                  onClick={() => setSelected(w.index)}
                  className={`rounded-md border-2 px-2 py-1 transition-colors disabled:cursor-default ${stateClass}`}
                >
                  {shown}
                </button>
              );
            })}
          </div>

          {/* Revealed forms for anything marked wrong — shown below the ayah so the
              layout above never shifts once grading happens. */}
          {result && result.results.some((r) => !r.correct) && (
            <p dir="rtl" lang="ar" className="text-naskh text-lg text-center text-error mb-6">
              {result.results
                .filter((r) => !r.correct)
                .map((r) => r.correctWord)
                .join('  ')}
            </p>
          )}

          {!result && selected !== null && (
            <div className="flex flex-wrap justify-center gap-2 mb-6" dir="rtl">
              {MARKS.map((m) => (
                <button
                  key={m.char}
                  type="button"
                  onClick={() => applyMark(m.char)}
                  title={m.name}
                  aria-label={m.name}
                  className="text-naskh min-h-11 min-w-11 rounded-lg border border-ground-700 bg-ground-800 px-4 py-2 text-2xl text-gold-400 transition-colors hover:border-gold-500 hover:bg-gold-500/10"
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                onClick={clearMark}
                className="min-h-11 rounded-lg border border-ground-700 bg-ground-800 px-4 py-2 text-sm text-ground-400 transition-colors hover:border-ground-500"
              >
                Clear
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 rounded-md border border-error/40 bg-error/10 p-3 text-sm">
              {error}
            </div>
          )}

          {result ? (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">
                {result.correctCount} of {result.total} correct
              </p>
              <Button onClick={load}>Another ayah</Button>
            </div>
          ) : (
            <Button onClick={check} disabled={grading} className="w-full">
              {grading ? 'Checking…' : 'Check'}
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
