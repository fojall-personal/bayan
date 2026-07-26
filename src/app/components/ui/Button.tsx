'use client';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
  'aria-pressed'?: boolean;
}

// Full class strings, never interpolated — Tailwind only generates what it can
// see as a literal.
const VARIANTS: Record<string, string> = {
  // Dark ink on gold: 7.8:1. The old primary was white on #22c55e at 2.28:1,
  // which failed AA badly.
  primary: // hover was `hover:bg-gold-500` — identical to the base, so the app's main
    // call to action did not respond to the pointer at all. gold-400 is the
    // palette's lighter step and keeps canvas-dark ink well past AAA.
    'bg-gold-500 text-ground-950 hover:bg-gold-400 active:bg-gold-600 font-semibold',
  secondary: 'bg-ground-800 text-ground-50 border border-ground-700 hover:border-ground-600 hover:bg-ground-700',
  ghost: 'text-ground-300 hover:text-ground-50 hover:bg-ground-800',
  danger: 'bg-error text-ground-950 hover:opacity-90 font-semibold',
};

const SIZES: Record<string, string> = {
  // min-h keeps these above the 44px tap-target floor (WCAG 2.5.5, and both
  // platform HIGs). Measured on a phone, `md` — the DEFAULT, and what every
  // primary action uses — rendered 37px, and `sm` 33px. Padding alone could not
  // reach 44 without making the buttons look inflated on desktop, so the height is
  // set directly and the label stays centred.
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...aria
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...aria}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
