'use client';

// Learn one root, and say what it opened.
//
// This is the half of the loop that was missing. user_known_root and
// /api/progress/coverage existed and nothing wrote to them, so coverage was inert:
// the app could tell you how much of the Quran you could read but never changed the
// answer.
//
// The payoff line matters more than anything else here. "+37 ayahs now fully
// readable" is a specific, immediate, TRUE consequence of one decision, and it is
// computable only because the corpus is closed. No app working against an open
// vocabulary could say it.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface Member {
  lemma: string;
  lemmaArabic: string;
  pos: string | null;
  form: string | null;
  aspects: string[];
  occurrences: number;
}
interface Family {
  root: string;
  rootArabic: string;
  members: Member[];
  formsAttested: string[];
  totalOccurrences: number;
}
interface Marked {
  root: string;
  ayahsUnlocked: number;
  ayahsReadable: number;
  ayahsTotal: number;
}

const POS: Record<string, string> = {
  N: 'noun', V: 'verb', ADJ: 'adjective', PN: 'proper noun', ADV: 'adverb',
};
const ASPECT: Record<string, string> = {
  PERF: 'perfect', IMPF: 'imperfect', IMPV: 'imperative',
};

export function RootStudy() {
  const params = useSearchParams();
  const root = params.get('r') ?? '';

  const [family, setFamily] = useState<Family | null>(null);
  const [known, setKnown] = useState(false);
  const [marked, setMarked] = useState<Marked | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!root) {
      setError('No root given. Open this from Today, or from a word while reading.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [fam, cov] = await Promise.all([
        apiFetch<{ data: Family }>(`/api/grammar/root/${encodeURIComponent(root)}`),
        apiFetch<{ data: { nextRoots: { root: string }[] } }>('/api/progress/coverage'),
      ]);
      setFamily(fam.data);
      // The coverage endpoint lists the commonest roots NOT yet known, so absence
      // from that list is the cheapest available signal that this one is known.
      // Not authoritative beyond the top few, which is why the button stays usable.
      setKnown(!cov.data.nextRoots.some((n) => n.root === root));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    load();
  }, [load]);

  const mark = async () => {
    setBusy(true);
    try {
      const res = await apiPost<{ data: Marked }>(
        `/api/progress/roots/${encodeURIComponent(root)}/known`,
        {}
      );
      setMarked(res.data);
      setKnown(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unmark = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/progress/roots/${encodeURIComponent(root)}/known`, {
        method: 'DELETE',
      });
      setMarked(null);
      setKnown(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card className="py-12 text-center">
        <p className="text-ground-300">Loading root…</p>
      </Card>
    );
  }
  if (error && !family) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-bold">Couldn&apos;t load that root</h2>
        <p className="mb-4 text-sm text-ground-300">{error}</p>
        <Link href="/today">
          <Button variant="secondary">Back to Today</Button>
        </Link>
      </Card>
    );
  }
  if (!family) return null;

  return (
    <div className="page-transition mx-auto max-w-2xl space-y-5">
      <Card className={known && !marked ? '' : 'border-gold-500/40'}>
        <p className="text-xs uppercase tracking-label text-gold-400">
          {known && !marked ? 'Root — already known' : 'New root'}
        </p>
        <p
          className="text-arabic mt-3 text-center text-5xl text-gold-400"
          dir="rtl"
          lang="ar"
        >
          {family.rootArabic}
        </p>
        <p className="mt-3 text-center text-sm text-ground-300">
          {family.totalOccurrences.toLocaleString()} occurrence
          {family.totalOccurrences === 1 ? '' : 's'} in the Quran
          {family.formsAttested.length > 0 && (
            <> · form{family.formsAttested.length === 1 ? '' : 's'} {family.formsAttested.join(', ')}</>
          )}
        </p>

        {!known ? (
          <Button className="mt-5 w-full" onClick={mark} disabled={busy}>
            {busy ? 'Saving…' : 'I know this root'}
          </Button>
        ) : (
          <Button variant="ghost" className="mt-5 w-full" onClick={unmark} disabled={busy}>
            {busy ? 'Saving…' : 'Mark as not known'}
          </Button>
        )}
      </Card>

      {/* The payoff. A computed fact, not an animation. */}
      {marked && (
        <div className="rounded-lg border border-leaf-500/50 bg-leaf-500/10 p-5" role="status">
          <p className="text-xl font-semibold text-leaf-400">
            {marked.ayahsUnlocked > 0
              ? `+${marked.ayahsUnlocked} ayah${marked.ayahsUnlocked === 1 ? '' : 's'} now fully readable`
              : 'Counted — no new ayahs yet'}
          </p>
          <p className="mt-1 text-sm text-ground-300">
            {marked.ayahsReadable.toLocaleString()} of{' '}
            {marked.ayahsTotal.toLocaleString()} ayahs you can read end to end.
            {marked.ayahsUnlocked === 0 &&
              ' The ayahs holding this root still contain other words you have not met.'}
          </p>
          <Link href="/today" className="mt-4 inline-block">
            <Button variant="secondary">Back to Today</Button>
          </Link>
        </div>
      )}

      <Card>
        <h3 className="mb-3 text-xs uppercase tracking-label text-ground-400">
          Words built on this root
        </h3>
        <ul className="divide-y divide-ground-800">
          {family.members.map((m) => (
            <li key={m.lemma} className="flex items-baseline gap-4 py-2.5">
              <span className="text-arabic min-w-[6rem] text-xl" dir="rtl" lang="ar">
                {m.lemmaArabic}
              </span>
              <span className="flex-1 text-sm text-ground-300">
                {[
                  m.pos ? (POS[m.pos] ?? m.pos) : null,
                  m.form ? `Form ${m.form}` : null,
                  m.aspects.length
                    ? m.aspects.map((a) => ASPECT[a] ?? a).join(', ')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="text-xs text-ground-400">
                {m.occurrences.toLocaleString()}×
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-ground-400">
          Every form here is attested in the corpus — none is generated. That is the
          point of learning by root: one root gives you a family, and the family is
          what you actually meet on the page.
        </p>
      </Card>
    </div>
  );
}
