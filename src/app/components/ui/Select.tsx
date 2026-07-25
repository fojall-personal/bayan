'use client';

import { useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function Select({ options, value, onChange, label, className = '' }: SelectProps) {
  const id = useId();
  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-ground-300">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border border-ground-700 bg-ground-800 px-4 py-2.5 text-ground-50 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/50 ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
