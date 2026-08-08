// Assessment Scoring Engine
// Calculates weighted composite scores and assigns learning paths

interface ModuleScores {
  literacy: number;
  comprehension: number;
  grammar: number;
  memorization: number;
}

interface LearningPath {
  id: string;
  name: string;
  description: string;
  week1Focus: string;
  week5Focus: string;
  week9Focus: string;
  week13Focus: string;
}

const PATHS: Record<string, LearningPath> = {
  path1: {
    id: 'path1',
    name: 'Complete Beginner',
    description: 'No Arabic reading ability. Start with alphabet and pronunciation.',
    week1Focus: 'Arabic alphabet + pronunciation',
    week5Focus: 'Basic sentence structure + common words',
    week9Focus: 'Simple Quran passages (short surahs)',
    week13Focus: 'Grammar foundations + tajweed',
  },
  path2: {
    id: 'path2',
    name: 'Conversational Speaker',
    description: 'Spoken Arabic only. Focus on Classical script and grammar.',
    week1Focus: 'Classical script recognition',
    week5Focus: 'Basic grammar review + Quranic vocabulary',
    week9Focus: 'Classical Arabic comprehension + tajweed',
    week13Focus: 'Advanced grammar + hifz integration',
  },
  path3: {
    id: 'path3',
    name: 'Advanced Reader',
    description: 'Already understands Classical. Refine tajweed and deep-dive grammar.',
    week1Focus: 'Tajweed refinement + balagha introduction',
    week5Focus: 'Grammar deep-dive + rhetorical analysis',
    week9Focus: 'Hifz planning + comprehension validation',
    week13Focus: 'Advanced balagha + memorization maintenance',
  },
};

const WEIGHTS = {
  literacy: 0.20,
  comprehension: 0.30,
  grammar: 0.25,
  memorization: 0.25,
};

export function calculateCompositeScore(scores: ModuleScores): number {
  return (
    scores.literacy * WEIGHTS.literacy +
    scores.comprehension * WEIGHTS.comprehension +
    scores.grammar * WEIGHTS.grammar +
    scores.memorization * WEIGHTS.memorization
  );
}

export function assignLearningPath(scores: ModuleScores): string {
  const composite = calculateCompositeScore(scores);

  // Find weakest area
  const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
  const [weakestArea, weakestScore] = weakest;

  // Path assignment logic:
  // - If ANY module is very low (<40), Path 1 (beginner) — a
  //   single catastrophically weak module cannot be masked by strength
  //   elsewhere (plan task 3, 2026-08-08).
  // - If composite is high enough and every module is >= 60, Path 3
  //   (advanced reader) — no module is a real weak point.
  // - Otherwise Path 2 (conversational speaker).

  if (weakestScore < 40) {
    return 'path1';
  }

  if (composite >= 70 && weakestScore >= 60) {
    return 'path3';
  }

  return 'path2';
}

export function generateAssessmentResult(
  scores: ModuleScores,
  userId: string
) {
  const composite = calculateCompositeScore(scores);
  const path = assignLearningPath(scores);
  const level =
    composite >= 70 ? 'advanced' : composite >= 40 ? 'intermediate' : 'beginner';

  return {
    id: crypto.randomUUID(),
    user_id: userId,
    completed_at: new Date().toISOString(),
    literacy_score: scores.literacy,
    comprehension_score: scores.comprehension,
    grammar_score: scores.grammar,
    memorization_score: scores.memorization,
    composite_score: Math.round(composite),
    level,
    path,
    details: {
      weakest_area: Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0],
      strongest_area: Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0],
      paths: PATHS,
    },
  };
}
