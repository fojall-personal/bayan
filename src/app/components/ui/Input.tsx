'use client';

import { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Set 'auto' to pick direction from the value's script. */
  dir?: 'ltr' | 'rtl' | 'auto';
}

/** True when the string contains Arabic-block characters. */
export function isArabic(value: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(value);
}

export function Input({ label, error, className = '', dir, value, ...props }: InputProps) {
  const id = useId();
  // 'auto' rather than a hardcoded rtl: the tutor input was permanently RTL, so
  // English typing ran backwards.
  const resolvedDir =
    dir === 'auto' || dir === undefined
      ? typeof value === 'string' && isArabic(value)
        ? 'rtl'
        : 'ltr'
      : dir;

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ground-300">
          {label}
        </label>
      )}
      <input
        id={id}
        dir={resolvedDir}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-md border bg-ground-800 px-4 py-2.5 text-ground-50 placeholder-ground-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/50 ${
          error ? 'border-error' : 'border-ground-700 focus:border-gold-500'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
