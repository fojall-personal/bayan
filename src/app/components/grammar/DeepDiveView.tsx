'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Layout, Beaker, Feather, BookOpen } from 'lucide-react';
import { apiFetch, apiPost, apiErrorMessage } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  level: number;
  estimated_minutes: number;
  content: {
    explanation: string;
    conjugation_table?: { forms: Record<string, string> };
  };
}

interface DeepDiveViewProps {
  category: 'nahw' | 'sarf' | 'balagha' | 'vocabulary';
}

const CATEGORY_INFO: Record<string, { name: string; icon: React.ElementType }> = {
  nahw: { name: 'Syntax (النَّحْو)', icon: Layout },
  sarf: { name: 'Morphology (الصَّرْف)', icon: Beaker },
  balagha: { name: 'Rhetoric (البَلَاغَة)', icon: Feather },
  vocabulary: { name: 'Vocabulary (الجُذُور)', icon: BookOpen },
};

/**
 * Why a discipline has no lessons, in the learner's terms.
 *
 * Balagha is the honest one and the reason this text exists. Every lesson in this app is
 * either derived from annotation or checked against it, and no annotated source records
 * what an ayah does RHETORICALLY: the published Quranic balagha corpus covers Surah
 * Ibrahim verses 1–2, 41 words in total. Word order is the exception, because a treebank
 * can see it, which is why fronting has drills while simile and metaphor do not.
 */
const EMPTY_REASON: Record<string, string> = {
  nahw: 'No syntax lessons are loaded. Run the lesson seed.',
  sarf: 'No morphology lessons are loaded. Run the lesson seed.',
  // Rewritten once the derivable set grew. It previously said simile "awaits a source that
  // can be checked", which stopped being true: a simile with an explicit كـ is marked in the
  // text, and the corpus tags the particle. Metaphor is the honest remaining gap — nothing
  // on the surface marks it.
  balagha:
    'Every lesson here is checked against annotated data, and no available source records ' +
    'what an ayah does rhetorically — the published Quranic rhetoric corpus covers two ' +
    'verses. Three devices are the exception, because each leaves a mark in the text the ' +
    'corpus already records: fronting (al-taqdīm), two words from one root (al-jinās), and ' +
    'a comparison opened by كـ (al-tashbīh). All three have drills in the exercise bank. ' +
    'Metaphor and metonymy have none, and will not until a source annotates them — nothing ' +
    'on the surface of an ayah marks a metaphor.',
  // Vocabulary lives in its own tab now. The deep-dive never had vocabulary lessons
  // because the curated word list (103 entries, grouped by root) is not a lesson format.
  // The Vocabulary tab in the grammar nav shows the full list with search and family
  // detail — it is the correct home for vocabulary exploration, not deep-dive.
  'vocabulary':
    'Vocabulary is explored from the Vocabulary tab in the grammar nav. The 103-word ' +
    'curated list is organized by root, with family detail and mastery tracking — it is ' +
    'a different format than the deep-dive lessons, so it has its own home.',
};

export function DeepDiveView({ category }: DeepDiveViewProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userInput, setUserInput] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [mastery, setMastery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        data: { lessons?: Lesson[]; mastery?: unknown };
      }>(`/api/grammar/deepdive/${category}`);
      setLessons(data.data?.lessons || []);
      setMastery(data.data?.mastery || null);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch grammar data:', err);
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleParse = async () => {
    try {
      const data = await apiPost<{ data: unknown }>('/api/grammar/parse', {
        sentence: userInput,
      });
      setParseResult(data.data);
    } catch (err) {
      console.error('Parse error:', err);
      setError(apiErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <h2 className="text-lg font-bold mb-2">Couldn&apos;t load grammar content</h2>
        <p className="text-gray-400 mb-4">{error}</p>
        <Button variant="secondary" onClick={fetchData}>Try again</Button>
      </Card>
    );
  }

  const info = CATEGORY_INFO[category];

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <info.icon className="w-8 h-8 text-gold-400" />
        <div>
          <h1 className="text-2xl font-bold">Grammar Deep-Dive</h1>
          <p className="text-muted">{info.name}</p>
        </div>
      </div>

      {/* Mastery badge */}
      {mastery && (
        <Card>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-sm text-gray-400">Mastery Level</div>
              <div className="text-2xl font-bold">{mastery.masteryLevel}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400">Attempts</div>
              <div className="text-2xl font-bold">
                {mastery.correctAttempts}/{mastery.totalAttempts}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* A category with no lessons says so, and says why.
          Until the category column existed all three tabs returned the same 418 lessons,
          so this state could not arise — Rhetoric looked as full as Syntax while
          containing no rhetoric at all. An empty grid would replace one wrong impression
          with another, so the reason is stated. */}
      {lessons.length === 0 && (
        <Card>
          <h2 className="text-lg font-bold mb-2">No {info.name} lessons yet</h2>
          <p className="text-gray-400 mb-3">{EMPTY_REASON[category]}</p>
          <Link href="/grammar" className="text-gold-400 hover:underline text-sm">
            Practise from the corpus-derived exercise bank instead →
          </Link>
        </Card>
      )}

      {/* Lesson selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => setSelectedLesson(lesson)}
            className={`p-4 rounded-lg text-left transition-all border ${
              selectedLesson?.id === lesson.id
                ? 'border-leaf-500 bg-leaf-500/10'
                : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <h3 className="font-semibold mb-1">{lesson.title}</h3>
            <p className="text-sm text-gray-400">
              Level {lesson.level} • {lesson.estimated_minutes} min
            </p>
          </button>
        ))}
      </div>

      {/* Selected lesson content */}
      {selectedLesson && (
        <Card>
          {/* This view reads the lesson for reference only — no exercises render here,
              which read as a dead click ("None of the grammar exercises work when I
              click on them"). The graded exercises are real, they just live in the
              Learning flow. Reuse the exact deep-link (`?lesson=<id>`) the tutor's
              suggestion chips already use rather than rebuild a second exercise runner. */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold">{selectedLesson.title}</h2>
            {/* Styled like Button's primary/md variant directly — Button renders a
                <button>, and nesting one inside this Link's <a> is invalid HTML. */}
            <Link
              href={`/learning?lesson=${encodeURIComponent(selectedLesson.id)}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md min-h-11 px-4 py-2 text-sm font-semibold bg-gold-500 text-ground-950 hover:bg-gold-400 active:bg-gold-600 transition-colors duration-200"
            >
              Practice this lesson
            </Link>
          </div>

          {/* Explanation */}
          {selectedLesson.content.explanation && (
            <div
              className="prose prose-invert max-w-none mb-6"
              dangerouslySetInnerHTML={{
                __html: selectedLesson.content.explanation,
              }}
            />
          )}

          {/* Conjugation table (for sarf) */}
          {selectedLesson.content.conjugation_table && (
            <div className="mt-6 overflow-x-auto">
              <h3 className="font-semibold mb-3">Conjugation Table</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="p-2 text-left">Form</th>
                    <th className="p-2 text-right" dir="rtl">Arabic</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    selectedLesson.content.conjugation_table.forms
                  ).map(([form, arabic]) => (
                    <tr key={form} className="border-b border-gray-700">
                      <td className="p-2">{form}</td>
                      <td className="p-2 text-right" dir="rtl">
                        {arabic}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Practice: Parse a sentence */}
      <Card>
        <h3 className="font-semibold mb-3">Practice: Parse a Sentence</h3>
        <div className="flex gap-3">
          <input
            type="text"
            dir="rtl"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type an Arabic sentence..."
            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-ground-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-leaf-500/50 focus:border-leaf-500 transition-all"
          />
          <Button
            onClick={handleParse}
            disabled={!userInput}
            className="px-6"
          >
            Parse
          </Button>
        </div>

        {/* Parse results */}
        {parseResult && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg space-y-3">
            <div>
              <span className="text-sm text-gray-400">Structure: </span>
              <Badge>{parseResult.parsed.structure}</Badge>
            </div>

            {parseResult.parsed.subject && (
              <div className="text-sm">
                <span className="text-gray-400">Subject: </span>
                <span className="font-medium" dir="rtl">
                  {parseResult.parsed.subject.text}
                </span>
                <span className="text-gray-500"> ({parseResult.parsed.subject.type})</span>
              </div>
            )}

            {parseResult.parsed.predicate && (
              <div className="text-sm">
                <span className="text-gray-400">Predicate: </span>
                <span className="font-medium" dir="rtl">
                  {parseResult.parsed.predicate.text}
                </span>
                <span className="text-gray-500">
                  {' '}
                  ({parseResult.parsed.predicate.tense})
                </span>
              </div>
            )}

            {parseResult.parsed.object && (
              <div className="text-sm">
                <span className="text-gray-400">Object: </span>
                <span className="font-medium" dir="rtl">
                  {parseResult.parsed.object.text}
                </span>
              </div>
            )}

            {parseResult.errors.length > 0 && (
              <div className="mt-4 p-3 bg-error/10 border border-error rounded-lg">
                <h5 className="font-semibold text-error mb-2">
                  Grammar Issues Found:
                </h5>
                {parseResult.errors.map((error: any, i: number) => (
                  <div key={i} className="text-sm text-error">
                    • {error.message} — Suggestion: {error.suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
