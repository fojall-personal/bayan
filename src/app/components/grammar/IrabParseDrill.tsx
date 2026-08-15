'use client';

/**
 * Cold parse: case, then governor, then elision when the treebank reconstructs one.
 * QAC GPL · treebank CC BY · Tanzil CC BY.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { getSurah } from '@/lib/surahs';

interface IrabWord {
  wordIndex: number;
  surface: string;
  caseCase: string | null;
  governor: string | null;
  governorOptions: string[];
}

interface IrabItem {
  surah: number;
  ayah: number;
  text: string;
  words: IrabWord[];
  elided: { answer: string; options: string[] } | null;
}

interface GradeWord {
  wordIndex: number;
  caseOk: boolean | null;
  governorOk: boolean | null;
  expectedCase: string | null;
  expectedGovernor: string | null;
}

interface GradeResult {
  caseCorrect: number;
  caseTotal: number;
  governorCorrect: number;
  governorTotal: number;
  elisionCorrect: number | null;
  words: GradeWord[];
}

const CASES = [
  { id: 'NOM', label: 'رفع' },
  { id: 'ACC', label: 'نصب' },
  { id: 'GEN', label: 'جر' },
];

export function IrabParseDrill({ onDone }: { onDone?: () => void }) {
  const [item, setItem] = useState<IrabItem | null>(null);
  const [cases, setCases] = useState<Record<number, string>>({});
  const [govs, setGovs] = useState<Record<number, string>>({});
  const [elision, setElision] = useState<string | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGrade(null);
    setHint(null);
    setCases({});
    setGovs({});
    setElision(null);
    try {
      const res = await apiFetch<{ data: IrabItem | null }>('/api/grammar/irab-parse');
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
    return <p className="text-sm text-ground-300">Finding an ayah you have not mastered…</p>;
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
          No unread ayah is ready to parse.
        </p>
        {onDone && (
          <Button className="mt-4 w-full" onClick={onDone}>
            Continue
          </Button>
        )}
      </div>
    );
  }

  const ready =
    item.words.every((w) => cases[w.wordIndex] && govs[w.wordIndex]) &&
    (!item.elided || Boolean(elision));

  const submit = async () => {
    if (!ready) {
      setHint('Name the case and the ʿāmil for every marked word.');
      return;
    }
    setHint(null);
    setSaving(true);
    try {
      const res = await apiPost<{ data: GradeResult }>('/api/grammar/irab-parse', {
        surah: item.surah,
        ayah: item.ayah,
        answers: item.words.map((w) => ({
          wordIndex: w.wordIndex,
          caseCase: cases[w.wordIndex],
          governor: govs[w.wordIndex],
        })),
        elision: elision ?? undefined,
      });
      setGrade(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const asked = new Set(item.words.map((w) => w.wordIndex));
  const marked = item.text
    .split(/\s+/)
    .map((w, i) => (asked.has(i + 1) ? `⟪${w}⟫` : w))
    .join(' ');
  const surahName = getSurah(item.surah)?.name ?? `Surah ${item.surah}`;
  const byIndex = new Map((grade?.words ?? []).map((w) => [w.wordIndex, w]));

  return (
    <div className="space-y-4">
      <p className="text-xs text-ground-400">
        {surahName} {item.ayah} · QAC GPL · treebank CC BY · Tanzil CC BY
      </p>
      <p className="text-arabic text-xl leading-loose" dir="rtl" lang="ar">
        {marked}
      </p>
      {item.words.map((w) => {
        const result = byIndex.get(w.wordIndex);
        return (
          <div key={w.wordIndex} className="rounded-md border border-ground-800 p-3">
            <p className="text-arabic text-xl" dir="rtl" lang="ar">
              {w.surface}
            </p>
            {result && (
              <p className="mt-1 text-xs text-ground-400">
                Case {result.caseOk ? '✓' : result.expectedCase} · ʿĀmil{' '}
                {result.governorOk ? '✓' : result.expectedGovernor}
              </p>
            )}
            <p className="mt-2 text-xs uppercase tracking-label text-ground-400">Case</p>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {CASES.map((c) => (
                <Button
                  key={c.id}
                  variant={cases[w.wordIndex] === c.id ? 'primary' : 'secondary'}
                  className="min-h-11 touch-manipulation px-1"
                  onClick={() => {
                    if (grade) return;
                    setCases((prev) => ({ ...prev, [w.wordIndex]: c.id }));
                  }}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs uppercase tracking-label text-ground-400">ʿĀmil</p>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {w.governorOptions.map((opt) => (
                <Button
                  key={opt}
                  variant={govs[w.wordIndex] === opt ? 'primary' : 'secondary'}
                  className="h-auto min-h-11 touch-manipulation whitespace-normal py-2"
                  onClick={() => {
                    if (grade) return;
                    setGovs((prev) => ({ ...prev, [w.wordIndex]: opt }));
                  }}
                >
                  <span dir="rtl" lang="ar" className="text-naskh text-lg">
                    {opt}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        );
      })}
      {item.elided && (
        <div className="rounded-md border border-ground-800 p-3">
          <p className="text-sm text-ground-200">The treebank reconstructs an unwritten فاعل.</p>
          <div className="mt-2 grid grid-cols-2 gap-1">
            {item.elided.options.map((opt) => (
              <Button
                key={opt}
                variant={elision === opt ? 'primary' : 'secondary'}
                className="min-h-11 touch-manipulation"
                onClick={() => {
                  if (grade) return;
                  setElision(opt);
                }}
              >
                <span dir="rtl" lang="ar" className="text-naskh text-lg">
                  {opt}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
      {hint && <p className="text-sm text-gold-400">{hint}</p>}
      {!grade && (
        <Button className="w-full" onClick={submit}>
          {saving ? 'Checking…' : 'Submit parse'}
        </Button>
      )}
      {grade && (
        <p className="text-sm text-ground-200">
          Case {grade.caseCorrect}/{grade.caseTotal} · Governor {grade.governorCorrect}/
          {grade.governorTotal}
          {grade.elisionCorrect !== null
            ? ` · Elision ${grade.elisionCorrect === 1 ? 'right' : 'miss'}`
            : ''}
        </p>
      )}
      {grade && onDone && (
        <Button className="w-full" onClick={onDone}>
          Continue
        </Button>
      )}
    </div>
  );
}