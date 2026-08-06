'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RootCard } from './RootCard';
import { RootFamilyDetail } from './RootFamilyDetail';
import { FunctionWordCard } from './FunctionWordCard';
import { apiFetch } from '@/lib/api';

interface VocabularyWord {
  word: string;
  transliteration: string;
  meaning: string;
  root: string | null;
  frequency_rank: number;
  part_of_speech: string;
  mastery: { meaningKnown: number; readingKnown: number; reviews: number };
}

interface RootGroup {
  root: string;
  words: VocabularyWord[];
}

/**
 * Main vocabulary tab view.
 *
 * Shows all rooted vocabulary items in a grid, ordered by frequency rank.
 * Search filters by root name or meaning. Clicking a root opens family detail.
 * Words without roots (function words) are shown separately at the bottom.
 *
 * UX: explore first, drill second. Family detail shows corpus evidence.
 * No dead-end empty states.
 */
export function VocabularyView() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);

  const fetchVocabulary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: VocabularyWord[] }>('/api/vocabulary?limit=200');
      setWords(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vocabulary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVocabulary(); }, [fetchVocabulary]);

  const { roots, functionWords } = useMemo(() => {
    const map = new Map<string, VocabularyWord[]>();
    const func: VocabularyWord[] = [];
    for (const w of words) {
      if (!w.root) { func.push(w); continue; }
      const arr = map.get(w.root) || [];
      arr.push(w);
      map.set(w.root, arr);
    }
    const roots = Array.from(map.entries())
      .sort(([a], [b]) => Math.min(...map.get(a)!.map(w => w.frequency_rank)) -
        Math.min(...map.get(b)!.map(w => w.frequency_rank)));
    return { roots, functionWords: func.sort((a, b) => a.frequency_rank - b.frequency_rank) };
  }, [words]);

  const filtered = useMemo(() => {
    if (!search.trim()) return { roots, functionWords };
    const q = search.toLowerCase();
    const matchedRoots = roots.filter(([root, rootWords]) =>
      root.toLowerCase().includes(q) || rootWords.some(w => w.meaning.toLowerCase().includes(q))
    );
    const matchedFunc = functionWords.filter(w =>
      w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
    );
    return { roots: matchedRoots, functionWords: matchedFunc };
  }, [roots, functionWords, search]);

  if (loading) return <div className="py-12 text-center text-ground-400">Loading vocabulary...</div>;
  if (error) return <div className="py-12 text-center"><p className="text-error text-sm">{error}</p></div>;
  if (words.length === 0) return <div className="py-12 text-center"><p className="text-ground-400 text-sm">Vocabulary content has not been seeded yet. Contact the administrator.</p></div>;
  if (search && filtered.roots.length === 0 && filtered.functionWords.length === 0) {
    return <div className="py-12 text-center"><p className="text-ground-400 text-sm">No roots match &quot;{search}&quot;. Try a different term.</p></div>;
  }

  if (selectedRoot) {
    return <RootFamilyDetail root={selectedRoot} onBack={() => setSelectedRoot(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-ground-50 font-semibold">Vocabulary (الجُذُور)</h2>
        <span className="text-sm text-ground-400">{roots.length} roots · {words.length} words{functionWords.length > 0 && ` · ${functionWords.length} unrooted`}</span>
      </div>

      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search roots or meanings..." aria-label="Search vocabulary"
        className="w-full rounded-lg border border-ground-700 bg-ground-900 px-4 py-2.5 text-ground-50 placeholder-ground-500 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500/20"
      />
      {search && <p className="text-xs text-ground-400">Showing {filtered.roots.length} of {roots.length} roots</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.roots.map(([root, rootWords]) => {
          const mastered = rootWords.filter(w => w.mastery.reviews > 0).length;
          const avg = rootWords.length > 0 ? Math.round((mastered / rootWords.length) * 5) : 0;
          return <RootCard key={root} root={root} meaning={rootWords[0].meaning} wordCount={rootWords.length} mastery={avg} onClick={() => setSelectedRoot(root)} />;
        })}
      </div>

      {filtered.functionWords.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-ground-50 font-semibold text-sm">Function Words ({filtered.functionWords.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.functionWords.map(w => (
              <FunctionWordCard key={w.word} word={w.word} meaning={w.meaning} transliteration={w.transliteration} onClick={() => {}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
