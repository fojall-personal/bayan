import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{css,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Arabic Green — Primary
        primary: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e", // Primary accent
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
        },
        // Gold — Secondary (Islamic art reference)
        secondary: {
          50:  "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b", // Accent for highlights
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
        // Warm gray neutrals (no cold blue)
        gray: {
          50:   "#fafaf9",
          100:  "#f5f5f4",
          200:  "#e7e5e4",
          300:  "#d6d3d1",
          400:  "#a8a29e",
          500:  "#78716c",
          600:  "#57534e",
          700:  "#44403c",
          800:  "#292524",
          900:  "#1c1917",
          950:  "#0c0a09", // Page background
        },
        // Semantic
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error:   "#ef4444",
        info:    "#3b82f6",
        // Tajweed rule colors (functional, not decorative)
        tajweed: {
          madd:           "#3b82f6",
          noonSaakin:     "#22c55e",
          meemSaakin:     "#06b6d4",
          qalqalah:       "#f59e0b",
          ghunnah:        "#ec4899",
          makharijGaf:    "#8b5cf6",
          makharijHatif:  "#f97316",
        },
        // Surface aliases (dark mode default)
        surface: {
          DEFAULT: "var(--color-surface)",
          2:       "var(--color-surface-2)",
        },
        border: "var(--color-border)",
        ink:    "var(--color-ink)",
        muted:  "var(--color-muted)",
      },
      fontFamily: {
        primary: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        arabic:  ["'Scheherazade New'", "'Amiri'", "serif"],
        mono:    ["'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        xs:    "0.75rem",   // 12px — labels, metadata
        sm:    "0.875rem",  // 14px — body secondary
        base:  "1rem",      // 16px — body default
        lg:    "1.125rem",  // 18px — body emphasis
        xl:    "1.25rem",   // 20px — heading 4
        "2xl": "1.5rem",    // 24px — heading 3
        "3xl": "1.875rem",  // 30px — heading 2
        "4xl": "2.25rem",   // 36px — heading 1
        "5xl": "3rem",      // 48px — hero titles
      },
      lineHeight: {
        tight:    "1.25",
        normal:   "1.5",
        relaxed:  "1.625",
        arabic:   "2.0", // Generous spacing for Arabic text
      },
      spacing: {
        "page":   "var(--padding-page)",
        "section":"var(--padding-section)",
        "card":   "var(--padding-card)",
      },
      boxShadow: {
        sm:   "var(--shadow-sm)",
        md:   "var(--shadow-md)",
        lg:   "var(--shadow-lg)",
        xl:   "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
      },
      borderRadius: {
        sm:    "var(--radius-sm)",
        md:    "var(--radius-md)",
        lg:    "var(--radius-lg)",
        xl:    "var(--radius-xl)",
        full:  "var(--radius-full)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease",
        "stagger-1":  "fadeIn 0.3s ease 0ms forwards",
        "stagger-2":  "fadeIn 0.3s ease 50ms forwards",
        "stagger-3":  "fadeIn 0.3s ease 100ms forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
