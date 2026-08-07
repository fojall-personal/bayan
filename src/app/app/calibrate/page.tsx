import Link from 'next/link';
import { Calibration } from '@/components/read/Calibration';

export const metadata = {
  title: 'Which roots do you know? — Bayan',
  description: 'Twelve sampled roots, about a minute, so coverage starts from the truth.',
};

export default function CalibratePage() {
  return (
    <div>
      {/* Calibration.tsx renders its own <h1>, so this is a standalone link
          rather than PageHeader's backHref — no title/subtitle to duplicate. */}
      <Link
        href="/today"
        className="mb-6 inline-flex items-center gap-1 text-sm text-ground-400 transition-colors hover:text-gold-400"
      >
        ← Back to Today
      </Link>
      <Calibration />
    </div>
  );
}
