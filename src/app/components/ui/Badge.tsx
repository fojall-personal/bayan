'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-gray-700 text-gray-300',
    success: 'bg-arabic-green/20 text-arabic-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    error: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
