'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { AdvancedMemorizationTools } from '@/components/memorization/AdvancedMemorizationTools';

export default function AdvancedMemorizationPage() {
  return (
    <div>
      <PageHeader
        title="Advanced Memorization Tools"
        subtitle="Audio testing, cross-references, and certificate export"
      />
      <AdvancedMemorizationTools />
    </div>
  );
}
