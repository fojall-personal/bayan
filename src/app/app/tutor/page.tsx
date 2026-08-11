'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { TutorChat } from '@/components/tutor/TutorChat';

export default function TutorPage() {
  return (
    <div>
      <PageHeader
        title="AI Tutor"
        subtitle="Ask about a word, a root, a location, or a tajweed rule — answered from the corpus, not invented"
      />
      <TutorChat />
    </div>
  );
}
