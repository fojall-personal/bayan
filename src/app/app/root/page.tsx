import { Suspense } from 'react';
import { RootStudy } from '@/components/read/RootStudy';

export const metadata = {
  title: 'Root — Bayan',
  description: 'Learn one root and see what it opens.',
};

export default function RootPage() {
  return (
    <Suspense fallback={<p className="text-ground-300">Loading…</p>}>
      <RootStudy />
    </Suspense>
  );
}
