'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

// `success` previously used bg-arabic-green/20 and text-arabic-green-400 —
// colours absent from the palette, so the badge rendered entirely unstyled.
const VARIANTS: Record<string, string> = {
  default: 'bg-ground-800 text-ground-300 ring-1 ring-inset ring-ground-700',
  success: 'bg-leaf-500/15 text-leaf-400 ring-1 ring-inset ring-leaf-500/30',
  warning: 'bg-gold-500/15 text-gold-400 ring-1 ring-inset ring-gold-500/30',
  error: 'bg-error/15 text-error ring-1 ring-inset ring-error/30',
  info: 'bg-info/15 text-info ring-1 ring-inset ring-info/30',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
