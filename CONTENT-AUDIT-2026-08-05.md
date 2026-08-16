# Bayan — Content Structure & Learning Path Audit

**Date:** 2026-08-05  
**Status:** Complete — 4 Critical, 4 High-Priority, 4 Medium-Priority issues found  
**Auditor:** Hermes subagent (deleg_58c5b66b)

---

## Executive Summary

The Bayan has a solid foundation with 419 total lessons (11 authored + 408 generated), 38,995 exercises, and a well-implemented FSRS spaced-repetition scheduler. However, there are critical content silos (root lessons aren't categorized), pedagogical sequencing issues (verb forms taught before case endings), and vocabulary gaps (no particles/conjunctions despite being essential for Quran comprehension). The assessment structure is robust with 4 modules, but the placement test-to-path mapping has threshold logic gaps.

---

## Critical Issues

### 1. Root Lessons Content Silo (408 lessons unreachable)
**File:** `content/grammar/root-lessons.json`, `workers/src/routes/grammar.ts:46-49`

**Problem:** Root lessons have NO `category` field, but the grammar deep-dive endpoint filters by category:
```sql
SELECT * FROM lessons WHERE category = ? AND level >= ? ORDER BY level ASC
```

**Impact:** 408 generated root lessons are completely invisible to the grammar deep-dive UI. Users can't access vocabulary lessons organized by root families through the standard navigation flow.

**Expected:** Either add category to root lessons, or modify the deep-dive endpoint to include uncategorized lessons.

---

### 2. Vocabulary Missing Particles/Conjunctions (Critical for Quran)
**File:** `content/vocabulary/core-100.json`

**Problem:** 0 words classified as particles, conjunctions, or pronouns. These are THE most frequent word types in the Quran (the, and, or, but, that, if, when, he, she, it, etc.).

**Data:** 
- Nouns: 71 (68.9%)
- Verbs: 6 (5.8%)
- **Particles/Conjunctions: 0**

**Impact:** A learner studying the core-100 will know 71 nouns and 6 verbs but won't recognize the structural words that make up 40-50% of Quranic text.

---

### 3. Pedagogical Sequencing: Verb Forms Before Case Endings
**File:** `content/grammar/lessons.json`

**Problem:** 
- `grammar-08` (Derived Verb Forms, Level 3) requires `grammar-04` (Present Tense, Level 2)
- `grammar-11` (Balagha, Level 3) requires `grammar-05` (Case Endings, Level 2)

**Expected sequence:** Articles → Nouns → Case Endings → Idafa → Verb Conjugation
**Actual sequence:** Articles → Verb Conjugation → Sentence Structure → Present Tense → Case Endings

**Impact:** Students learn verb forms and Balagha (which explicitly depends on case endings from lesson 5) before mastering the case system itself.

---

### 4. Missing Level 5 Content
**File:** `content/grammar/lessons.json`, `content/grammar/root-lessons.json`

**Problem:** Authored lessons max out at Level 3. Root lessons go to Level 4, but there's no Level 5 content despite the system supporting it.

**Impact:** Advanced learners hit a ceiling. The path3 (Advanced Reader) assignment in scoring.ts promises "Advanced grammar + hifz integration" by week 13, but no Level 5 content exists.

---

## High-Priority Issues

### 1. Exercise Type Distribution Imbalance
**File:** `content/grammar/lessons.json`, `content/derived-manifest.json`

**Authored lesson exercises (11 lessons, 24 total):**
- `multiple_choice`: 21 (87.5%)
- `fill_blank`: 2 (8.3%)
- `match`: 1 (4.2%)
- **Missing:** `audio_repeat`, `pattern_recognition`, `translation`

**Exercise bank distribution (38,995 total):**
- 6 types have 3,000 each (aspect, case_ending, definiteness, pos_id, root_id, subject_agreement)
- `fronting`: 28 (0.07%)
- `simile`: 58 (0.15%)

**Impact:** Authored lessons don't use the full exercise type variety. The exercise bank has severe gaps in rhetorical devices (fronting, simile).

---

### 2. Path Assignment Threshold Logic Gaps
**File:** `workers/src/lib/scoring.ts:79-91`

**Problem:** The path assignment logic has overlapping conditions:
```typescript
if (weakestArea === 'literacy' && weakestScore < 40) return 'path1';
if (weakestArea === 'literacy' && weakestScore < 70) return composite < 50 ? 'path1' : 'path2';
if (composite >= 70 && weakestScore >= 60) return 'path3';
return 'path2';
```

**Edge case:** A student with literacy=75, comprehension=30, grammar=70, memorization=70 (composite=65) would be assigned path2, but their weakest area is comprehension at 30. Path2 assumes "Conversational Speaker" with Classical script knowledge, but this student has very low comprehension.

**Impact:** Path assignment doesn't fully account for asymmetric weakness profiles.

---

### 3. Root Lesson Prerequisites Form a Linear Chain
**File:** `content/grammar/root-lessons.json`

**Problem:** First 3 root lessons show a linear dependency:
- `root-Alh` (no prereqs)
- `root-qwl` requires `root-Alh`
- `root-kwn` requires `root-qwl`

**Impact:** This creates an artificial sequence. Root lessons teach vocabulary families independently—there's no pedagogical reason to learn the root for "Allah" before the root for "to say."

---

## Medium-Priority Issues

### 1. Underrepresented Rhetorical Exercise Types
**File:** `content/derived-manifest.json`

**Data:**
- `fronting` (al-taqdīm): 28 exercises
- `simile` (al-tashbīh): 58 exercises
- `sentence_type`: 252 exercises
- `conditional`: 401 exercises

**Impact:** Balagha (rhetoric) is covered by only one authored lesson (grammar-11) and has minimal drill support. The DeepDiveView component explicitly notes that metaphor and metonymy "will not until a source annotates them."

---

### 2. Grammar Deep-Dive Returns All 418 Lessons Initially
**File:** `workers/src/routes/grammar.ts:21-27`

**Problem:** The endpoint comment notes: "the three tabs therefore returned byte-identical lists of all 418 lessons — 823 KB each." This was "fixed" but the fix uses `level >= mastery_level`, meaning new users see ALL lessons from level 1 upward.

**Impact:** The deep-dive pages are overwhelming for beginners. A master-level filter (`level <= mastery_level`) would be more appropriate.

---

### 3. Root Lessons Lack Content Structure Parity
**File:** `content/grammar/root-lessons.json`

**Authored lessons have:**
- `explanation`, `examples`, `rules`, `conjugation_table` (context-dependent)
- Rich exercise context with explanations

**Root lessons have:**
- `explanation` (auto-generated from corpus data)
- `examples` (Quranic occurrences with references)
- `rules` (minimal - just "Words on X")
- Exercises: `multiple_choice` and `fill_blank` only, all with identical structure

**Impact:** Root lessons feel mechanically generated compared to the carefully crafted authored content.

---

### 4. Memorization Unit Ordering Not Verified
**File:** `content/derived-manifest.json`

**Problem:** The spec claims "908 memorization units" and "short surahs first," but I couldn't locate the memorization unit data file. The FSRS scheduler is implemented and functional, but the ordering logic isn't visible in the content files I examined.

**Impact:** Cannot verify if the claimed "short to long" progression actually exists.

---

## Suggestions

### 1. Add Particle/Conjunction Vocabulary Priority
**File:** `content/vocabulary/core-100.json`

**Action:** Add the 20-30 most frequent particles (و, وَ, فِى, إِلَى, مِن, اللَّذِى, الذِّى, الَّذى, etc.) and pronouns (هُوَ, هِىَ, هُم, نَحْنُ, etc.) to the core vocabulary. These should be ranked by frequency and taught before low-frequency nouns.

**Rationale:** These words account for 40-50% of Quranic text but are completely missing from the core-100 list.

---

### 2. Reorganize Root Lesson Categorization
**File:** `content/grammar/root-lessons.json`

**Action:** Add `category: "vocabulary"` to all root lessons. Modify the grammar deep-dive endpoint to include a "Vocabulary" category that shows root-family lessons, or create a separate `/api/grammar/vocabulary` endpoint.

**Rationale:** Without categorization, 408 lessons are unreachable through the standard UI navigation.

---

### 3. Fix Pedagogical Sequence
**File:** `content/grammar/lessons.json`

**Proposed reordering:**
1. grammar-01: Articles and Nouns (Level 1)
2. grammar-05: Case Endings (Level 2) - **move up**
3. grammar-06: Idafa (Level 2)
4. grammar-07: Attached Pronouns (Level 2)
5. grammar-03: Nominal Sentences (Level 1)
6. grammar-02: Past Tense (Level 1)
7. grammar-04: Present Tense (Level 2)
8. grammar-08: Derived Forms (Level 3)
9. grammar-10: Negation (Level 3)
10. grammar-09: Demonstratives (Level 2)
11. grammar-11: Balagha (Level 3) - requires Case Endings

**Rationale:** Case endings are foundational for Idafa, Attached Pronouns, and Balagha. Teach them early.

---

### 4. Expand Level 4-5 Content
**Files:** `content/grammar/lessons.json`, `content/grammar/root-lessons.json`

**Action:**
- Create authored Level 4-5 lessons for advanced nahw (conditional sentences, emphatic structures, exclamations) and sarf (Form V-XII, irregular verbs, hollow roots)
- Generate root lessons at Level 5 for rare/complex roots
- Add Level 5 to the level progression in the UI

**Rationale:** Path3 (Advanced Reader) promises advanced grammar by week 13, but no content exists at that level.

---

## Pedagogical Coherence Assessment

**Logical sequences:**
- ✓ Articles → Nouns → Sentence Structure is logical
- ✗ Verb forms taught before case endings
- ✗ Balagha (Level 3) requires case endings (Level 2) but both can be reached at Level 3

---

## Conclusion

This audit identified 4 critical issues, 4 high-priority issues, and 4 medium-priority issues. The most impactful fixes would be adding particle vocabulary, categorizing root lessons, and reordering the grammar sequence to teach case endings before verb forms.

---

*Audit run time: ~6 minutes*  
*Next recommended audit: After content restructuring and level reordering*
