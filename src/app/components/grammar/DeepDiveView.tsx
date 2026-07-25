'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Layout, Beaker, Feather } from 'lucide-react';

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
  category: 'nahw' | 'sarf' | 'balagha';
}

const CATEGORY_INFO: Record<string, { name: string; icon: React.ElementType }> = {
  nahw: { name: 'Syntax (النَّحْو)', icon: Layout },
  sarf: { name: 'Morphology (الصَّرْف)', icon: Beaker },
  balagha: { name: 'Rhetoric (البَلَاغَة)', icon: Feather },
};

export function DeepDiveView({ category }: DeepDiveViewProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [userInput, setUserInput] = useState('');
  const [parseResult, setParseResult] = useState<any>(null);
  const [mastery, setMastery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [category]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const [lessonsRes, masteryRes] = await Promise.all([
        fetch(`/api/grammar/deepdive/${category}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/grammar/mastery', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (lessonsRes.ok) {
        const data = await lessonsRes.json();
        setLessons(data.data?.lessons || []);
        setMastery(data.data?.mastery || null);
      }
    } catch (error) {
      console.error('Failed to fetch grammar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    try {
      const token = process.env.NEXT_PUBLIC_API_TOKEN;
      const res = await fetch('/api/grammar/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ sentence: userInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setParseResult(data.data);
      }
    } catch (error) {
      console.error('Parse error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const info = CATEGORY_INFO[category];

  return (
    <div className="page-transition space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <info.icon className="w-8 h-8 text-primary-400" />
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

      {/* Lesson selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lessons.map((lesson) => (
          <button
            key={lesson.id}
            onClick={() => setSelectedLesson(lesson)}
            className={`p-4 rounded-lg text-left transition-all border ${
              selectedLesson?.id === lesson.id
                ? 'border-green-500 bg-green-500/10'
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
          <h2 className="text-xl font-bold mb-4">{selectedLesson.title}</h2>

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
            className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
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
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                <h5 className="font-semibold text-red-400 mb-2">
                  Grammar Issues Found:
                </h5>
                {parseResult.errors.map((error: any, i: number) => (
                  <div key={i} className="text-sm text-red-300">
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
