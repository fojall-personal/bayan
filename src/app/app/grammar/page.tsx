'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DeepDiveView } from '@/components/grammar/DeepDiveView';
import { Button } from '@/components/ui/Button';

type GrammarCategory = 'nahw' | 'sarf' | 'balagha';

const CATEGORIES: { id: GrammarCategory; name: string; icon: string }[] = [
  { id: 'nahw', name: 'النَّحْو (Syntax)', icon: '📐' },
  { id: 'sarf', name: 'الصَّرْف (Morphology)', icon: '🔬' },
  { id: 'balagha', name: 'البَلَاغَة (Rhetoric)', icon: '✨' },
];

export default function GrammarPage() {
  const [category, setCategory] = useState<GrammarCategory>('nahw');

  return (
    <div>
      <PageHeader
        title="Grammar Deep-Dive"
        subtitle="Advanced grammar: nahw, sarf, and balagha"
      />

      {/* Category selector */}
      <div className="flex gap-3 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              category === cat.id
                ? 'border-green-500 bg-green-500/10 text-green-400'
                : 'border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            <span className="text-xl">{cat.icon}</span>
            <span className="font-medium">{cat.name}</span>
          </button>
        ))}
      </div>

      <DeepDiveView category={category} />
    </div>
  );
}
