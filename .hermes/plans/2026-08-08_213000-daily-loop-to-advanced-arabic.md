# From Daily Use to Advanced Arabic — Pedagogy Plan for Bayan

**Goal:** Turn Bayan from an excellent *reference-and-recognition* app into a daily
loop that actually produces **advanced reading comprehension** — the ability to open
an unfamiliar ayah, parse it, and understand it without help.

**Author:** pedagogy/UX review, 2026-08-08
**Status:** plan only. No code changed.

---

## 0. The honest verdict up front

Bayan is already in the top decile of language apps on the things most apps get
wrong. Before the critique, what is genuinely right, because it constrains what
should change:

- **Real FSRS-6**, via `ts-fsrs`, not a hand-transcribed knockoff
  (`workers/src/lib/space-repetition.ts`). Learning steps correctly removed because
  `next_review` is a DATE. This is better than most commercial apps ship.
- **The reading queue is already i+1**, with the right citations
  (`workers/src/routes/progress.ts:157-169` — Hu & Nation 2000, Laufer 2020). Ordering
  candidate ayat by *how much the blocking root pays back elsewhere* is a genuinely
  good idea that LingQ does not do.
- **A grounded tutor that refuses to invent Arabic** (`tutor-grounding.ts`). The
  comment documenting that the old tutor cited السَّآمَّة — zero occurrences — is
  exactly the right instinct.
- **Frequency-first root coverage** with honest framing ("first whole surah at ~114
  roots") instead of a fake progress bar.

I verified the headline coverage claim myself against the corpus file on this box
rather than trusting the prose:

```
top  63 roots = 50.3% of root-bearing segments   ← app says "63 roots cover half". Correct.
top 300 roots = 83.5% of root-bearing segments   (only 53.9% of ALL word tokens)
top 400 roots = 88.5% of root-bearing segments
```

So the "63 roots" claim in `Today.tsx:317` is **accurate**. Note for later: the widely
repeated "300 words = 70% of the Quran" figure floating around the internet is *not*
reproducible — at 300 roots you have 83.5% of rooted tokens but only **53.9%** of all
tokens. Bayan is already more honest than its sources.

**The core problem is not quality. It is that the app teaches recognition and
measures self-report, and neither of those produces advanced proficiency.**

Three findings drive everything below:

| # | Finding | Evidence |
|---|---|---|
| 1 | **Every one of the ~39k exercises is multiple choice.** | `ExerciseRunner.tsx:24-25` — every item is `{answer, options[]}`. There is no free-text answer path anywhere in the grammar surface. |
| 2 | **Memorization review is pure self-grading.** | `ReviewSession.tsx:29-33` — the learner clicks "I remembered it correctly". Nothing is measured. FSRS is being fed an opinion. |
| 3 | **35.5% of Quranic word tokens are invisible to the coverage model.** | Measured from the corpus: 27,462 of 77,429 word tokens carry **no root** — they are prepositions (9,886), conjunctions (4,090), relative pronouns (2,202), negations (1,258)… The model counts an ayah readable when every *rooted* word is known, silently treating all function words as free. |

Finding 3 is the most consequential and the most fixable, so it comes first.

---

## 1. The function-word hole (fix this first — highest value per hour of work)

### What is wrong

`GET /api/progress/coverage` counts an ayah readable "once every rooted word in it has
a root you know" (`Today.tsx:317`). The implementation confirms it: the reading-queue
SQL filters `WHERE root IS NOT NULL` (`progress.ts:190-192`).

But **the words that carry Arabic syntax have no root.** Measured from the corpus:

```
Word tokens with NO root at all: 27,462  (35.5% of all 77,429)
  P    (prepositions)      9,886
  CONJ (conjunctions)      4,090
  REL  (relative pronouns) 2,202
  NEG  (negations)         1,258
  DEM  (demonstratives)      773
  COND, SUB, RES, INTG ...
```

So Bayan tells a learner an ayah is "100% readable" while من، في، على، الذي، إن، لا،
إلا are all assumed known. For a beginner that assumption is false, and these are
precisely the words that determine *what the sentence means*. Mistaking `إنَّ`
(accusative particle) for `إنْ` (conditional) changes the parse entirely.

### Why it is a gift, not just a bug

The distribution is extraordinarily concentrated. Measured:

```
Distinct non-rooted lemmas: 215  (covering 24,640 segments)
  top  20 lemmas =  77.3% of all function-word segments
  top  50 lemmas =  94.0%
  top 100 lemmas =  98.9%
```

**Fifty items - learnable in two weeks at 4/day - covers 94% of every function word in
the Quran.** There is no other intervention in this app with that leverage.

Important correction to the obvious version of this critique: Bayan is **not** ignoring
function words pedagogically. `FunctionWordCard.tsx` exists, and the exercise bank
already holds 2,486 items across `relative_pronoun` (665), `demonstrative` (769),
`negation` (651) and `conditional` (401). The gap is narrower and more specific than
"no function-word teaching": **there is no `user_known_function_word` state, so the
coverage model, the reading queue and the calibration flow are all blind to them.**
The teaching exists; the *measurement* does not, so nothing routes on it.

### The plan

1. **New table `user_known_function_word`** (lemma, user_id), mirroring
   `user_known_root`.
2. **Extend `/api/progress/coverage`** so an ayah is readable when its rooted words
   *and* its function words are known. Expect the reported number to **drop** on
   first deploy. That drop is the metric becoming true; say so in the UI rather than
   hiding it.
3. **Seed the calibration flow** (`/calibrate`, currently 12 roots) with the top 20
   function lemmas. They are so common that a learner either knows them all or is a
   genuine beginner - a fast, high-information question.
4. **A dedicated "particles" track** for the top 50, ordered by frequency: min (3,226),
   fiy (1,701), inna (1,682), maa-relative (1,476), 'alaa (1,445), alladhii (1,442),
   laa (1,406)...

### The drill that matters: homograph disambiguation

The corpus hands you a ready-made advanced exercise. **`maa` appears as REL 1,476
times and as NEG 705 times** - same two letters, opposite jobs. Likewise `in`
(COND, 578) vs `inna` (ACC, 1,682).

Generate items that show one ayah containing `maa` and ask *which* `maa` it is. This
is not vocabulary - it is parsing under ambiguity, which is the actual advanced skill,
and the treebank already labels the answer. Both research reports independently
converged on this: **deliberate confusion-pairing is correct drill design**, for
confusable awzan in sarf and for mutashabihat in hifz.

---

## 2. Recognition is not comprehension (the ceiling problem)

### The evidence

Every grammar item in Bayan is `{answer, options[]}` (`ExerciseRunner.tsx:24-25`). A
learner picks from four choices. Two independent research findings say this caps you
at intermediate:

**Karpicke & Roediger (2008), *Science*.** Four conditions learning Swahili-English
pairs. Once an item was recalled correctly it was either dropped from *study* or
dropped from *testing*. All four conditions reached **near-identical performance
during learning**. One week later:

| Condition | 1-week recall |
|---|---|
| Repeated retrieval (kept being tested) | **~80%** |
| Dropped from testing (kept being studied) | **36% / 33%** |

*"Repeated study after one successful recall did not produce any measurable learning a
week later."* And the metacognitive kicker: **every group predicted ~50%**. Learners
cannot feel the difference. This is why self-report is unreliable in principle.

**Multiple choice is recognition, not retrieval.** With four options the correct
answer is on screen; the learner does familiarity-matching, not generation. Add the
**generation effect** — and specifically Springer (*Mem Cogn* 2022) on lexical
inferencing: **guessing an unknown word's meaning before confirmation beats
read-then-confirm on retention.** Bayan currently reveals rather than asks.

The productive/receptive gap is the practical consequence: receptive vocabulary
typically runs **2-3x** productive vocabulary. An app that only ever tests receptively
will produce a learner who recognises 3,000 words and can parse almost nothing cold.

### What advanced Arabic actually requires: i'rab

The traditional answer is unambiguous and Bayan is well-positioned to implement it.
In the classical `dars`, the core graded skill is **i'rab** — say, for each word, its
case/mood, the *marker* carrying it, and the *governor* (عامل) causing it. `Iʿrāb
al-Qurʾān` is an entire capstone genre (al-Durr al-Maṣūn). Crucially:

- **"Because it sounds right" is not an accepted answer.** The student must name the
  governor.
- **Elision (حذف) and attachment (تعلق) are part of the answer** — a parse omitting
  the implied element is marked wrong.
- Indeclinables still get case *in position* (في محل رفع/نصب/جر), and whole clauses
  take positional case.

That last point matters technically: **this is exactly a dependency-tree label with a
null-node convention.** Bayan already holds 117,947 treebank rows *and 11,157 elided
tokens*. The elided tokens are not incidental data — they are the part of i'rab that
distinguishes a serious student, and nothing in the app currently uses them.

### The fix: a graded production ladder

Replace "multiple choice everywhere" with an item format that escalates as mastery
rises. Same underlying corpus data, four rungs:

| Rung | Format | Skill | Data needed |
|---|---|---|---|
| 1 | Multiple choice (existing) | Recognition | already there |
| 2 | **Type the root** of a shown word (3 consonants, no options) | Morphological decomposition | `ROOT:` tag |
| 3 | **Full vowelling (tashkil)**: bare consonantal skeleton shown, learner supplies case endings | Active i'rab | `case_case` |
| 4 | **Name the governor**: "why is this word manṣūb?" -> select/type the عامل | True i'rab | treebank dependency head |

Rung 3 is the highest-value new item type in this entire plan. Stripping diacritics is
trivial — `normaliseArabic()` in `tutor-grounding.ts` already does exactly this
transformation, and grading is an exact string comparison against the Uthmani text.
**The reverse of an existing function is a new exercise generator for 77,429 words.**

### Per-channel error analytics

i'rab fails on five independent channels: word identification, case/mood value,
the *marker*, the *governor*, and *elision*. A single accuracy percentage tells the
learner nothing actionable. Aggregate by channel — "your case values are 91% but you
name the governor correctly 40% of the time" — and route remediation accordingly.
`/progress` currently shows accuracy by exercise *kind*, which is a data-model
category, not a diagnostic one.

---

## 3. Hifz: FSRS is being fed an opinion

### The problem

`ReviewSession.tsx:29-33` offers four buttons: "I didn't remember it" / "with
difficulty" / "correctly" / "effortlessly". The learner self-reports and FSRS
schedules from that. Given Karpicke & Roediger's finding that learners' predictions
were **uncorrelated with actual retention**, a well-fitted 21-parameter memory model is
being driven by the least reliable signal available. The scheduler is excellent; its
input is a guess.

Note also `space-repetition.ts` already has `gradeFromAccuracy()` — a proper mapping
from measured 0..1 accuracy onto grades, with sensible asymmetric bands. **It is
written and essentially unused by the main review flow.** The infrastructure for
measured grading exists; only the measurement is missing.

### Three fixes, in order of effort

**a) Type-the-next-word (zero new infrastructure).** Before self-grading, show the
ayah with N words blanked and have the learner supply them. Exact-match against the
Uthmani text after `normaliseArabic()`. Feed the resulting accuracy into
`gradeFromAccuracy()` — the function that is already there. This alone converts hifz
review from self-report to measurement.

**b) Cold-start prompting.** Traditional review prompts an ayah by number or first
word with **no run-up from the preceding ayah**. Chained recall inflates apparent
strength: a learner who can only recite ayah 12 after reciting 11 has not memorised
12 independently. Mark items that pass only when warm as weak.

**c) ASR recitation grading.** The tradition's non-negotiable is that recitation is
**oral, aloud, and judged by someone else**. Bayan already has word-level timings for
Alafasy (`quran-align`, 154,799 timings) and `AyahAudioButton`. Whisper-class ASR on
recited audio, aligned against the Uthmani text, restores the external-judge property.
This is the highest-effort item here and should be last — but it is the one that makes
the app a teacher rather than a tracker.

### Structural: sabaq / sabqi / manzil

Hifz schools run a **three-tier daily cycle**, and it maps onto FSRS imperfectly in a
way worth designing around:

| Tier | What | Volume |
|---|---|---|
| **Sabaq** (سبق) | Today's new lines | small, 20-40x repetition before presenting |
| **Sabqi** (سبقي) | Recent material, last ~7-30 days | ~1 juz' |
| **Manzil** (منزل) | Everything older, on rotation | 1/7th of memorised body per day |

Two things follow that Bayan gets wrong today:

1. **Manzil is scheduled by *rotation*, not per-item due dates.** You recite a whole
   juz' in sequence. A naive per-ayah FSRS queue shatters this into 40 scattered ayat
   — and chained recall *depends* on preceding context. The recommendation from the
   research is **span-level scheduling**: attach FSRS state to a page/rukūʿ/juzʾ so
   review stays contiguous, while tracking per-ayah difficulty underneath so drilling
   can still target weak links.
2. **Retention target should be higher for hifz.** `REQUEST_RETENTION = 0.9` is the
   FSRS default and the file honestly documents that it means one lapse in ten *by
   design*. For verbatim recall of scripture, one-in-ten is arguably too loose —
   traditional practice implies something closer to 0.95. Make it a per-track setting
   (hifz 0.95, vocabulary 0.90, long-tail 0.85) and **show the workload cost** before
   the learner chooses: "at 0.95 this is ~34 reviews/day; at 0.90, ~21."

### Mutashabihat

Near-identical verses that differ in one word are the classic hifz failure mode, and
they are **auto-detectable** from the text you already have — compute near-duplicate
ayah pairs by edit distance, then drill them as discrimination pairs. Same principle
as the `maa` REL/NEG drill in §1: interference is a feature, not a bug.

---

## 4. The missing half of Arabic morphology: wazn

### Bayan tracks roots. Arabic is root x pattern.

The coverage model, the calibration flow, and the reading queue are all root-based.
`verb_form` (the wazn, Forms I-X) is present in the morphology data, is *displayed* in
the reader, and has **1,670 exercises** in the bank — so again, the gap is not "wazn is
untaught". It is that there is **no `user_known_pattern` table and no pattern dimension
in coverage**, so the app cannot say which forms you know or use them to route you.
Measured distribution:

```
Verb stems: 19,356
  Form I (unmarked)  12,347      Form V     466
  Form IV             4,565      Form X     459
  Form II             1,615      Form VI    106
  Form VIII           1,161      Form VII    63
  Form III              497      Form IX/XI/XII  ~25
```

**Six forms cover 99% of Quranic verbs.** That is a one-week curriculum with enormous
downstream payoff, because the root x pattern grid is *multiplicative*: knowing كتب
plus Form X lets you decode استكتب without ever having met it.

### The evidence this is real, not just tidy

Boudelaa & Marslen-Wilson's masked-priming work shows Arabic roots produce robust
priming effects **that do not occur for concatenative languages** — the root is a
genuine retrieval hub in the mental lexicon, not an orthographic convenience. Pattern
priming also exists, weaker but present. So Bayan's root-centric organisation is
**well-supported by psycholinguistic evidence** — and it is currently implementing
only the stronger half of a two-factor system.

### The feature

A **root x wazn grid**. Rows = roots you know, columns = Forms I-X, cells lit where
that combination actually occurs in the Quran. This does three jobs at once:

- It is an honest progress display (a filling grid, not a fake percentage).
- It generates exercises: "you know كتب and you know Form III — what does كاتب mean?"
- It shows the learner *why* their vocabulary is about to multiply, which is the
  single most motivating true fact about Arabic.

One caution the research flagged: **the semantic value of a form is a tendency, not a
rule.** Form X is usually "seek/consider", but استطاع just means "to be able". Teach
the tendency, and mark the lexicalised exceptions explicitly rather than letting the
learner infer a rule that will mislead them.

---

## 5. The daily loop: what a session should be

### The band router (the organising idea)

Refold's core structural insight is that **not all reading is the same activity**, and
the split is by coverage. Bayan already computes per-ayah coverage for the reading
queue — so route every passage into one of three bands:

| Band | Coverage | Activity | Share of daily time |
|---|---|---|---|
| **Freeflow** | >=98% known | Continuous reading with recitation audio. No lookups, no pausing. Builds parsing *speed* and automaticity. | >=50% |
| **Intensive** | 92-97% | Mining band. Lookups allowed, cards generated here. This is i+1. | ~30% |
| **Locked/scaffolded** | <92% | Word-by-word gloss training wheels, or don't show it. At 80% coverage, Hu & Nation found *nobody* comprehends. | ~0-20% |

Bayan currently has the intensive band ("Just past your edge") and nothing else. **The
freeflow band is the missing one, and it is the one that builds fluency** — Refold
names "only mining, never freeflowing" as a top-3 learner mistake. A learner who only
ever does effortful i+1 work stays slow forever. Reading 30 ayat you already know, at
speed, with audio, is not wasted time; it is the automaticity drill.

Concretely: `/read` should have a **"read a page" mode** that picks a contiguous run of
ayat at >=98% coverage and plays through with synced highlighting. The word-level
timings exist. Nothing needs generating.

### A 25-minute daily session

Ordered by what decays fastest, not by what feels good:

```
1. Hifz review        (8 min)  - what FSRS says is due; typed recall, not self-graded
2. Function words     (3 min)  - 4 new particles/day for the first fortnight, then drills
3. Intensive reading  (7 min)  - 2-3 ayat from the i+1 queue; mine 1-2 cards
4. Grammar production (5 min)  - vowel the skeleton / name the governor (rung 3-4)
5. Freeflow           (5 min)  - a page at >=98% coverage, audio on, no stopping
```

Note what is *not* in it: no lesson grid, no "choose your goal", no XP. The Today page
already gets this right by picking one primary action. Extend that principle to the
whole session rather than adding tiles.

### Two-wave review (Assimil)

Worth stealing and adapting. Assimil runs a **passive wave** (encounter, comprehend)
and, from lesson 50, an **active wave** — go back to old material and *reproduce* it
from the L1 side. Same content, two different task demands, separated by weeks.

For Bayan: an ayah you read receptively becomes eligible weeks later for a
**production pass** — reconstruct the Arabic from the gloss, or vowel the bare
skeleton. Keep Assimil's two-encounter structure but replace its fixed 49-lesson
offset with **memory-state-driven timing**, since you have FSRS and Assimil did not.

---

## 6. Habit and motivation: what to steal from Duolingo, and what to refuse

Duolingo's engagement craft is real and its learning ceiling is documented. Their own
published research puts users at roughly **Intermediate Low reading and Novice High
listening after ~112 median hours** through the entire tree. That is the plateau, and
it is caused by mechanics, not laziness:

- **Streaks are brittle scalars.** A missed day converts to total loss, which drives
  "minimum viable session" behaviour — grinding trivial content to protect a number.
  Streak freezes exist to protect a streak that no longer represents study.
- **Word banks and multiple choice** keep the answer on screen. Recognition again.
- **XP measures engagement, not proficiency.** Optimise the metric, get the metric.

**What to steal:** the one-primary-action screen (Bayan already has it), session
framing that makes starting cheap, honest streak-free consistency feedback, and clean
progress visuals.

**The specific replacement I recommend: a trailing 42-day hit rate instead of a
streak.** A missed day barely dents 90%; a missed day destroys a streak. This removes
the perverse incentive while keeping the accountability. It is also just a truer
statement about a practice.

**Refuse:** XP, gems, leaderboards, streak freezes, thematic vocabulary sets ("words
about paradise" — blocking by semantic category measurably harms retention versus
interleaving), and any optional-difficulty setting. Production should be mandatory,
not a toggle the motivated 5% opt into.

One thing Bayan should keep doing that almost no app does: `Today.tsx:190-195` says
*"Reviews are scheduled, not invented to fill the slot"* when nothing is due. Refusing
to manufacture busywork is a real feature. Do not let a future engagement metric erode
it.

---

## 7. Smaller UX findings from the code read

- **`/tutor` is a corpus lookup, not a tutor.** `tutor-grounding.ts` answers a word, a
  root, a location, or a tajweed rule. That grounding discipline is right and should be
  kept — but the *name* promises dialogue. Either rename it (**"Lookup"** / **"Ask the
  corpus"**) or add the one genuinely useful generative feature: **explain my error**.
  When a learner gets an i'rab item wrong, the correct parse is known and the treebank
  supplies the governor. A model narrating a known-correct record is safe; the facts
  come from data, per the module's own stated rule ("facts first, the model may narrate
  but is never the source").
- **`/progress` groups by exercise kind, which is a schema category.** Regroup by
  *skill channel* (morphology / case / governor / vocabulary / tajweed) so the display
  is diagnostic rather than architectural.
- **`AdvancedMemorizationTools` is reachable only from Memorize.** "Recall without the
  text" is arguably the single most pedagogically valuable screen in the app — it is
  the only cold-recall surface — and it sits behind an "Advanced" label. Promote it
  into the main hifz flow rather than gating it as an expert tool.
- **Stale comment.** `Today.tsx:147` says *"SM-2 decides when they are due"*. The
  scheduler has been FSRS-6 since `space-repetition.ts` was rewritten. Minor, but this
  repo's AGENTS.md is unusually disciplined about prose matching code, so it's worth a
  one-line fix.
- **Doc discrepancy — confirmed, both docs wrong.** AGENTS.md says *"38,995 exercises
  across 25 kinds"*; `progress/page.tsx:29` says *"the seven exercise kinds the derived
  bank actually contains"*. I queried the local D1: the bank holds **17 distinct
  kinds**. Neither number is right. `gen-content-manifest.mjs --check` passes (it gates
  the 38,995 total, which is correct) but **it does not gate the kind count** — that is
  a real gap in the gate, given how much this repo relies on generated checks to keep
  prose honest. Worth extending the manifest to assert `COUNT(DISTINCT kind)`.

  Consequence beyond tidiness: `KIND_LABELS` in `progress/page.tsx` has labels for 7
  bank kinds, so **10 kinds render as raw database enums** (`subject_agreement`,
  `word_role`, `relative_pronoun`, `demonstrative`, `conditional`, `mood`, `voice`,
  `negation`, `jinas`, `sentence_type`) — exactly the "leaking a column name into the
  UI" failure that comment says it exists to prevent. The mastery breakdown is the
  learner's main diagnostic screen, so this is a visible bug, not just drift.

  Actual distribution, for reference:
  ```
  aspect 3000 · case_ending 3000 · definiteness 3000 · pos_id 3000 · subject_agreement 3000
  root_id 2400 · mood 2298 · jinas 1707 · verb_form 1670 · word_role 1272
  demonstrative 769 · relative_pronoun 665 · negation 651 · voice 539
  conditional 401 · sentence_type 252 · simile 58
  ```
  Note this also **partly answers §1 and §4 in Bayan's favour**: `relative_pronoun`,
  `demonstrative`, `negation` and `conditional` items (2,486 total) already drill
  function words, and `verb_form` (1,670) already drills wazn. The *exercises* exist —
  what is missing is that neither dimension feeds the **coverage model** or has a
  known-state table, so the app cannot tell you what you know or route you by it.

---

## 8. Suggested order of work

Sequenced by (value / effort), and each slice is independently shippable.

| # | Slice | Why now | Effort |
|---|---|---|---|
| 1 | **Function-word coverage + top-50 track** | Fixes a measurably wrong metric; 50 items buys 94% coverage. Highest leverage in the plan. | S |
| 2 | **Typed recall in hifz review** (`gradeFromAccuracy` is already written) | Converts FSRS input from opinion to measurement. | S |
| 3 | **Tashkil production items** (reverse `normaliseArabic`) | New item type over all 77,429 words, near-zero new data. | S-M |
| 4 | **Freeflow reading mode** (>=98% band, audio, no lookups) | The missing half of the reading loop; timings already exist. | M |
| 5 | **Homograph + mutashabihat discrimination drills** | Auto-derivable; targets the actual advanced skill. | M |
| 6 | **Root x wazn grid + pattern coverage** | Adds the missing morphological dimension. | M |
| 7 | **Span-level hifz scheduling + per-track retention** | Fixes contiguity; needs care not to break existing FSRS state. | M-L |
| 8 | **Governor/i'rab items from the treebank** (incl. the 11,157 elided tokens) | The capstone skill. Depends on the treebank's 95.7% LAS caveat - keep the concur-with-morphology rule. | L |
| 9 | **ASR recitation grading** | Restores the external judge. Highest effort, highest ceiling. | L |

---

## 9. Risks and open questions

- **Coverage will drop when function words are counted.** Frame it as the metric
  becoming honest. If that is unacceptable, show both numbers side by side - but do not
  quietly keep the flattering one.
- **The treebank is not hand-verified** (95.7% LAS on a 350-sentence sample, no
  corpus-wide IAA - AGENTS.md is explicit). Governor/i'rab exercises derived from it
  must keep the existing rule: emit only where the treebank relation and the morphology
  case concur. Do not relax this for coverage.
- **Typed Arabic input is a real UX problem.** Most learners have no Arabic keyboard.
  Tashkil items should use a **diacritic palette** (tap fatha/damma/kasra/sukun/shadda),
  not a text field. Root entry can use a 28-letter consonant pad. This is a genuine
  design task, not an afterthought - if it is awkward, production items will be
  abandoned and the whole plan fails at its most important point.
- **Retention 0.95 for hifz is a hypothesis, not a measurement.** It is defensible from
  traditional practice but I have not validated it against this learner's data. Ship it
  as a setting with the workload cost displayed; revisit with real review logs.
- **ASR on Quranic recitation is genuinely hard** - tajweed elongation and assimilation
  are not standard MSA phonology, and a general Whisper model will produce false
  errors. Pilot on a handful of short surahs and measure false-positive rate before
  putting it in the daily loop. Do not install a local model for this without checking
  the box's memory budget first (see ~/workspace AGENTS.md).

---

## 10. The one-paragraph summary

Bayan's data layer, scheduler, and honesty about metrics are already better than most
commercial language apps. What stops it producing *advanced* readers is that it tests
recognition and trusts self-report: every exercise is multiple choice, every hifz grade
is an opinion, and a third of Quranic word tokens are excluded from the coverage model
because they have no root (the app *teaches* particles and verb forms — it just cannot
*measure* them, so nothing routes on them). Fix those three, add a freeflow band so reading builds speed
and not just difficulty tolerance, and add the wazn dimension so morphology becomes
multiplicative - and the daily loop starts producing the skill the app is named for.
Bayan means clarity of expression; right now the app measures whether you recognise
clarity, not whether you can produce it.
