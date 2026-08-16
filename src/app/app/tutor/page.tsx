'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { TutorChat } from '@/components/tutor/TutorChat';

export default function TutorPage() {
  return (
    <div>
      <PageHeader
        title="Look up"
        subtitle="A word, a root, a location, or a named tajweed rule. Answers come from the corpus."
      />
      <TutorChat />
    </div>
  );
}
