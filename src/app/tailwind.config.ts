import type { Config } from 'tailwindcss';

/**
 * Every value here mirrors a custom property in styles/globals.css, which is the
 * source of truth. Compose in components with these utilities — there is no CSS
 * component layer to reach for.
 *
 * `gray` is an alias of `ground` on purpose: a stray `bg-gray-800` left over
 * from the previous palette still lands on a correct surface instead of
 * Tailwind's default cold grey.
 */

const ground = {
  50: '#f2ead7',
  100: '#e8dfc8',
  200: '#d6cdb6',
  300: '#b7af98',
  400: '#8b8471',
  500: '#5c7d6c',
  600: '#33604c',
  700: '#1e4436',
  800: '#16332a',
  900: '#0d1f19',
  950: '#071411',
};

const gold = {
  200: '#f2e7c4',
  300: '#ead69b',
  400: '#dfc073',
  500: '#c9a227',
  600: '#a8861c',
  700: '#7a6114',
};

const leaf = {
  400: '#6fc79a',
  500: '#3e9b72',
  600: '#2f7a58',
};

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './styles/**/*.{css,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ground,
        gray: ground,
        gold,
        leaf,

        // Semantic
        ink: ground[50],
        muted: ground[300],
        subtle: ground[400],
        surface: {
          DEFAULT: ground[900],
          2: ground[800],
        },
        border: ground[700],
        success: leaf[500],
        warning: gold[500],
        error: '#e5786a',
        info: '#6ba8f5',

        // Tajweed — functional rule colours, retuned for the green ground.
        tajweed: {
          madd: '#6ba8f5',
          'noon-saakin': '#7fd8c0',
          'meem-saakin': '#5fd1e8',
          qalqalah: '#f58c5c',
          ghunnah: '#f58bc0',
          makharij: '#b99bf0',
        },
      },
      fontFamily: {
        display: ["'Reem Kufi'", "'Amiri'", 'serif'],
        body: ["'IBM Plex Sans'", 'system-ui', 'sans-serif'],
        arabic: ["'Amiri'", "'Scheherazade New'", 'serif'],
        mono: ["'IBM Plex Mono'", 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.55' }],
        lg: ['1.125rem', { lineHeight: '1.55' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.55',
        relaxed: '1.7',
        arabic: '2.1',
      },
      letterSpacing: {
        label: '0.16em',
      },
      spacing: {
        page: 'var(--padding-page)',
        section: 'var(--padding-section)',
        card: 'var(--padding-card)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        glow: 'var(--shadow-glow)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s cubic-bezier(0.2,0.8,0.2,1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
