# Language Builder — Complete UI/UX Design Specification

## Design Philosophy

**Principles:**
- Clarity over decoration
- Arabic text is sacred — generous spacing, readable fonts
- Progress is visible and motivating
- Every screen has a clear next action
- Dark mode as default (easier on eyes for study sessions)
- Mobile-first but desktop-optimized

---

## 1. Design System

### Color Palette

**Primary (Arabic Green):**
```css
--green-50: #f0fdf4
--green-100: #dcfce7
--green-200: #bbf7d0
--green-300: #86efac
--green-400: #4ade80
--green-500: #22c55e  /* Primary */
--green-600: #16a34a
--green-700: #15803d
--green-800: #166534
--green-900: #14532d
```

**Secondary (Islamic Gold):**
```css
--gold-50: #fffbeb
--gold-100: #fef3c7
--gold-200: #fde68a
--gold-300: #fcd34d
--gold-400: #fbbf24
--gold-500: #f59e0b  /* Accent */
--gold-600: #d97706
--gold-700: #b45309
--gold-800: #92400e
--gold-900: #78350f
```

**Neutrals (Warm Gray):**
```css
--gray-50: #fafaf9
--gray-100: #f5f5f4
--gray-200: #e7e5e4
--gray-300: #d6d3d1
--gray-400: #a8a29e
--gray-500: #78716c
--gray-600: #57534e
--gray-700: #44403c
--gray-800: #292524
--gray-900: #1c1917
--gray-950: #0c0a09  /* Background */
```

**Tajweed Rule Colors:**
```css
--madd-blue: #3b82f6
--noon-green: #22c55e
--meem-cyan: #06b6d4
--qalqalah-yellow: #f59e0b
--ghunnah-pink: #ec4899
--makharij-purple: #8b5cf6
--makharij-orange: #f97316
```

### Typography

**Font Families:**
```css
--font-primary: 'IBM Plex Sans', system-ui, sans-serif
--font-arabic: 'Scheherazade New', 'Amiri', serif
--font-mono: 'IBM Plex Mono', monospace
```

**Type Scale:**
```css
--text-xs: 0.75rem (12px)
--text-sm: 0.875rem (14px)
--text-base: 1rem (16px)
--text-lg: 1.125rem (18px)
--text-xl: 1.25rem (20px)
--text-2xl: 1.5rem (24px)
--text-3xl: 1.875rem (30px)
--text-4xl: 2.25rem (36px)
--text-5xl: 3rem (48px)
```

**Line Heights:**
```css
--leading-tight: 1.25
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-arabic: 2.0  /* Generous for Arabic */
```

### Spacing Scale
```css
--space-1: 0.25rem (4px)
--space-2: 0.5rem (8px)
--space-3: 0.75rem (12px)
--space-4: 1rem (16px)
--space-5: 1.25rem (20px)
--space-6: 1.5rem (24px)
--space-8: 2rem (32px)
--space-10: 2.5rem (40px)
--space-12: 3rem (48px)
--space-16: 4rem (64px)
```

### Border Radius
```css
--radius-sm: 0.25rem (4px)
--radius-md: 0.5rem (8px)
--radius-lg: 0.75rem (12px)
--radius-xl: 1rem (16px)
--radius-full: 9999px
```

### Shadows
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3)
--shadow-md: 0 4px 6px rgba(0,0,0,0.4)
--shadow-lg: 0 10px 15px rgba(0,0,0,0.5)
--shadow-glow: 0 0 20px rgba(34, 197, 94, 0.3)
```

---

## 2. Component Library

### Button
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

// Primary: bg-green-500, text-white, hover:bg-green-600
// Secondary: bg-gray-800, text-gray-50, border border-gray-700
// Ghost: text-gray-400, hover:bg-gray-800
// Danger: bg-red-600, text-white
```

### Card
```typescript
interface CardProps {
  children: React.ReactNode;
  interactive?: boolean;
  className?: string;
}

// Base: bg-gray-900, border border-gray-800, rounded-xl, p-6
// Interactive: hover:border-green-500/50, hover:shadow-glow, transition-all
```

### ProgressBar
```typescript
interface ProgressBarProps {
  progress: number;  // 0-100
  label?: string;
  color?: string;  // 'green' | 'gold' | 'blue' | etc.
}

// Container: h-2, bg-gray-800, rounded-full
// Fill: bg-green-500, transition-all duration-500
```

### Badge
```typescript
interface BadgeProps {
  variant: 'default' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

// Default: bg-gray-700, text-gray-300
// Success: bg-green-500/20, text-green-400
// Warning: bg-yellow-500/20, text-yellow-400
// Error: bg-red-500/20, text-red-400
// Info: bg-blue-500/20, text-blue-400
```

### Input
```typescript
interface InputProps {
  label?: string;
  error?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  placeholder?: string;
}

// Container: space-y-2
// Label: block, text-sm, font-medium, text-gray-300
// Input: w-full, px-4, py-2.5, bg-gray-800, border border-gray-700, rounded-lg
// Focus: focus:ring-2, focus:ring-green-500/50, focus:border-green-500
// Error: border-red-500
```

### Select
```typescript
interface SelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}
```

### StatCard
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: { value: number; positive: boolean };
}

// Layout: flex items-start justify-between
// Value: text-2xl, font-bold
// Trend: mt-3, text-sm, text-green-500 or text-red-400
```

### QuizQuestion
```typescript
interface QuizQuestionProps {
  question: {
    type: 'multiple-choice' | 'fill-blank' | 'audio-recall';
    text: string;
    options?: string[];
  };
  answer: string;
  onAnswer: (answer: string) => void;
}

// Multiple choice: space-y-3, buttons with border
// Fill blank: input field with placeholder
// Selected state: border-green-500, bg-green-500/10, text-green-400
```

### EmptyState
```typescript
interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Layout: text-center, py-12
// Icon: text-4xl, mb-4
// Title: text-xl, font-semibold, mb-2
// Description: text-gray-400, mb-6, max-w-md
```

### LoadingCard (Skeleton)
```typescript
// Container: bg-gray-900, border border-gray-800, rounded-xl, p-6
// Skeleton: bg-gray-800, animate-pulse, rounded
```

---

## 3. Layout Components

### AppShell
```typescript
interface AppShellProps {
  children: React.ReactNode;
  sidebar?: boolean;
}

// Mobile: sidebar hidden, bottom tab bar
// Desktop: fixed sidebar 280px, main content ml-[280px]
```

### Sidebar
```typescript
// Fixed: left-0, top-0, bottom-0, w-[280px]
// Background: bg-gray-900, border-r border-gray-800
// Padding: p-6
// Logo: flex items-center gap-3, mb-8
// Nav items: space-y-2, flex, items-center, gap-3, px-4, py-3, rounded-lg
// Active: bg-green-500/10, text-green-400
// Hover: bg-gray-800, text-gray-50
```

### PageHeader
```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

// Layout: flex items-start justify-between, mb-8
// Title: text-3xl, font-bold
// Subtitle: text-gray-400, mt-2
// Actions: flex gap-3
```

### MobileNav
```typescript
// Fixed: bottom-0, left-0, right-0
// Background: bg-gray-900, border-t border-gray-800
// Padding: p-2
// Layout: flex, justify-around
// Nav item: flex flex-col, items-center, gap-1, px-3, py-2
// Text: text-[10px]
// Active: text-green-400
```

---

## 4. Page Specifications

### Landing Page (Decide/Learn Surface)

**Hero Section:**
- Full viewport height
- Large Arabic calligraphy decorative background (low opacity)
- Clean English headline: "Learn to Read the Quran with Confidence"
- Single CTA: "Start Your Journey →"
- Dark background (gray-950)

**Three Pillars (Compare Surface):**
- Three equal-weight cards
- No icons above headings
- Clear value props: Assessment, Learning, Memorization
- Card: bg-gray-900, border, rounded-xl, p-6

**How It Works (Monitor Surface):**
- Simple 3-step list
- 1. Take Assessment (30 min)
- 2. Get Your Path
- 3. Learn at Your Pace

**No fake stats, no testimonials, no generic feature grids.**

---

### Onboarding Flow (Configure Surface)

**Step 1: Goal Selection**
- Vertical stack of selectable cards
- Selected state: green border + light green background
- Each card: icon, title, subtitle
- "Next" disabled until selection

**Step 2: Self-Assessment**
- Grouped questions (3 total, not separate pages)
- Button groups for equal-weight options
- Clear visual hierarchy

**Step 3: Assessment Prompt**
- Confirmation screen before commitment
- Summary of choices
- Clear what's coming next
- Single CTA button

---

### Assessment Dashboard (Monitor Surface)

**Layout:**
- Four progress bars with clear labels
- Path assignment prominently displayed
- Actionable next steps
- Two CTAs: primary (start learning), secondary (retake)

---

### Dashboard (Monitor Surface)

**Quick Actions:**
- Three quick action cards (primary CTAs)
- Continue Lesson, Review Memorization, Take Quiz

**Progress Overview:**
- Four colored bars (literacy, comprehension, grammar, memorization)
- Percentage values

**Today's Plan:**
- Actionable items, not generic
- Example: "Review: 3 vocabulary words"

**Weekly Progress:**
- Progress toward weekly goal
- Example: "3/5 lessons completed"

**Score History:**
- Line chart (real data)
- Shows literacy, grammar, memorization over time

**Mobile Behavior:**
- Quick actions become horizontal scroll
- Progress bars stack vertically
- Today's plan collapses to show only next item

---

### Learning Pages (Operate Surface)

**Lesson View:**
- Progress bar at top (completion tracking)
- Content first, exercise second
- Audio button for pronunciation
- Input fields for exercise answers
- Explanation appears after attempt (not before)
- Clear next action button

**Flashcard View:**
- Large card in center (focus)
- Flip animation on click
- Three-response button group (struggle/ok/easy)
- Card counter at top
- Swipe gestures for mobile

---

### Memorization Pages (Monitor Surface)

**Surah Overview:**
- Visual ayah grid (✓ = mastered, ● = new)
- Per-ayah audio recording option
- Today's review count (actionable)
- Single CTA for review session

**Review Session:**
- Three-step flow (listen → recite → rate)
- Progress indicator (3/10)
- One action per step (no confusion)
- 1-5 rating scale for spaced repetition

---

### Tajweed Viewer (Explore Surface)

**Layout:**
- Arabic text with color-coded tajweed rules
- Hover shows rule explanation
- Click highlights all instances of that rule
- Color legend with rule names
- Practice section for focused learning

---

### Grammar Deep-Dive (Decide/Learn Surface)

**Layout:**
- Editorial layout (Decide/Learn surface)
- Conjugation table with clear structure
- Practice exercises with input fields
- Grammar parser for user input

---

### AI Tutor (Operate Surface)

**Layout:**
- Chat interface (messages aligned left/right)
- User messages on right (green), AI on left (gray)
- AI has context (knows user's level, weak areas)
- Generated exercises appear inline
- Clear history button for privacy

---

### Analytics Page (Monitor Surface)

**Score History:**
- Line chart for score history (real data)

**Module Breakdown:**
- Progress bars with week-over-week trends

**Time on Task:**
- Metrics (not fake)

**Error Patterns:**
- Actionable data

**Recommendations:**
- Specific, not generic

---

### Settings Page (Configure Surface)

**Layout:**
- Grouped settings sections
- Clear save buttons per section
- Destructive actions (delete account) clearly marked
- Toggle switches for notifications

---

## 5. Interaction Patterns

### Loading States
```
Container: bg-gray-900, border border-gray-800, rounded-xl, p-6
Skeleton: bg-gray-800, animate-pulse, rounded
Stack 2-3 cards for list views
```

### Empty States
- Centered layout
- Clear icon, title, description
- Single actionable CTA
- No filler text

### Network Error
- Warning icon
- Clear error message
- Two action options (retry/refresh)
- No technical jargon

### Success States
- Checkmark icon
- Completion confirmation with time
- Clear next step suggestion
- Two CTAs: continue (primary) / view progress (secondary)

---

## 6. Responsive Breakpoints

```css
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

**Mobile First:**
- Sidebar hidden on mobile
- Bottom tab bar (5 tabs max)
- Cards stack vertically
- Input fields full width

**Desktop:**
- Fixed sidebar 280px
- Multi-column layouts
- Hover states enabled
- Larger touch targets

---

## 7. Accessibility

**Contrast:**
- All text meets WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Interactive elements have clear focus states

**Keyboard Navigation:**
- All interactive elements focusable
- Tab order logical
- Skip links for main content

**Screen Readers:**
- Semantic HTML (headings, lists, buttons)
- ARIA labels where needed
- Alt text for images

**Motion:**
- Respect prefers-reduced-motion
- No auto-playing animations
- Subtle transitions only

---

## 8. Anti-Slop Checklist

Before finalizing any page design, verify:
- [ ] No generic gradient backgrounds
- [ ] No icon-topper pattern (icon above every heading)
- [ ] No center-stack for Operate/Monitor surfaces
- [ ] Tajweed colors are functional, not decorative
- [ ] Arabic text has generous line height (2.0)
- [ ] Progress indicators use green, not generic blue
- [ ] No fake metrics or placeholder stats
- [ ] Empty states have actionable suggestions
- [ ] Every screen has a clear next action
- [ ] Mobile layouts tested at 320px width

---

## 9. Implementation Notes

### File Structure
```
app/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   └── PageHeader.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── StatCard.tsx
│   │   ├── QuizQuestion.tsx
│   │   ├── EmptyState.tsx
│   │   └── LoadingCard.tsx
│   ├── learning/
│   │   ├── LessonView.tsx
│   │   └── FlashcardView.tsx
│   ├── memorization/
│   │   ├── SurahOverview.tsx
│   │   └── ReviewSession.tsx
│   ├── tajweed/
│   │   └── TajweedViewer.tsx
│   └── tutor/
│       └── ChatInterface.tsx
├── hooks/
│   ├── useLocalStorage.ts
│   └── useAudioRecorder.ts
└── styles/
    └── globals.css
```

### Tailwind Configuration
```javascript
module.exports = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          // ... etc
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          // ... etc
        },
      },
      fontFamily: {
        primary: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        arabic: ['Scheherazade New', 'Amiri', 'serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
```

### Key Interactions
- **Audio recording:** useAudioRecorder hook
- **Spaced repetition:** interval calculation algorithm
- **Progress tracking:** localStorage + D1 database
- **AI chat:** streaming responses with TypewriterEffect
- **Flashcard flip:** CSS transform rotateY

---

This design system provides everything needed to build a polished, functional UI/UX for the Language Builder app. All components are reusable, responsive, and follow accessibility best practices.
