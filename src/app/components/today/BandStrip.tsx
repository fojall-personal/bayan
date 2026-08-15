'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Band = 'foundation' | 'ajurrumiyya' | 'qatr' | 'alfiyya' | 'irab';

interface GateItem {
  id: string;
  label: string;
  current: number;
  target: number;
  met: boolean;
  deferred: boolean;
}

interface BandPayload {
  band: Band;
  source: string | null;
  enteredAt: string | null;
  bookTitle: string;
  bookSentence: string;
  compactLabel: string;
  gate: { items: GateItem[]; ready: boolean };
  cleared: Band[];
  targets: {
    rootsKnown: number;
    rootsTarget: number;
    pairsKnown: number;
    pairsTarget: number;
  };
  books?: Record<Band, BookLesson[]>;
  capstone?: {
    ayahs: number;
    casePct: number;
    governorPct: number;
    elisionPct: number | null;
  };
}

interface BookLesson {
  id: string;
  title: string;
  completed: boolean;
  skipped: boolean;
  available: boolean;
}

const ORDER: Band[] = ['foundation', 'ajurrumiyya', 'qatr', 'alfiyya', 'irab'];
const LABELS: Record<Band, string> = {
  foundation: 'Script',
  ajurrumiyya: 'Ajurrūm',
  qatr: 'Qaṭr',
  alfiyya: 'Alfiyya',
  irab: 'Iʿrāb',
};
const BOOK: Record<Band, { title: string; sentence: string }> = {
  foundation: {
    title: 'Script',
    sentence: 'Before the nahw books. Letters, joining, the three short vowels.',
  },
  ajurrumiyya: {
    title: 'al-Ajurrūmiyya',
    sentence:
      'Jumlah ismiyya, the three cases, iḍāfa. Sun/moon and māḍī sit beside this book, they are not chapters of it.',
  },
  qatr: {
    title: 'Qaṭr al-Nadā',
    sentence:
      'Next nahw book-equivalent: produced case endings, mood, particles. Nawāsikh are unauthored.',
  },
  alfiyya: {
    title: 'Alfiyyat Ibn Mālik',
    sentence: 'Skill checklist: name the token ʿāmil, recover the elided fāʿil.',
  },
  irab: {
    title: 'Iʿrāb al-Qurʾān',
    sentence: 'Capstone: open an ayah you have not studied and parse it without help.',
  },
};

interface BandStripProps {
  showSkip?: boolean;
}

export function BandStrip({ showSkip = true }: BandStripProps) {
  const [data, setData] = useState<BandPayload | null>(null);
  const [open, setOpen] = useState<Band | null>(null);
  const [quiz, setQuiz] = useState<
    Array<{ id: string; prompt: string; display?: string; options: string[] }>
  >([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: BandPayload }>('/api/progress/band');
      setData(res.data);
      setError(null);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return null;

  const sheetBand = open;
  const sheetCleared = sheetBand ? data.cleared.includes(sheetBand) : false;
  const sheetCurrent = sheetBand === data.band;
  const sheetLocked = Boolean(sheetBand && !sheetCurrent && !sheetCleared);
  const sheetCopy = sheetBand ? BOOK[sheetBand] : null;
  const sheetLessons = sheetBand && data.books ? data.books[sheetBand] ?? [] : [];
  const nextLesson = sheetLessons.find((l) => !l.completed);
  const chipTitle = (title: string) =>
    title.split(' — ')[0].replace(/\s*\([^)]*\)\s*$/, '');

  const startSkip = async () => {
    setError(null);
    try {
      const res = await apiFetch<{
        data: { items: Array<{ id: string; prompt: string; display?: string; options: string[] }> };
      }>('/api/progress/band/skip-quiz');
      setQuiz(res.data.items ?? []);
      setAnswers({});
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const submitSkip = async () => {
    try {
      const payload = quiz.map((q) => ({ id: q.id, given: answers[q.id] }));
      const res = await apiPost<{ data: { band: Band } }>('/api/progress/band/advance', {
        evidence: 'skip-quiz',
        answers: payload,
      });
      setQuiz([]);
      setOpen(null);
      setToast(`${LABELS[res.data.band]} is open.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-2">
      {toast && <p className="text-sm text-leaf-400">{toast}</p>}
      <div className="grid grid-cols-5 gap-1">
        {ORDER.map((id) => {
          const current = id === data.band;
          const cleared = data.cleared.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setOpen((prev) => (prev === id ? null : id));
                setQuiz([]);
              }}
              className={`relative z-10 flex min-h-11 min-w-0 touch-manipulation items-center justify-center rounded-md px-0.5 text-center text-[11px] leading-tight sm:text-xs ${
                current
                  ? 'bg-gold-500 text-ground-950'
                  : cleared
                    ? 'bg-leaf-500/20 text-leaf-400'
                    : 'bg-ground-500/20 text-ground-500'
              }`}
              aria-label={LABELS[id]}
              aria-current={current ? 'step' : undefined}
              aria-pressed={open === id}
            >
              {LABELS[id]}
            </button>
          );
        })}
      </div>
      {data.targets.rootsTarget > 0 && (
        <p className="text-xs leading-snug text-ground-400">
          Particles {data.targets.pairsKnown} / {data.targets.pairsTarget} · Roots{' '}
          {data.targets.rootsKnown} / {data.targets.rootsTarget}
        </p>
      )}

      {sheetBand && sheetCopy && (
        <Card>
          <p className="text-xs uppercase tracking-label text-gold-400">{sheetCopy.title}</p>
          <p className="mt-1 text-sm text-ground-200">{sheetCopy.sentence}</p>
          {sheetLocked && (
            <p className="mt-3 text-sm text-ground-400">
              This band is still closed. Finish the gold band, or open a skip check
              from that band&apos;s sheet.
            </p>
          )}
          {sheetCleared && !sheetCurrent && (
            <p className="mt-3 text-sm text-leaf-400">You have already left this band.</p>
          )}
          {sheetLessons.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-label text-ground-400">Lessons in this book</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {sheetLessons.map((lesson) => {
                  const canOpen = !sheetLocked;
                  const isNext = !lesson.completed && nextLesson?.id === lesson.id;
                  const chipClass = `flex min-h-11 min-w-0 flex-1 basis-[calc(50%-0.125rem)] touch-manipulation items-center justify-center rounded-md px-2 text-center text-[11px] leading-tight sm:basis-auto sm:flex-none sm:text-xs ${
                    isNext
                      ? 'bg-gold-500 text-ground-950'
                      : lesson.completed
                        ? 'bg-leaf-500/20 text-leaf-400'
                        : canOpen
                          ? 'bg-ground-800 text-ground-100'
                          : 'bg-ground-500/20 text-ground-500'
                  }`;
                  if (!canOpen) {
                    return (
                      <span key={lesson.id} className={chipClass}>
                        {chipTitle(lesson.title)}
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={lesson.id}
                      href={`/learning?lesson=${encodeURIComponent(lesson.id)}`}
                      className={chipClass}
                      title={lesson.title}
                    >
                      {chipTitle(lesson.title)}
                    </Link>
                  );
                })}
              </div>
              {nextLesson && !sheetLocked && (
                <Link href={`/learning?lesson=${encodeURIComponent(nextLesson.id)}`} className="mt-3 block">
                  <Button className="w-full">Start {chipTitle(nextLesson.title)}</Button>
                </Link>
              )}
            </div>
          )}
          {sheetBand === 'irab' && (
            <p className="mt-3 text-sm text-ground-400">
              This band has no authored dars. Use the gold card on Today to parse.
            </p>
          )}
          {sheetBand === 'irab' && data.capstone && (
            <p className="mt-2 text-sm text-ground-200">
              Cold-parse {data.capstone.ayahs} / 10 ayahs · case {data.capstone.casePct}% ·
              governor {data.capstone.governorPct}%
              {data.capstone.elisionPct !== null
                ? ` · elision ${data.capstone.elisionPct}%`
                : ''}
            </p>
          )}
          {sheetCurrent && (
            <ul className="mt-3 space-y-1">
              {data.gate.items.map((item) => (
                <li
                  key={item.id}
                  className={`break-words text-sm ${item.deferred ? 'text-ground-500' : 'text-ground-200'}`}
                >
                  {item.met ? '✓ ' : ''}
                  {item.label}: {item.current} / {item.target}
                </li>
              ))}
            </ul>
          )}
          {showSkip && sheetCurrent && quiz.length === 0 && (
            <Button variant="ghost" className="mt-3 w-full" onClick={startSkip}>
              I already did this book
            </Button>
          )}
          {quiz.length > 0 && (
            <div className="mt-4 space-y-4">
              {quiz.map((q) => (
                <div key={q.id}>
                  <p className="text-sm text-ground-200">{q.prompt}</p>
                  {q.display && (
                    <p className="text-arabic mt-1 text-2xl" dir="rtl" lang="ar">
                      {q.display}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    {q.options.map((opt, i) => (
                      <Button
                        key={opt}
                        variant={answers[q.id] === i ? 'primary' : 'secondary'}
                        className="h-auto min-h-11 w-full whitespace-normal py-2"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: i }))}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              <Button className="w-full" onClick={submitSkip}>
                Submit check
              </Button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-error">{error}</p>}
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setOpen(null)}>
            Close
          </Button>
        </Card>
      )}
    </div>
  );
}
