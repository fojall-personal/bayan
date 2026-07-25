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

  if (result) {
    return (
      <div>
        <PageHeader
          title="Assessment"
          subtitle="Your diagnostic results and learning path"
        />
        <AssessmentResults result={result} />
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
        title="Diagnostic Assessment"
        subtitle="Take a 30-45 minute test to determine your level and create a personalized learning path"
      />
      <AssessmentFlow onComplete={setResult} />
    </div>
  );
}
