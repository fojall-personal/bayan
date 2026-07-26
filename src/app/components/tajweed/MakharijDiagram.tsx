'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';

// Makharij (articulation points) for Arabic letters
const LETTERS_BY_MAKHARIJ: Record<string, string[]> = {
  'جddf': ['ج', 'ش', 'ي'],
  'حhat': ['ح', 'ه', 'ع', 'غ', 'خ'],
  'قqaf': ['ق'],
  'كkaf': ['ك', 'ء', 'إ', 'أ'],
  'ظzhah': ['ظ'],
  'ضdad': ['ض'],
  'طtaa': ['ط'],
  'ذzal': ['ذ'],
  'زzay': ['ز'],
  'سseen': ['س', 'ش'],
  'صsad': ['ص'],
  'عain': ['ع', 'غ', 'خ', 'ح', 'ه'],
  'غghain': ['غ', 'ع', 'خ', 'ح', 'ه'],
  'خkha': ['خ', 'ح', 'ه', 'ع', 'غ'],
  'همهمه': ['ء', 'ه', 'ع', 'غ', 'خ'],
  'ستلقلقل': ['ل', 'ر'],
  'شفتل': ['م', 'و', 'ب'],
  'لسنل': ['ن', 'ت', 'د', 'ط', 'ظ', 'س', 'ز', 'ث', 'ذ', 'ض', 'ص', 'ش'],
  'مخرجين': ['ي', 'و', 'ئ', 'ء'],
};

export function MakharijDiagram({
  selectedLetter: initialSelected,
}: {
  /** Optional starting selection. */
  selectedLetter?: string;
}) {
  const [hoveredMakharij, setHoveredMakharij] = useState<string | null>(null);
  // The highlight logic already existed but nothing ever set a selection — no
  // caller passed the prop and there was no way to click a letter, so the
  // selected state was unreachable. Letters are buttons now.
  const [selectedLetter, setSelectedLetter] = useState<string | undefined>(
    initialSelected
  );

  return (
    <Card>
      <h2 className="text-xl font-bold mb-6">Makharij (Articulation Points)</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(LETTERS_BY_MAKHARIJ).map(([name, letters]) => {
          const isHovered = hoveredMakharij === name;
          const hasSelected =
            selectedLetter && letters.includes(selectedLetter);

          return (
            <div
              key={name}
              className={`p-4 rounded-lg transition-colors ${
                isHovered || hasSelected
                  ? 'bg-leaf-500/20 border border-leaf-500'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onMouseEnter={() => setHoveredMakharij(name)}
              onMouseLeave={() => setHoveredMakharij(null)}
            >
              <div className="font-semibold mb-3">{name}</div>
              <div className="flex flex-wrap gap-2">
                {letters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    aria-pressed={selectedLetter === letter}
                    aria-label={`Articulation point for ${letter}`}
                    onClick={() =>
                      setSelectedLetter((prev) =>
                        prev === letter ? undefined : letter
                      )
                    }
                    className={`w-10 h-10 flex items-center justify-center rounded text-lg transition-colors ${
                      selectedLetter === letter
                        ? 'bg-leaf-500 text-ground-50'
                        : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
