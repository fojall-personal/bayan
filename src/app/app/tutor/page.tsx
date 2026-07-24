'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { TutorChat } from '@/components/tutor/TutorChat';

export default function TutorPage() {
  return (
    <div>
      <PageHeader
        title="AI Tutor"
        subtitle="Ask me anything about Arabic grammar, Quran memorization, or tajweed"
      />
      <TutorChat />
    </div>
  );
}
