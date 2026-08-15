'use client';

// The words that carry the syntax.
//
// Coverage counted an ayah readable when every ROOTED word in it had a known root,
// and treated everything else as free. Measured against this corpus that is 27,462
// of 77,429 word tokens — 35.5% — assumed known: prepositions, conjunctions,
// relative pronouns, negations, demonstratives. They are not free, and they are the
// words that decide what a sentence means.
//
// The distribution is the reason this screen is short rather than a curriculum.
// There are 215 (lemma, pos) pairs in the whole Quran and the top 50 cover 94% of
// every function-word occurrence, so a fortnight at four a day closes almost the
// entire hole.
//
// Listed per PART OF SPEECH, not per spelling. `maA` is a relative pronoun 1,476
// times and a negation 705 times, and they are different words to learn — telling
// them apart in context is the skill, so they are never merged into one row.

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';
import { buckwalterToArabic, posName } from '@/lib/buckwalter-display';

interface Item {
  lemma: string;
  pos: string;
  occurrences: number;
  known: boolean;
}

type Band = 'foundation' | 'ajurrumiyya' | 'qatr' | 'alfiyya' | 'irab';

const BAND_EYEBROW: Record<Band, string> = {
  foundation: 'Script has no particle target.',
  ajurrumiyya: 'Ajurrūmiyya target: the 20 most frequent (lemma, pos) pairs.',
  qatr: 'Qaṭr target: the 50 most frequent (lemma, pos) pairs.',
  alfiyya: 'Alfiyya keeps the Qaṭr particle target of 50 pairs.',
  irab: 'Iʿrāb keeps the particle target of 50 pairs.',
};

/** Fallback when the band is unknown. The top 50 pairs are 94% of occurrences. */
const SHOWN = 50;

export function FunctionWords({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [pairTarget, setPairTarget] = useState(SHOWN);
  const [band, setBand] = useState<Band | null>(null);
  const [showLater, setShowLater] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<{ key: string; ayahs: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fw = await apiFetch<{ data: { items: Item[] } }>(
        '/api/progress/function-words'
      );
      setItems(fw.data.items ?? []);
      try {
        const bandRes = await apiFetch<{
          data: { band: Band; targets: { pairsTarget: number } };
        }>('/api/progress/band');
        setBand(bandRes.data.band);
        setPairTarget(
          bandRes.data.targets.pairsTarget > 0 ? bandRes.data.targets.pairsTarget : SHOWN
        );
      } catch {
        setPairTarget(SHOWN);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: Item) => {
    const key = `${item.lemma}:${item.pos}`;
    if (busy) return;
    setBusy(key);
    // Optimistic, then reconciled by the response. A toggle that waits a round trip
    // before showing anything feels broken when you are working down a list of fifty.
    setItems((prev) =>
      prev.map((i) =>
        i.lemma === item.lemma && i.pos === item.pos ? { ...i, known: !i.known } : i
      )
    );
    try {
      const path = `/api/progress/function-words/${encodeURIComponent(
        item.lemma
      )}/${encodeURIComponent(item.pos)}/known`;
      if (item.known) {
        await apiFetch(path, { method: 'DELETE' });
        setUnlocked(null);
      } else {
        // The payoff, as a computed fact rather than an animation: the corpus is
        // closed, so "+37 ayahs" is arithmetic.
        const res = await apiPost<{ data: { ayahsUnlocked: number } }>(path, {});
        setUnlocked({ key, ayahs: res.data.ayahsUnlocked });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
      // Put it back — the optimistic update was wrong.
      setItems((prev) =>
        prev.map((i) =>
          i.lemma === item.lemma && i.pos === item.pos ? { ...i, known: item.known } : i
        )
      );
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Loading the function words…</p>
      </Card>
    );
  }

  // All counted over the full set, not the shown slice: knowing a word ranked 60th
  // must move both numbers or neither, or the header contradicts itself.
  const target = items.slice(0, pairTarget);
  const later = items.slice(pairTarget);
  const known = items.filter((i) => i.known);
  const sum = (xs: Item[]) => xs.reduce((n, i) => n + i.occurrences, 0);
  const totalOccurrences = sum(items);
  const knownOccurrences = sum(known);

  const row = (item: Item) => {
    const key = `${item.lemma}:${item.pos}`;
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggle(item)}
        disabled={busy === key}
        aria-pressed={item.known}
        className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
          item.known
            ? 'border-leaf-500/50 bg-leaf-500/10'
            : 'border-ground-800 hover:border-ground-700 hover:bg-ground-800/50'
        }`}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-naskh text-2xl text-ground-50" dir="rtl" lang="ar">
            {buckwalterToArabic(item.lemma)}
          </span>
          <span className="text-xs uppercase tracking-label text-ground-400">
            {posName(item.pos)}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs text-ground-400">{item.occurrences.toLocaleString()}×</span>
          {unlocked?.key === key && unlocked.ayahs > 0 && (
            <span className="ml-2 text-xs text-leaf-400">+{unlocked.ayahs} ayahs</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className={compact ? 'space-y-4' : 'page-transition mx-auto max-w-2xl space-y-6'}>
      {!compact && (
        <div>
          <h1 className="font-display text-3xl">Function words</h1>
          <p className="mt-1 text-sm text-ground-300">
            {known.length} of {items.length} known ·{' '}
            {knownOccurrences.toLocaleString()} of {totalOccurrences.toLocaleString()}{' '}
            occurrences covered
          </p>
        </div>
      )}

      {error && (
        <Card>
          <p className="mb-3 text-sm text-ground-300">{error}</p>
          <Button variant="secondary" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      <Card>
        <p className="text-sm text-ground-300">
          These have no root, so coverage used to assume you knew them — 35.5% of every
          word in the Quran. Mark the ones you know.
        </p>
        {band && (
          <p className="mt-2 text-xs uppercase tracking-label text-gold-400">
            {BAND_EYEBROW[band]}
          </p>
        )}
      </Card>

      <div className="space-y-2">{target.map(row)}</div>
      {later.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex min-h-11 w-full touch-manipulation items-center justify-between rounded-md px-1 text-left text-xs uppercase tracking-label text-ground-400"
            aria-expanded={showLater}
            onClick={() => setShowLater((open) => !open)}
          >
            <span>Later · {later.length} pairs past this band</span>
            <span>{showLater ? 'Hide' : 'Show'}</span>
          </button>
          {showLater && later.map(row)}
        </div>
      )}
    </div>
  );
}
