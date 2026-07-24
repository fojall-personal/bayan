'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export function Card({ children, className = '', interactive = false }: CardProps) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-6 ${
        interactive
          ? 'hover:border-primary-500/50 hover:shadow-glow transition-all cursor-pointer'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
