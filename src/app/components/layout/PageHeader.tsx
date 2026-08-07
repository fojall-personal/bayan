'use client';

import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Short uppercase label above the title, e.g. the module name. */
  eyebrow?: string;
  actions?: React.ReactNode;
  /**
   * Where this page came from, for pages reached by exactly one in-app link
   * and absent from the top nav (Advanced, Calibrate, Tajweed) — without
   * this the only way back was the browser's own back button.
   */
  backHref?: string;
  /** Defaults to "Back". Pass the place it returns to, e.g. "Back to Memorization". */
  backLabel?: string;
}

export function PageHeader({ title, subtitle, eyebrow, actions, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="mb-10 border-b border-ground-800 pb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-sm text-ground-400 transition-colors hover:text-gold-400"
        >
          ← {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-label text-gold-400">
              {eyebrow}
            </div>
          )}
          <h1 className="font-display text-3xl font-semibold text-ground-50">{title}</h1>
          {subtitle && <p className="mt-2 max-w-prose text-ground-300">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
    </div>
  );
}
