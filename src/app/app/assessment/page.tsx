'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AssessmentFlow } from '@/components/assessment/AssessmentFlow';
import { AssessmentResults } from '@/components/assessment/AssessmentResults';
import { apiFetch, apiErrorMessage } from '@/lib/api';

export default function AssessmentPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Without this, a stored result made the flow permanently unreachable:
  // /assessment returned results whenever any existed, so retaking was
  // impossible and the "Retake Assessment" button had no handler anyway.
  const [retaking, setRetaking] = useState(false);

  useEffect(() => {
    // Check if assessment is already completed
    apiFetch<{ data: unknown }>('/api/assessment/results')
      .then((data) => {
        if (data.data) {
          setResult(data.data);
        }
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (result && !retaking) {
    return (
      <div>
        <PageHeader
          title="Assessment"
          subtitle="Your diagnostic results and learning path"
          backHref="/progress"
          backLabel="Back to Progress"
        />
        <AssessmentResults result={result} onRetake={() => setRetaking(true)} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h2 className="text-2xl font-bold mb-3">Couldn&apos;t reach the assessment API</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Diagnostic"
        title="Placement assessment"
        subtitle="18 questions across reading, comprehension, grammar and memorisation — about 15 minutes, no recording."
        backHref="/today"
        backLabel="Back to Today"
      />
      <AssessmentFlow
        onComplete={(r) => {
          setResult(r);
          setRetaking(false);
        }}
      />
    </div>
  );
}
