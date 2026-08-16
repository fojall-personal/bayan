# Bayan — Page UI Specifications

> **Pre-implementation design spec.** Written before the code, and kept for its
> reasoning rather than as a description of the app. Where it disagrees with the app,
> the app is right.
>
> Authoritative now: `README.md` for what works and what is planned, `AGENTS.md` for the
> live API and page lists (both generated from source and gated in CI), and
> `docs/lesson-review.html` for the lesson content.
>
> Known to describe things that did not ship:
> - audio recording of your own recitation — never built; no microphone capture exists
> - daily streaks — no streak counter shipped; /progress shows a weekly activity calendar
> - an AI Tutor operate surface — the live page is Look up (`/tutor`)


## 1. Landing Page (Decide/Learn Surface)

**Purpose:** Convert visitors into users. Single idea per section.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]                          [Sign In] [Get Started]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hero Section (full viewport height)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │   Learn to Read the Quran                            │  │
│  │   with Confidence                                     │  │
│  │                                                       │  │
│  │   [Arabic calligraphy decorative element]            │  │
│  │                                                       │  │
│  │   Start your journey →                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Three Pillars (Compare Surface)                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ 📊         │  │ 📖         │  │ 🕌         │            │
│  │ Assessment │  │ Learning   │  │ Memorization│            │
│  │            │  │            │  │             │            │
│  │ Adaptive   │  │ Interactive│  │ Spaced      │            │
│  │ placement  │  │ lessons    │  │ repetition  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
├─────────────────────────────────────────────────────────────┤
│  How It Works (Monitor Surface - simple)                    │
│  1. Take Assessment (30 min)                               │
│  2. Get Your Path                                          │
│  3. Learn at Your Pace                                     │
├─────────────────────────────────────────────────────────────┤
│  Footer                                                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions
- **Hero:** Large serif Arabic text as decorative background (low opacity). Clean English headline. Single CTA button.
- **Pillars:** Three equal-weight cards. No icons above headings (anti-slop). Clear value props.
- **Colors:** Dark background (gray-950), Arabic green accent, warm gray text.
- **No fake stats, no testimonials, no generic feature grids.**

### Mobile Behavior
- Hero text scales down but maintains hierarchy
- Pillar cards stack vertically
- CTA button sticky at bottom

---

## 2. Onboarding Flow (Configure Surface)

**Purpose:** Collect user preferences and assign learning path. Wizard format.

### Step 1: Goal Selection
```
┌─────────────────────────────────────────────────────────────┐
│  Step 1 of 3                                                │
│                                                             │
│  What's your primary goal?                                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📖                                                   │   │
│  │ Read the Quran fluently                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🧠                                                   │   │
│  │ Understand Classical Arabic                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🕌                                                   │   │
│  │ Memorize the Quran (Hifz)                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ✨                                                   │   │
│  │ All of the above                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│                    [Next →]                                │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Vertical stack of selectable cards (not radio buttons)
- Selected state: green border + light green background
- Each card has icon, title, subtitle
- "Next" disabled until selection

---

### Step 2: Self-Assessment
```
┌─────────────────────────────────────────────────────────────┐
│  Step 2 of 3                                                │
│                                                             │
│  Quick Self-Assessment                                      │
│                                                             │
│  Can you read Arabic script?                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │   No     │  │ Partial  │  │   Yes    │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  How many surahs have you memorized?                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   None   │  │  1-5     │  │  6-20    │  │   21+    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  What's your biggest challenge?                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Reading  │  │ Grammar  │  │Memorizn  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                             │
│  [← Back]                [Next →]                          │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Grouped questions (3 total, not separate pages)
- Button groups for equal-weight options
- Clear visual hierarchy: question → options → next

---

### Step 3: Assessment Prompt
```
┌─────────────────────────────────────────────────────────────┐
│  Step 3 of 3                                                │
│                                                             │
│  Ready to Get Started?                                      │
│                                                             │
│  Take our 30-minute diagnostic assessment to personalize    │
│  your learning path.                                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Your Profile:                                        │   │
│  │ • Goal: Read the Quran                               │   │
│  │ • Reading: Partial                                   │   │
│  │ • Memorized: 0 surahs                                │   │
│  │ • Challenge: Reading                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Assessment covers:                                         │
│  • Arabic script literacy                                  │
│  • Comprehension level                                     │
│  • Grammar knowledge                                       │
│  • Memorization baseline                                   │
│                                                             │
│  [Start Assessment →]                                      │
│                                                             │
│  [← Back]                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Confirmation screen before committing to assessment
- Summary of choices
- Clear what's coming next
- Single CTA button

---

## 3. Assessment Dashboard (Monitor Surface)

**Purpose:** Show assessment results and assign learning path.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Assessment Results                                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your Learning Path: Path 2 (Conversational Speaker)       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Literacy:     ████████████████░░░░  72%              │   │
│  │ Comprehension: ██████████████░░░░░░  58%             │   │
│  │ Grammar:      ████████████░░░░░░░░  45%             │   │
│  │ Memorization: ██████████████░░░░░░  61%             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Next Steps:                                                │
│  • Start with Arabic alphabet review                        │
│  • Focus on grammar foundations                             │
│  • Begin short surah memorization                           │
│                                                             │
│  [Start Learning →]  [Retake Assessment]                    │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Four progress bars with clear labels
- Path assignment prominently displayed
- Actionable next steps (not generic)
- Two CTAs: primary (start learning), secondary (retake)

---

## 4. Dashboard (Monitor Surface)

**Purpose:** User's home base. Glanceable overview of all learning activity.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Welcome back, Fouad!                           🔥 7 day   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Quick Actions                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 📖 Continue  │  │ 🕌 Review   │  │ 📝 Quiz     │        │
│  │ Lesson       │  │ Memorization│  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  Progress Overview                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────┐│
│  │ Literacy   │  │Comprehens. │  │  Grammar   │  │Memorizn││
│  │    72%     │  │    58%     │  │    45%     │  │  61%   ││
│  │████████░░  │  │███████░    │  │██████      │  │██████░ ││
│  └────────────┘  └────────────┘  └────────────┘  └────────┘│
│                                                             │
│  Today's Plan                                               │
│  • Review: 3 vocabulary words                              │
│  • New: Grammar-05 (20 min)                                │
│  • Recall: Surah 1, Ayah 1-3                               │
│                                                             │
│  Weekly Progress                                            │
│  This week: 3/5 lessons completed                          │
│                                                             │
│  Score History (line chart)                                 │
│  [Chart showing literacy, grammar, memorization over time] │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Streak counter with fire emoji (motivation)
- Three quick action cards (primary CTAs)
- Progress overview with four colored bars
- Today's plan is actionable, not generic
- Weekly progress with clear target
- Score history chart (not fake metrics)

### Mobile Behavior
- Quick actions become horizontal scroll
- Progress bars stack vertically
- Today's plan collapses to show only next item

---

## 5. Learning Pages (Operate Surface)

**Purpose:** Interactive lessons with exercises. Action-oriented.

### Lesson View
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Grammar Foundations - Lesson 5           75%    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Progress bar: 75% of lesson complete]                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Lesson Content                                        │   │
│  │                                                       │   │
│  │ Today we're learning about verb conjugation...        │   │
│  │                                                       │   │
│  │ Example sentence:                                     │   │
│  │ هُوَ يَكْتُبُ الكِتَابَ                               │
│  │ (He is writing the book)                             │   │
│  │                                                       │   │
│  │ [Audio player: Listen to pronunciation]              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Exercise: Conjugate the verb "كَتَبَ" (to write)    │   │
│  │                                                       │   │
│  │ I write:  __________                                 │   │
│  │ You write: __________                                │   │
│  │ He writes: __________                                │   │
│  │                                                       │   │
│  │ [Check Answer]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Explanation (shown after attempt)                     │   │
│  │                                                       │   │
│  │ Correct! The pattern for Form I past tense is...      │   │
│  │                                                       │   │
│  │ [Continue to Next]                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Progress bar at top (completion tracking)
- Content first, exercise second
- Audio button for pronunciation
- Input fields for exercise answers
- Explanation appears after attempt (not before)
- Clear next action button

### Flashcard View
```
┌─────────────────────────────────────────────────────────────┐
│  Vocabulary Review - 24 cards remaining                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │              كِتَاب                                  │   │
│  │                                                      │   │
│  │  [Flip card to see answer]                          │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  How well did you remember?                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Struggle   │  │   Okay       │  │   Easy       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  [Next Card →]                                              │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Large card in center (focus)
- Flip animation on click
- Three-response button group (struggle/ok/easy)
- Card counter at top
- Swipe gestures for mobile

---

## 6. Memorization Pages (Monitor Surface)

**Purpose:** Track memorization progress and manage reviews.

### Surah Overview
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Surah Al-Fatiha (1)                     6/7    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Progress: 6/7 ayahs mastered (86%)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1   ✓  2   ✓  3   ✓  4   ✓  5   ✓  6   ✓  7   ●   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Ayah 7 - Not Yet Memorized                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  رَبِّ اغْفِر لِي وَلِوَالِدَيَّ                    │   │
│  │                                                       │   │
│  │  [Listen] [Record Myself]                             │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Today's Review: 3 ayahs due                               │
│  [Start Review Session →]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Visual ayah grid (✓ = mastered, ● = new)
- Per-ayah audio recording option
- Today's review count (actionable)
- Single CTA for review session

### Review Session
```
┌─────────────────────────────────────────────────────────────┐
│  Review: Surah 1, Ayahs 1-3                            3/10  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Listen                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ             │   │
│  │                                                       │   │
│  │  [▶ Play Recitation]                                  │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Step 2: Recite                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  [🎤 Record Your Recitation]                          │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Step 3: Rate                                               │
│  How well did you remember?                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 1. Didn't remember                                   │   │
│  │ 2. Struggled                                         │   │
│  │ 3. Remembered with difficulty                        │   │
│  │ 4. Remembered fairly well                            │   │
│  │ 5. Remembered perfectly                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Three-step flow (listen → recite → rate)
- Progress indicator (3/10)
- One action per step (no confusion)
- 1-5 rating scale for spaced repetition

---

## 7. Tajweed Viewer (Explore Surface)

**Purpose:** Color-coded Quran text by rule. Interactive exploration.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Surah Al-Ikhlas                      Tajweed   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │  قُلْ هُوَ اللَّهُ أَحَدٌ                          │   │
│  │                                                       │   │
│  │  [Audio: Listen] [Audio: Recite]                     │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Color Legend                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 蓝色     │  │ 绿色     │  │ 橙色     │  │ 粉色     │   │
│  │ Madd     │  │ Noon     │  │ Qalqalah │  │ Ghunnah  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  Practice This Rule                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Focus: Madd (elongation)                             │   │
│  │                                                       │   │
│  │ Identify the Madd in these words:                    │   │
│  │                                                       │   │
│  │ [Multiple choice options]                            │   │
│  │                                                       │   │
│  │ [Submit Answer]                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Arabic text with color-coded tajweed rules
- Hover shows rule explanation
- Click highlights all instances of that rule
- Color legend with rule names
- Practice section for focused learning

---

## 8. Grammar Deep-Dive (Decide/Learn Surface)

**Purpose:** Advanced grammar lessons with parsing and conjugation.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Grammar Deep-Dive: Verb Conjugation      Level 3│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Lesson Content                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                       │   │
│  │ Arabic verbs change based on tense, person, and       │   │
│  │ number. Here's how Form I past tense works...         │   │
│  │                                                       │   │
│  │ هُوَ كَتَبَ  (He wrote)                              │   │
│  │ هِيَ كَتَبَتْ  (She wrote)                           │   │
│  │                                                       │   │
│  │ [Audio: Listen to pronunciation]                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Conjugation Table                                          │
│  ┌──────────────┬────────────────┐                          │
│  │ Form         │ Arabic         │                          │
│  ├──────────────┼────────────────┤                          │
│  │ Past (he)    │ كَتَبَ         │                          │
│  │ Past (she)   │ كَتَبَتْ       │                          │
│  │ Present (he) │ يَكْتُبُ       │                          │
│  │ Imperative   │ اُكْتُبْ       │                          │
│  └──────────────┴────────────────┘                          │
│                                                             │
│  Practice: Parse This Sentence                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ هُوَ يَكْتُبُ الكِتَابَ                               │   │
│  │                                                       │   │
│  │ Identify:                                             │   │
│  │ • Subject: __________                                │   │
│  │ • Verb: __________                                   │   │
│  │ • Object: __________                                 │   │
│  │                                                       │   │
│  │ [Check Answer]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Grammar Check: Type a sentence to analyze                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Input field: Type Arabic sentence...]               │   │
│  │                                                       │   │
│  │ [Parse]                                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Editorial layout (Decide/Learn surface)
- Conjugation table with clear structure
- Practice exercises with input fields
- Grammar parser for user input

---

## 9. AI Tutor (Operate Surface)

**Purpose:** Chat-based grammar explanations with context awareness.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  AI Tutor                              [Clear History]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ You                                                   │   │
│  │ Explain madd types                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Tutor                                              │   │
│  │                                                       │   │
│  │ Great question about Madd! Since you're currently     │   │
│  │ working on grammar, let me explain this in context... │   │
│  │                                                       │   │
│  │ There are three main types:                           │   │
│  │ 1. Madd Tabi'i (2 counts)                            │   │
│  │ 2. Madd Wajib (4-5 counts)                           │   │
│  │ 3. Madd Lazim (6 counts)                             │   │
│  │                                                       │   │
│  │ Would you like practice exercises?                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ You                                                   │   │
│  │ Yes, generate exercises                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AI Tutor                                              │   │
│  │                                                       │   │
│  │ Here are some exercises focusing on Madd...          │   │
│  │                                                       │   │
│  │ [Generated exercise card]                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Chat interface (messages aligned left/right)
- User messages on right (green), AI on left (gray)
- AI has context (knows user's level, weak areas)
- Generated exercises appear inline
- Clear history button for privacy

---

## 10. Analytics Page (Monitor Surface)

**Purpose:** Detailed breakdown of learning patterns and progress.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Your Progress                            Export  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Score History (last 30 days)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [Line chart: literacy, grammar, memorization scores] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Module Breakdown                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Literacy    ████████████████░░░░  72%  (+5% this week)│   │
│  │ Grammar     ████████████░░░░░░░░  45%  (-2% this week)│   │
│  │ Memorization█████████████░░░░░░░  61%  (+3% this week)│   │
│  │ Comprehension█████████████░░░░░░░  58%  (+1% this week)│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Time on Task                                               │
│  Today: 45 min  |  This week: 4.2 hrs  |  Total: 28 hrs   │
│                                                             │
│  Error Patterns                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Most errors: Verb conjugation (12 errors)            │   │
│  │ Second: Tajweed rules (8 errors)                     │   │
│  │ Third: Vocabulary recall (6 errors)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Recommendations                                            │
│  • Focus on verb conjugation practice                      │
│  • Review tajweed rules for Surah Al-Fatiha               │
│  • Increase daily vocabulary review to 15 words           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Line chart for score history (real data)
- Module breakdown with week-over-week trends
- Time on task metrics (not fake)
- Error patterns (actionable)
- Recommendations (not generic)

---

## 11. Settings Page (Configure Surface)

**Purpose:** User preferences and account management.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  < Back     Settings                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Profile                                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Name:  Fouad Jallouli                                │   │
│  │ Email: [input field]                                 │   │
│  │                                                       │   │
│  │ [Save Changes]                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Learning Preferences                                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Daily Goal: [15 min] [30 min] [45 min] [60 min]     │   │
│  │                                                       │   │
│  │ Start Time: [08:00]                                  │   │
│  │                                                       │   │
│  │ [Save Preferences]                                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Notifications                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ [ ] Daily reminder                                   │   │
│  │ [ ] Weekly progress report                           │   │
│  │ [ ] New content available                            │   │
│  │                                                       │   │
│  │ [Save Settings]                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Account                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Change Password                                      │   │
│  │ Delete Account (cannot be undone)                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Grouped settings sections
- Clear save buttons per section
- Destructive actions (delete account) clearly marked
- Toggle switches for notifications

---

## Mobile Navigation

### Bottom Tab Bar (Mobile Only)
```
┌─────────────────────────────────────────────────────────────┐
│  [🏠]  [📊]  [📖]  [🕌]  [⚙️]                           │
│  Dash  Assess Learn Memoriz Settings                          │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- 5 tabs max (fits thumb reach)
- Icons + labels
- Active tab highlighted in Arabic green
- Fixed at bottom (iOS safe area)

---

## Empty States

### No Assessments Yet
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       📊                                     │
│                                                             │
│              No Assessment Data                              │
│                                                             │
│       Take the diagnostic assessment to see your learning   │
│       path and personalized recommendations.                │
│                                                             │
│              [Start Assessment →]                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Centered layout
- Clear icon, title, description
- Single actionable CTA
- No filler text

---

## Loading States

### Skeleton Cards
```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   │
│  │ ████████████████████████████████████████████████████ │   │
│  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Pulse animation (1.5s ease-in-out)
- Gray background (gray-800)
- Match card dimensions
- Stack 2-3 cards for list views

---

## Error States

### Network Error
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       ⚠️                                    │
│                                                             │
│              Connection Lost                                 │
│                                                             │
│    Please check your internet connection and try again.     │
│                                                             │
│              [Retry]  [Refresh Page]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Warning icon
- Clear error message
- Two action options (retry/refresh)
- No technical jargon

---

## Success States

### Lesson Complete
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       ✓                                     │
│                                                             │
│              Lesson Complete!                               │
│                                                             │
│       Great work! You completed Grammar-05 in 18 minutes.  │
│                                                             │
│       Next: Vocabulary Review (15 min)                     │
│                                                             │
│              [Continue Learning]  [View Progress]           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Checkmark icon
- Completion confirmation with time
- Clear next step suggestion
- Two CTAs: continue (primary) / view progress (secondary)
