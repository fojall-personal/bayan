import { Suspense } from 'react';
import { AyahReader } from '@/components/read/AyahReader';

export const metadata = {
  title: 'Read — Bayan',
  description: 'One ayah, five lenses: recite, meaning, parse, memorize, ask.',
};

export default function ReadPage() {
  // useSearchParams needs a Suspense boundary in a statically exported app.
  return (
    <Suspense fallback={<p className="text-ground-300">Loading…</p>}>
      <AyahReader />
    </Suspense>
  );
}
