'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface AssessmentResult {
  id: string;
  user_id: string;
  completed_at: string;
  literacy_score: number;
  comprehension_score: number;
  grammar_score: number;
  memorization_score: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  /** The path assignLearningPath() actually assigned, as stored. */
  path?: string;
  composite_score?: number;
  details: {
    weakest_area: string;
    strongest_area: string;
    paths: Record<string, { 
    name: string; 
    description: string;
    week1Focus?: string;
    week5Focus?: string;
    week9Focus?: string;
    week13Focus?: string;
  }>;
  };
}

export function AssessmentResults({ result }: { result: AssessmentResult }) {
  // Prefer the server's composite; recompute only as a fallback.
  const compositeScore =
    result.composite_score ??
    Math.round(
      result.literacy_score * 0.2 +
        result.comprehension_score * 0.3 +
        result.grammar_score * 0.25 +
        result.memorization_score * 0.25
    );

  // Read the assigned path. This used to re-derive one from `level`
  // (advanced->path3, intermediate->path2, else path1) using different logic
  // than the server's, so the path shown could contradict the path assigned.
  const path = result.path ? result.details?.paths?.[result.path] : undefined;

  return (
    <div className="page-transition max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assessment Results</h1>
          <p className="text-gray-400 mt-2">
            Completed {new Date(result.completed_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={result.level === 'advanced' ? 'success' : result.level === 'intermediate' ? 'warning' : 'default'}>
          {result.level}
        </Badge>
      </div>

      {/* Composite Score */}
      <Card className="text-center py-8">
        <div className="text-6xl font-bold text-gold-400 mb-2">
          {compositeScore}%
        </div>
        <div className="text-gray-400">Composite Score</div>
      </Card>

      {/* Module Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScoreCard label="Literacy" score={result.literacy_score} tone="leaf" />
        <ScoreCard label="Comprehension" score={result.comprehension_score} tone="gold" />
        <ScoreCard label="Grammar" score={result.grammar_score} tone="info" />
        <ScoreCard label="Memorization" score={result.memorization_score} tone="leaf" />
      </div>

      {/* Analysis */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Analysis</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Weakest Area:</span>
            <span className="font-medium capitalize">{result.details?.weakest_area}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Strongest Area:</span>
            <span className="font-medium capitalize">{result.details?.strongest_area}</span>
          </div>
        </div>
      </Card>

      {/* Learning Path */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Your Learning Path</h3>
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="font-semibold text-gold-400 mb-2">{path?.name || 'Custom Path'}</h4>
          <p className="text-gray-400 text-sm mb-4">{path?.description || 'Personalized based on your results'}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Week 1-4:</span>
              <span>{path?.week1Focus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Week 5-8:</span>
              <span>{path?.week5Focus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Week 9-12:</span>
              <span>{path?.week9Focus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Week 13+:</span>
              <span>{path?.week13Focus}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Next Steps */}
      <div className="flex gap-3">
        <Button>Continue to Learning</Button>
        <Button variant="secondary">Retake Assessment</Button>
      </div>
    </div>
  );
}

function ScoreCard({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: 'gold' | 'leaf' | 'info' | 'muted';
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-ground-100">{label}</span>
        <span className="font-display text-2xl font-semibold tabular-nums text-ground-50">
          {score}%
        </span>
      </div>
      <ProgressBar progress={score} tone={tone} />
    </Card>
  );
}
