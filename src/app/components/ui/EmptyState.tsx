'use client';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

/**
 * Empty states always carry an action — an empty screen with no next step is one
 * of the anti-slop tells in DESIGN.md.
 *
 * No icon prop: the previous version required an emoji string, which is tell 12
 * (decorative glyph above a heading).
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-md py-14 text-center">
      <h3 className="font-display text-xl font-semibold text-ground-50">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ground-300">{description}</p>
      {action && (
        <div className="mt-7">
          <Button onClick={action.onClick}>{action.label}</Button>
        </div>
      )}
    </div>
  );
}
