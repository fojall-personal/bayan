'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DeepDiveView } from '@/components/grammar/DeepDiveView';
import { ExerciseRunner } from '@/components/grammar/ExerciseRunner';
import { RootExplorer } from '@/components/grammar/RootExplorer';
import { TashkilDrill } from '@/components/grammar/TashkilDrill';
import { Tabs } from '@/components/ui/Tabs';
import { VocabularyView } from '@/components/vocabulary/VocabularyView';

type View = 'exercises' | 'tashkil' | 'roots' | 'deepdive' | 'vocabulary';
type GrammarCategory = 'nahw' | 'sarf' | 'balagha' | 'vocabulary';

const CATEGORIES: { id: GrammarCategory; name: string; arabic: string }[] = [
  // Emoji icons removed: DESIGN.md anti-slop tell 7 is an icon above every
  // heading, and these carried no meaning the label did not already convey.
  { id: 'nahw', name: 'Syntax', arabic: 'النَّحْو' },
  { id: 'sarf', name: 'Morphology', arabic: 'الصَّرْف' },
  { id: 'balagha', name: 'Rhetoric', arabic: 'البَلَاغَة' },
  { id: 'vocabulary', name: 'Vocabulary', arabic: 'الجُذُور' },
];

export default function GrammarPage() {
  // Exercises first: it is the only view with real depth behind it — 780
  // corpus-derived items — whereas the deep-dive reads the five authored lessons.
  const [view, setView] = useState<View>('exercises');
  const [category, setCategory] = useState<GrammarCategory>('nahw');

  return (
    <div>
      <PageHeader
        title="Grammar"
        subtitle="Exercises drawn from the Quranic corpus, root families, and deep-dive lessons"
        actions={
          <Tabs
            label="Grammar views"
            value={view}
            onChange={setView}
            items={[
              { id: 'exercises', label: 'Exercises' },
              { id: 'tashkil', label: 'Case endings' },
              { id: 'roots', label: 'Roots' },
              { id: 'deepdive', label: 'Deep-dive' },
              { id: 'vocabulary', label: 'Vocabulary' },
            ]}
          />
        }
      />

      {view === 'exercises' && <ExerciseRunner />}

      {view === 'tashkil' && <TashkilDrill />}

      {view === 'roots' && <RootExplorer />}

      {view === 'deepdive' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                aria-pressed={category === cat.id}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                  category === cat.id
                    ? 'border-leaf-500 bg-leaf-500/10 text-leaf-400'
                    : 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300'
                }`}
              >
                <span className="font-medium">{cat.name}</span>
                <span className="text-naskh text-sm text-gray-500" dir="rtl">
                  {cat.arabic}
                </span>
              </button>
            ))}
          </div>

          <DeepDiveView category={category} />
        </div>
      )}

      {view === 'vocabulary' && <VocabularyView />}
    </div>
  );
}
