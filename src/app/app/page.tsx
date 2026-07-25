'use client';

import Link from 'next/link';
import { useState } from 'react';

const goals = [
  {
    id: 'read-quran',
    title: 'Read the Quran fluently',
    description: 'Learn to read Arabic script and understand the text',
    numeral: '١',
  },
  {
    id: 'understand-arabic',
    title: 'Understand Classical Arabic',
    description: 'Master grammar, vocabulary, and comprehension',
    numeral: '٢',
  },
  {
    id: 'memorize-quran',
    title: 'Memorize the Quran (Hifz)',
    description: 'Systematic memorization with spaced repetition',
    numeral: '٣',
  },
  {
    id: 'all',
    title: 'All of the above',
    description: 'Comprehensive learning path for all goals',
    numeral: '٤',
  },
];

/* ── 8-point star SVG (inline, reused) ── */
function StarPattern() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        width: '100%',
        height: '100%',
        opacity: 0.018,
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
          <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#22c55e" stroke-width="0.4">
              <circle cx="40" cy="40" r="38"/>
              <line x1="40" y1="2" x2="40" y2="78"/>
              <line x1="2" y1="40" x2="78" y2="40"/>
              <line x1="12" y1="12" x2="68" y2="68"/>
              <line x1="68" y1="12" x2="12" y2="68"/>
              <circle cx="40" cy="40" r="20"/>
            </g>
          </svg>
        `)}")`,
        backgroundSize: '80px 80px',
      }}
    />
  );
}

/* ── Step indicator ── */
function StepIndicator() {
  return (
    <div className="mb-14 flex items-center gap-3">
      <span className="text-[0.65rem] font-semibold tracking-[0.18em] uppercase text-primary-500">
        Step 1
      </span>
      <div className="flex-1 h-px bg-gray-800 relative">
        <div className="absolute inset-y-0 left-0 w-1/4 bg-primary-500" />
      </div>
      <span className="text-[0.7rem] text-gray-500 font-medium">4 steps</span>
    </div>
  );
}

/* ── Single goal card ── */
function GoalCard({
  goal,
  selected,
  onSelect,
  index,
}: {
  goal: (typeof goals)[0];
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`
        group relative flex items-center gap-5 w-full text-left
        px-7 py-[18px]
        border rounded-2xl
        transition-all duration-250 ease
        ${selected
          ? 'border-primary-500/60 bg-primary-500/[0.06]'
          : 'border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-900'
        }
      `}
    >
      {/* Left accent bar */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-[3px] rounded-full
          transition-all duration-250
          ${selected ? 'bg-primary-500' : 'bg-transparent group-hover:bg-primary-500/40'}
        `}
      />

      {/* Arabic numeral circle */}
      <div
        className={`
          flex-shrink-0 w-9 h-9 rounded-full border flex items-center justify-center
          text-[0.8rem] font-semibold transition-all duration-250
          ${selected
            ? 'border-primary-500 bg-primary-500 text-gray-950'
            : 'border-gray-700 text-gray-500 group-hover:border-gray-600'
          }
        `}
        style={goal.id === 'all' && selected ? { borderColor: '#f59e0b', background: '#f59e0b' } : {}}
      >
        {goal.numeral}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-[1.05rem] font-semibold text-gray-50 mb-0.5">
          {goal.title}
        </div>
        <div className="text-sm text-gray-500 leading-relaxed">
          {goal.description}
        </div>
      </div>
    </button>
  );
}

/* ── Page ── */
export default function GoalSelection() {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  return (
    <div className="relative min-h-screen bg-gray-950">
      {/* Geometric star texture */}
      <StarPattern />

      {/* Nav — reuse existing Nav component is fine, but this is a standalone
          onboarding page. Keep nav minimal to match the variant's quiet tone. */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-5 border-b border-gray-800">
        <Link
          href="/"
          className="text-[1.15rem] font-semibold text-primary-500 font-arabic tracking-tight"
        >
          Language Builder
        </Link>
        <ul className="hidden md:flex items-center gap-8 list-none">
          {[
            { href: '/assessment', label: 'Assessment' },
            { href: '/learning', label: 'Learning' },
            { href: '/memorization', label: 'Memorization' },
            { href: '/progress', label: 'Progress' },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-wide font-medium"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Main content — centered editorial column */}
      <main className="relative z-10 mx-auto max-w-[640px] px-6 py-20 sm:px-8 sm:py-28">
        <StepIndicator />

        {/* Bismillah verse — gold Amiri */}
        <p
          lang="ar"
          dir="rtl"
          className="text-center font-arabic text-2xl leading-arabic text-secondary-500 mb-2"
        >
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <p className="text-center text-sm text-gray-500 italic leading-relaxed mb-1.5">
          In the name of God, the Most Gracious, the Most Merciful
        </p>
        <p className="text-center text-[0.72rem] text-gray-600 tracking-wider mb-16">
          — Al-Fatihah 1:1
        </p>

        {/* Section heading */}
        <h2 className="text-[1.65rem] font-bold text-center text-gray-50 mb-2 font-arabic tracking-tight">
          What&apos;s your goal?
        </h2>
        <p className="text-center text-[0.95rem] text-gray-400 max-w-sm mx-auto leading-relaxed mb-14">
          Choose the path that fits where you are. You can adjust later.
        </p>

        {/* Goal cards — vertical stack */}
        <div className="flex flex-col gap-3">
          {goals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              selected={selectedGoal === goal.id}
              onSelect={() => setSelectedGoal(goal.id)}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-10">
          <Link
            href={selectedGoal ? '/assessment' : '#'}
            className={`
              block w-full text-center py-[15px] rounded-xl font-semibold text-[1rem]
              transition-all duration-200
              ${selectedGoal
                ? 'bg-primary-500 text-gray-950 hover:bg-primary-600'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }
            `}
            aria-label="Continue to assessment"
          >
            Continue to assessment
          </Link>
        </div>
      </main>
    </div>
  );
}
