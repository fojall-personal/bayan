'use client';

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
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-300">{label}</label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-50 focus:outline-none focus:ring-2 focus:ring-arabic-green/50 focus:border-arabic-green transition-all ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
