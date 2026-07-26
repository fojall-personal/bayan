'use client';

// Root families from the corpus — the F8 "facts first" view.
//
// Everything shown is a corpus record rendered directly. No model is involved,
// which matters beyond principle: Workers AI is capped at 10,000 neurons/day
// shared across all users, so anything that depended on a model call could not be
// load-bearing anyway.
//
// A root the corpus does not attest returns 404 and says so, rather than
// producing a plausible family that does not exist.

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch, apiErrorMessage, ApiError } from '@/lib/api';

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
  rootArabic: string | null;
  members: Member[];
  formsAttested: string[];
  totalOccurrences: number;
}

/** Roots worth starting from — common, and each attests several forms. */
const SUGGESTIONS = [
  { bw: 'ktb', ar: 'ك ت ب', gloss: 'writing' },
  { bw: 'Elm', ar: 'ع ل م', gloss: 'knowing' },
  { bw: 'nzl', ar: 'ن ز ل', gloss: 'sending down' },
  { bw: 'Amn', ar: 'ا م ن', gloss: 'believing, safety' },
  { bw: 'qwl', ar: 'ق و ل', gloss: 'saying' },
  { bw: 'rHm', ar: 'ر ح م', gloss: 'mercy' },
];

export function RootExplorer() {
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (root: string) => {
    const trimmed = root.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setFamily(null);
    try {
      const res = await apiFetch<{ data: Family }>(
        `/api/grammar/root/${encodeURIComponent(trimmed)}`
      );
      setFamily(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`The corpus has no occurrences of "${trimmed}".`);
      } else {
        console.error('Root lookup failed:', err);
        setError(apiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(query);
          }}
          className="space-y-4"
        >
          <Input
            label="Root (Buckwalter, e.g. ktb)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ktb"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? 'Looking up…' : 'Look up root'}
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-sm text-gray-400 mb-3">Or start from one of these:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.bw}
                type="button"
                onClick={() => {
                  setQuery(s.bw);
                  lookup(s.bw);
                }}
                className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:border-gray-600 text-sm"
              >
                <span className="text-naskh" dir="rtl">
                  {s.ar}
                </span>
                <span className="text-gray-500 ml-2">{s.gloss}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <p className="text-gray-300">{error}</p>
        </Card>
      )}

      {family && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <h3 className="text-3xl text-naskh" dir="rtl">
              {family.rootArabic}
            </h3>
            <p className="text-sm text-gray-400">
              {family.totalOccurrences} occurrence
              {family.totalOccurrences === 1 ? '' : 's'} in the Quran
            </p>
          </div>

          {family.formsAttested.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-2">Verb forms attested for this root</p>
              <div className="flex flex-wrap gap-2">
                {family.formsAttested.map((f) => (
                  <span
                    key={f}
                    className="px-3 py-1 rounded-md bg-gold-500/15 text-gold-400 text-sm"
                  >
                    Form {f}
                  </span>
                ))}
              </div>
              {family.formsAttested.length === 1 && (
                <p className="text-xs text-gray-500 mt-2">
                  Only one form is attested, so this root yields no form-contrast drill.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {family.members.map((m, i) => (
              <div
                key={`${m.lemma}-${m.pos}-${m.form}-${i}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gray-800"
              >
                <span className="text-2xl text-naskh" dir="rtl">
                  {m.lemmaArabic}
                </span>
                <span className="text-sm text-gray-400">
                  {m.pos ?? '—'}
                  {m.form ? ` · Form ${m.form}` : ''}
                  {m.aspects.length ? ` · ${m.aspects.join(', ')}` : ''}
                </span>
                <span className="text-sm text-gray-500">×{m.occurrences}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
