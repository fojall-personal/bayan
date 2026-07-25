'use client';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-300">{label}</label>
      )}
      <input
        className={`w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-arabic-green/50 focus:border-arabic-green transition-all ${
          error ? 'border-error' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
