'use client';

import { useId, useRef } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  /** Describes the group for screen readers, e.g. "Learning views". */
  label: string;
  className?: string;
}

/**
 * Keyboard-operable tab switcher.
 *
 * /learning, /memorization and /tajweed each had their own pair of Buttons with
 * no roles and no keyboard handling, so the switchers were unreachable except by
 * tabbing to each one individually — and nothing announced them as a group or
 * said which was selected (audit BUG-007).
 *
 * Follows the ARIA tabs pattern: one tab stop for the whole list, arrow keys to
 * move between tabs, Home/End to jump to the ends.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
}: TabsProps<T>) {
  const groupId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (to: number) => {
    const next = (to + items.length) % items.length;
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(items.length - 1);
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`inline-flex gap-1 rounded-md border border-ground-800 bg-ground-900 p-1 ${className}`}
    >
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${groupId}-${item.id}`}
            aria-selected={selected}
            aria-controls={`${groupId}-${item.id}-panel`}
            // Only the selected tab is in the tab order, per the ARIA pattern.
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            // min-h-11 rather than more padding: these measured 33px high, under
            // the 44px tap-target floor, and every page uses this control to
            // switch view.
            className={`grid min-h-11 place-items-center rounded px-4 text-sm font-medium transition-colors ${
              selected
                ? 'bg-gold-500 text-ground-950'
                : 'text-ground-300 hover:bg-ground-800 hover:text-ground-50'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pairs with Tabs so the panel is associated with its tab. */
export function TabPanel({
  id,
  children,
}: {
  /** Must match the tab's id. */
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div role="tabpanel" aria-labelledby={id} tabIndex={0} className="focus:outline-none">
      {children}
    </div>
  );
}
