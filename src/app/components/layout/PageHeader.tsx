'use client';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Short uppercase label above the title, e.g. the module name. */
  eyebrow?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="mb-10 flex flex-col gap-4 border-b border-ground-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
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
  );
}
