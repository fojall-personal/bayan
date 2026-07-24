# Language Builder — Web App Plan
## Arabic Comprehension, Classical Grammar & Quran Memorization

---

## 1. Research Summary

### What Exists (Gaps Identified)

| App/Platform | Focus | Gaps |
|--------------|-------|------|
| **Tarteel AI** | Hifz memorization | No Arabic grammar/reading instruction |
| **Test Quran** | Memorization testing | No teaching component |
| **Quran Memorizer** | Digital mushaf, word hiding | No grammar, no comprehension tracking |
| **Arabic101** | Modern Arabic + Quran | No Classical Arabic focus, no tajweed integration |
| **AlifBee** | Spoken Arabic | Not Quran-focused, no grammar depth |
| **Understand Quran** | Grammar courses | No memorization integration |
| **Learn Quran Tajwid** | Tajweed rules | No Arabic reading/grammar foundation |
| **Duolingo** | MSA basics | Too generic, no Quran focus |

### The Gap

**No existing platform integrates:**
1. Arabic reading assessment (Classical script literacy)
2. Classical Arabic grammar (nahw, sarf, balagha)
3. Quran memorization with comprehension tracking
4. Adaptive learning paths based on diagnostic assessment

---

## 2. App Architecture

### Core Modules

```
┌─────────────────────────────────────────────────────────────┐
│                    Language Builder                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │
│  │  Assessment │  │   Learning  │  │   Memorization    │  │
│  │   Engine    │  │   Engine    │  │      Engine       │  │
│  └─────────────┘  └─────────────┘  └───────────────────┘  │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          │                                  │
│                   ┌──────┴──────┐                           │
│                   │   Progress  │                           │
│                   │   Tracker   │                           │
│                   └─────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Three Pillars

1. **Diagnostic Assessment** — Placement testing across all dimensions
2. **Adaptive Learning** — Classical Arabic reading, grammar, tajweed
3. **Hifz Integration** — Quran memorization with comprehension validation

---

## 3. Assessment Methodology

### Placement Test Structure (30-45 minutes)

#### Module A: Arabic Script Literacy
- **Task:** Read aloud 20 Classical Arabic words/phrases (recorded)
- **Metrics:** 
  - Letter identification accuracy
  - Vowel recognition (fatha, kasra, damma, sukun, shadda)
  - Makharij (letter articulation points)
  - Glottal stop, hamza recognition
- **Output:** Literacy level (Beginner/Intermediate/Advanced)

#### Module B: Classical Arabic Comprehension
- **Task:** 15 short passages from the Quran with comprehension questions
- **Levels:**
  - Level 1: Common vocabulary (Al-Fatiha, Al-Ikhlas)
  - Level 2: Moderate complexity (Al-Baqarah opening)
  - Level 3: Advanced (complex verses, classical structures)
- **Metrics:** 
  - Vocabulary recognition (1000+ word frequency list)
  - Grammar pattern recognition
  - Contextual understanding
- **Output:** Comprehension level (A1-A3)

#### Module C: Arabic Grammar Knowledge
- **Task:** 25 questions across grammar domains
- **Domains:**
  - **Nahw (Syntax):** Sentence structure, i'rab, jar and majoor
  - **Sarf (Morphology):** Verb forms, derived nouns, patterns
  - **Balagha (Rhetoric):** Metaphor, simile, emphasis
  - **Tajweed Rules:** Madd, noon saakin, meem saakin
- **Metrics:** 
  - Pattern recognition accuracy
  - Rule application speed
  - Error patterns
- **Output:** Grammar proficiency score (0-100)

#### Module D: Memorization Baseline
- **Task:** 
  - Recite 5 memorized surahs (verified via audio)
  - Identify next verse in memorized passages
  - Complete phrases from memory
- **Metrics:**
  - Total surahs memorized
  - Recitation quality
  - Recall accuracy
- **Output:** Current hifz level (Surahs completed, revision status)

### Adaptive Scoring Algorithm

```python
def calculate_placement(test_results):
    weights = {
        'literacy': 0.20,
        'comprehension': 0.30,
        'grammar': 0.25,
        'memorization': 0.25
    }
    
    weighted_score = sum(
        component_score * weight 
        for component, weight in weights.items()
    )
    
    # Generate personalized learning path based on weakest areas
    return generate_learning_path(weighted_score, test_results)
```

---

## 4. Learning Paths

### Path 1: Complete Beginner (No Arabic Reading)
```
Weeks 1-4:  Arabic alphabet + pronunciation
Weeks 5-8:  Basic sentence structure + common words
Weeks 9-12: Simple Quran passages (short surahs)
Weeks 13+:  Grammar foundations + tajweed
```

### Path 2: Conversational Speaker (Spoken Arabic Only)
```
Weeks 1-2:  Classical script recognition
Weeks 3-6:  Basic grammar review + Quranic vocabulary
Weeks 7-12: Classical Arabic comprehension + tajweed
Weeks 13+:  Advanced grammar + hifz integration
```

### Path 3: Advanced Reader (Already Understands Classical)
```
Weeks 1-4:  Tajweed refinement + balagha introduction
Weeks 5-8:  Grammar deep-dive + rhetorical analysis
Weeks 9-12: Hifz planning + comprehension validation
Weeks 13+:  Advanced balagha + memorization maintenance
```

### Path Customization Logic

Based on assessment results, the app generates a personalized curriculum with:
- **Pace:** Self-paced with weekly goals
- **Focus areas:** Targeted exercises for weakest domains
- **Content:** Curated Quranic passages matching comprehension level
- **Review schedule:** Spaced repetition for memorization

---

## 5. Technical Stack

### Frontend
- **Framework:** Next.js 14 (React)
- **UI Library:** Tailwind CSS + shadcn/ui
- **Audio:** Web Audio API + Recorder.js
- **Text-to-Speech:** Cloudflare Workers AI (or fallback to external TTS API)

### Backend — Cloudflare Workers
- **Framework:** Hono oritty Workers SDK
- **Database:** Cloudflare D1 (SQLite-compatible, serverless SQL)
- **Key-Value Store:** Cloudflare KV (session data, quick lookups)
- **Object Storage:** Cloudflare R2 (audio files, 10GB free)
- **Durable Objects:** Spaced repetition scheduling, session state
- **Workers:** 100k requests/day free — more than enough for single user
- **Durable Objects:** 100k compute-seconds/day free
- **KV:** 100k reads/day, 1M writes/day free
- **R2:** 10GB storage, 100k reads/day, 1M writes/day free

### AI/ML Components
- **Speech Recognition:** Cloudflare Workers AI (Whisper model) or external API fallback
- **Grammar Checking:** Custom NLP pipeline (Arabic morphological analyzer via Workers)
- **Adaptive Learning:** Spaced repetition algorithm (Durable Objects)
- **Comprehension Testing:** Pattern matching + semantic similarity

### Content Management
- **Quran Data:** Quran.com API + Tanzil.net (Uthmani script)
- **Grammar Database:** JSON/Markdown structured content (baked into build or KV)
- **Audio Library:** Recited by top Qaris (Alafasy, Abdul Basit, Minshawi)

### Hosting — Cloudflare Free Tier
- **Frontend:** Cloudflare Pages (static build of Next.js — `next export` or Vite)
- **Backend:** Cloudflare Workers (API routes, auth-less single user)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2
- **CDN:** Cloudflare (automatic, global)
- **Domain:** Custom domain via Cloudflare DNS
- **Cost:** **$0/month** — everything fits within free tier

---

## 6. Feature Breakdown

### MVP Features (Phase 1 — 8 weeks)

1. **Diagnostic Assessment**
   - 4-module test with audio recording
   - Instant results dashboard
   - Personalized learning path generation

2. **Learning Engine**
   - Text-based lessons with interactive exercises
   - Audio pronunciation modeling
   - Vocabulary quizzes (flashcard system)
   - Grammar pattern recognition drills

3. **Memorization Tracker**
   - Surah progress tracking
   - Audio recording + playback for self-review
   - Spaced repetition scheduling
   - Next-verse recall exercises

4. **Progress Dashboard**
   - Visual progress bars per module
   - Weekly goals and completion tracking
   - Streak counter
   - Score history charts

### Phase 2 Features (8 weeks)

5. **Tajweed Visualization**
   - Color-coded Quran text by rule
   - Interactive makharij diagrams
   - Audio comparison (user vs. reciter)
   - Rule-specific practice exercises

6. **Grammar Deep-Dive**
   - Interactive sentence parsing
   - Verb conjugation tables (all forms)
   - Balagha examples with analysis
   - Real-time grammar checking in user input

7. **Community Features**
   - Share progress (optional)
   - Leaderboards (surahs memorized)
   - Study groups
   - Expert Q&A forum

### Phase 3 Features (6 weeks)

8. **AI Tutor**
   - Chat-based grammar explanations
   - Personalized feedback on recordings
   - Adaptive question generation
   - Learning strategy suggestions

9. **Advanced Memorization**
   - Audio-based testing (no text visible)
   - Cross-reference memorization (same theme across surahs)
   - Memorization maintenance schedules
   - Export memorization certificate

10. **Parental Controls / Teacher Mode**
    - Multiple student profiles
    - Progress reports
    - Custom curriculum assignment
    - Performance analytics

---

## 7. Content Sources

### Quran Data
- **Script:** Uthmani script (tanzil.net)
- **Translations:** Dr. Mustafa Khattab (The Clear Quran)
- **Audio:** Quran.com API (multiple reciters)
- **Tafsir:** Ibn Kathir (for comprehension exercises)

### Grammar Curriculum
- **Primary Source:** "Arabic for Non-Natives" series
- **Secondary:** "Madinah Arabic Books" (online available)
- **Advanced:** "Awamia" series for grammar depth
- **Custom:** Content curated specifically for Quranic focus

### Vocabulary Database
- **Frequency List:** 1000 most common Quranic words
- **Categorization:** By surah, theme, part of speech
- **Spaced Repetition:** Anki-style algorithm integrated

---

## 8. User Experience Flow

### Onboarding (5 minutes)
```
1. Welcome screen → "What's your goal?"
   - Read Quran fluently
   - Understand Classical Arabic
   - Memorize Quran
   - All of the above

2. Quick self-assessment (3 questions)
   - Can you read Arabic script? (Yes/Partially/No)
   - How many surahs memorized? (0/1-5/6-20/21+)
   - What's your biggest challenge? (Reading/Grammar/Memorization)

3. Diagnostic test begins
```

### Daily Learning Session (15-30 minutes)
```
1. Dashboard shows:
   - Current lesson
   - Quick review options
   - Memorization targets for today

2. Lesson flow:
   - 5 min: Review previous material (spaced repetition)
   - 10 min: New lesson (grammar/vocabulary/reading)
   - 5 min: Practice exercises
   - 5 min: Memorization check

3. Progress saved automatically
```

### Weekly Review (5 minutes)
```
1. Weekly goals check
2. Score trends
3. Streak status
4. Adjust plan if needed
```

---

## 9. Monetization Strategy

### Free Tier
- Full diagnostic assessment
- Basic learning path (1 module)
- Limited memorization tracker (5 surahs)
- Community access

### Premium Tier ($9.99/month or $79.99/year)
- All learning modules
- Unlimited memorization tracking
- Advanced grammar + balagha
- AI tutor access
- Offline mode
- Teacher tools

### Institutional Tier ($299/year per seat)
- Multi-student management
- Progress analytics
- Custom curriculum
- Priority support

---

## 10. Development Timeline

### Phase 0: Design Foundation (1 week)
```
Week 1:  Module 09 - Design system → tailwind.config.ts + global CSS
         Module 11 - Component library → src/components/
         Module 12 - Page UI specs → route page shells
         Module 00 - Project scaffolding (routing, auth, types)
```

**Phase 0 Deliverables:**
- [ ] `tailwind.config.ts` with custom theme tokens (colors, fonts, spacing, shadows)
- [ ] 15+ React components in `src/components/` (all from module 11)
- [ ] Route page shells for all 11 pages (from module 12 wireframes)
- [ ] AppShell with sidebar + mobile nav
- [ ] Anti-slop checklist applied to all components
- [ ] Arabic text line-height (2.0), RTL support in place

### Phase 1: MVP Features (8 weeks)
```
Week 2-3:  Module 01 - Database schema, seed data, API layer
Week 3-4:  Module 02 - Assessment engine + scoring algorithm
Week 5-6:  Module 03 - Learning engine (lessons, exercises, quizzes)
Week 7:    Module 04 - Memorization tracker
Week 8:    Module 05 - Dashboard, testing, deployment
```

### Phase 2: Core Features (8 weeks)
```
Week 9-10: Module 06 - Tajweed visualization
Week 11-12: Module 07 - Advanced grammar engine
Week 13-14: Testing, optimization, launch
```

### Phase 3: Advanced Features (6 weeks)
```
Week 15-16: Module 08 - AI tutor integration
Week 17-18: Advanced memorization tools
Week 19-20: Teacher mode, parental controls
Week 21-22: Polish, marketing, scale
```

**Total Timeline: 17 weeks (4.25 months)**

---

## 11. Design Module Build Mapping

Modules 09–12 are buildable artifacts. Each maps to concrete code deliverables:

| Module | Code Deliverable | Location |
|--------|-----------------|----------|
| 09-Design System | `tailwind.config.ts`, global CSS variables, typography scale, motion keyframes | `src/app/globals.css`, `tailwind.config.ts` |
| 10-UX Design Specification | Behavioral flows, page wireframes, interaction patterns | Implementation guide (not code) |
| 11-Component Library | 15+ React components with TypeScript interfaces | `src/components/ui/`, `src/components/layout/`, `src/components/learning/`, `src/components/memorization/`, `src/components/assessment/`, `src/components/audio/` |
| 12-Page UI Specifications | Route page shells matching wireframes, 11 pages | `src/app/` routes |

### Page-to-Component Mapping

| Page | Surface Type | Key Components Used |
|------|-------------|-------------------|
| Landing | Decide/Learn | AppShell (no sidebar), Card, Button |
| Onboarding (3 steps) | Configure | AppShell, Card, Input, Button |
| Assessment Dashboard | Monitor | StatCard, ProgressBar, Button |
| Dashboard | Monitor | StatCard, ProgressBar, LessonCard, Badge |
| Learning/Lessons | Operate | QuizQuestion, AudioPlayer, Button, ProgressBar |
| Flashcards | Operate | Card (flip), Button, ProgressBar |
| Memorization | Monitor | MemorizationEntry, AudioPlayer, Badge, Button |
| Tajweed Viewer | Explore | Card, Button (rule coloring from module 09 tokens) |
| Grammar Deep-Dive | Decide/Learn | Card, Input, Button, Table |
| AI Tutor | Operate | Card (chat bubbles), Input, Button |
| Analytics | Monitor | StatCard, ProgressBar (line chart from data) |
| Settings | Configure | Input, Select, Button (toggle switches) |

### Anti-Slop Enforcement

Every component from module 11 and page from module 12 must pass the anti-slop checklist from module 09:
- [ ] No generic gradient backgrounds
- [ ] No icon-topper pattern (icon above every heading)
- [ ] No center-stack for Operate/Monitor surfaces
- [ ] Tajweed colors are functional, not decorative
- [ ] Arabic text has generous line height (2.0)
- [ ] Progress indicators use green, not generic blue
- [ ] No fake metrics or placeholder stats
- [ ] Empty states have actionable suggestions

## 12. Success Metrics
- Daily active users (DAU)
- Session duration (target: 20+ minutes)
- Lessons completed per week (target: 5+)
- Return rate (target: 70%+ weekly)

### Learning Outcomes
- Assessment score improvement (target: +20% in 3 months)
- Vocabulary retention (target: 80%+ after 30 days)
- Grammar accuracy improvement (target: +15% in 6 months)
- Memorization speed (words/day tracked)

### Business Metrics
- Conversion rate (free → premium, target: 5%+)
- Churn rate (target: <10% monthly)
- Customer lifetime value (target: $150+ over 12 months)
- Net Promoter Score (target: 50+)

---

## 13. Risks & Mitigations

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Speech recognition accuracy | Low | Use Azure + fallback to manual review |
| Content quality | Low | Hire native Arabic speakers for content review |
| Scalability | Medium | Cloud infrastructure, CDN, caching |
| Data privacy | High | GDPR compliance, encryption, minimal data collection |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| Low market demand | High | Validate with surveys before building |
| Competition from existing apps | Medium | Differentiate with integrated approach |
| Content licensing issues | Medium | Use open-source Quran data, create original content |
| User retention | High | Gamification, community, personalized experience |

---

## 14. Next Steps

### Immediate Actions (This Week)
1. **Validate demand** — Survey 50+ Muslims about this concept
2. **Competitor analysis** — Deep dive into top 3 apps (Tarteel, Test Quran, Arabic101)
3. **Content audit** — Identify gaps in existing grammar resources
4. **Technical validation** — Test speech recognition APIs for Classical Arabic

### Phase 1 Planning (Next 2 Weeks)
1. **Database design** — Schema for users, progress, content
2. **Assessment design** — Write test questions for all 4 modules
3. **Learning content** — Create first 10 lessons (beginner level)
4. **Design system implementation** — Apply modules 09/11/12 to codebase

### MVP Development (Week 3 onwards)
1. **Sprint planning** — Break Phase 1 into 2-week sprints
2. **Team assembly** — Identify developers, content creators, designers
3. **Agile process** — Set up Jira/Trello, weekly standups
4. **Continuous testing** — User testing every 2 weeks

---

## 15. References & Resources

### Existing Platforms Studied
- [Tarteel AI](https://tarteel.ai/) — Best-in-class hifz app
- [Test Quran](https://www.testquran.com/) — Memorization testing
- [Arabic101](https://arabic101.org/) — Free Arabic + Quran learning
- [Understand Quran](https://understandquran.com/) — Grammar focus
- [Quranic Grammar](https://www.quranic-grammar.com/) — Balagha courses

### Technical References
- [Quran.com API](https://api.quran.com/) — Quran data, translations, audio
- [Tanzil.net](https://tanzil.net/) — Uthmani script data
- [Azure Speech Services](https://azure.microsoft.com/en-us/products/ai-services/speech-service/) — Speech recognition
- [Next.js Documentation](https://nextjs.org/docs) — Frontend framework

### Learning Resources
- [Madinah Arabic Books](https://madinaharabic.com/) — Curriculum structure
- [Al-Quran.info](https://www.al-quran.info/) — Verse-by-verse analysis
- [Quranic Arabic Corpus](http://corpus.quran.com/) — Grammar annotation

---

## 16. Open Questions

1. **Audio recording quality requirements** — How strict should pronunciation be?
2. **Content ownership** — Create original content or license existing?
3. **Community features scope** — Full forum or just basic sharing?
4. **AI tutor complexity** — Chatbot or guided learning assistant?
5. **Mobile-first vs. web-first** — Responsive web or native app first?
6. **Multi-language support** — English only or add Urdu, Indonesian, etc.?
7. **Certification** — Offer completion certificates? Partner with institutions?

---

*Last Updated: July 22, 2026*
*Author: Language Builder Project Plan*
*Status: Draft — Ready for Review*
