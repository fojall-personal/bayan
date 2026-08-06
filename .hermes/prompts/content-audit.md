# Language Builder — Content Structure & Learning Path Audit

You are auditing the Learning Path and content structure of the Language Builder app. This is a Classical Arabic learning app focused on Quran comprehension, grammar (nahw, sarf, balagha), and memorization (hifz). The content must form a coherent progression that learners can follow from complete beginner to advanced reader.

## What to check

### 1. Lesson content structure
Examine `content/grammar/lessons.json` and `content/grammar/root-lessons.json`:
- How many authored lessons vs. generated root lessons exist?
- What levels do they cover (1-5+)?
- Does each lesson have: title, module, level, prerequisites, estimated_minutes, content (explanation, examples, rules), exercises?
- Are exercises varied (multiple_choice, fill_blank, match, audio_repeat, pattern_recognition, translation)?
- Do exercises have clear correct answers and explanations?

### 2. Prerequisite chains
- Trace the prerequisite graph from lessons.json
- Are there circular dependencies?
- Are prerequisites actually enforced in the frontend (e.g., /api/learning/next respects them)?
- Does a beginner student start at level 1 with no prerequisites?
- Are there gaps where a lesson has prerequisites that don't exist?

### 3. Level progression
- What level structure exists (1=beginner, 2=intermediate, etc.)?
- Are there logical jumps between levels (e.g., level 1 → level 3 without level 2)?
- Do exercises match their lesson's level complexity?
- Is there content at every level, or are there gaps?

### 4. Content categories
Check `content/grammar/`:
- Authored lessons have `category: "nahw"` or `"sarf"`
- Generated root lessons have no category (they teach vocabulary in root families)
- What grammar topics are covered? (definiteness, case endings, verb forms, syntax, etc.)
- Are balagha (rhetoric) exercises derived from the ARDT taxonomy?

### 5. Exercise bank
Run `node scripts/gen-content-manifest.mjs --check` and examine the breakdown:
- 38,995 total exercises across 25 kinds
- Are exercises properly distributed across difficulty levels?
- Are the 25 exercise kinds meaningful and distinct?
- Which kinds are underrepresented (e.g., fronting has only 28)?

### 6. Vocabulary content
Examine `content/vocabulary/core-100.json`:
- 103 words ordered by frequency
- Each has: word, transliteration, meaning, part_of_speech, frequency_rank, quran_occurrences
- Are there gaps in parts of speech (nouns, verbs, prepositions, particles)?
- Is the frequency ranking reasonable for Quran comprehension?

### 7. Assessment structure
Examine `content/assessments/placement-test.json`:
- How many modules are in the placement test?
- What does each module assess? (literacy, grammar, comprehension, etc.)
- Do passing scores map to appropriate learning paths (path1, path2, path3)?
- Is the assessment logic consistent with the learning path assignment?

### 8. Memorization units
From `derived-manifest.json`:
- 908 memorization units
- Are these ordered logically (short surahs first, then longer ones)?
- Does the FSRS scheduler actually schedule reviews for these units?
- Is there a clear progression from short to long surahs?

### 9. Content reachability
- Can a new user actually access all this content?
- Trace the flow: onboarding → assessment → path assignment → first lesson
- Is the "next lesson" algorithm logical?
- Can users navigate to any lesson directly via ?lesson=<id> parameter?
- Are there content silos (e.g., grammar lessons not reachable from /learning)?

### 10. Pedagogical coherence
- Does the content follow a logical teaching sequence?
  - Script literacy → basic grammar → advanced grammar
  - High-frequency words → low-frequency words
  - Short surahs → long surahs (memorization)
- Are there dependencies between modules that aren't enforced?
- Is the balance between nahw (syntax), sarf (morphology), and balagha (rhetoric) appropriate?

## Environment

- Working directory: `/home/fjallouli/workspace/languagebuilder`
- Key files:
  - `content/grammar/lessons.json` - 10 authored lessons with full structure
  - `content/grammar/root-lessons.json` - Generated lessons per root (408 lessons)
  - `content/vocabulary/core-100.json` - 103 high-frequency Quran words
  - `content/assessments/placement-test.json` - Placement test with 3 modules
  - `content/derived-manifest.json` - Generated manifest with exercise counts
- Gate command: `node scripts/gen-content-manifest.mjs --check`

## Output format

Structure your report as:

### 1. Summary
3-5 sentences on overall content health and learning path coherence.

### 2. Critical Issues
- Missing prerequisites that break learning progression
- Unreachable content silos
- Level gaps where students would be stuck
- Broken assessment-to-path mapping

### 3. High-Priority Issues
- Inconsistent level assignments
- Exercise difficulty not matching lesson level
- Missing exercise types in certain lessons
- Vocabulary frequency ranking issues

### 4. Medium-Priority Issues
- Underrepresented exercise kinds
- Minor pedagogical sequencing problems
- Content that exists but isn't surfaced in the UI
- Incomplete prerequisite documentation

### 5. Suggestions
- Content that should be added
- Sequencing improvements
- Balance adjustments between modules

For every issue: cite the file, line, and describe what should happen vs what actually happens.

## Important

- Be thorough but focused. Don't get lost in code that's working correctly.
- Verify everything by reading actual content files and running actual commands — don't guess.
- The user values concrete metrics and verification. Every claim must be backed by actual content.
- Think like a learner: if you were starting from zero, could you follow this path?
- Flag any content that looks correct structurally but might be pedagogically wrong (e.g., teaching verb conjugation before noun cases).
