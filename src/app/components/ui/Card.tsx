'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  /** Renders on the darker canvas instead of the raised surface. */
  flush?: boolean;
}

export function Card({ children, className = '', interactive = false, flush = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-ground-800 p-card ${
        flush ? 'bg-ground-950' : 'bg-ground-900'
      } ${
        interactive
          ? 'cursor-pointer transition-colors duration-200 hover:border-gold-500/40 hover:bg-ground-800'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
