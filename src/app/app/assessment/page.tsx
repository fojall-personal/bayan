'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AssessmentFlow } from '@/components/assessment/AssessmentFlow';
import { AssessmentResults } from '@/components/assessment/AssessmentResults';

export default function AssessmentPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if assessment is already completed
    const token = process.env.NEXT_PUBLIC_API_TOKEN || 'dev-token-change-in-production';
    fetch('/api/assessment/results', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setResult(data.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
