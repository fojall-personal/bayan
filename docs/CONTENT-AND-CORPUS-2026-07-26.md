# Corpus and content — 2026-07-26

Written after a pass that started from two cosmetic complaints and ended in the
data layer. Kept because both root causes are the kind that look like polish and
are not.

---

## 1. The morphology corpus was missing 40% of itself

**Symptom.** `quran_word_morphology` held 77,429 rows and only 42% carried a
root. The word `qamar` appeared nowhere in the table — Surah 54 is named
Al-Qamar.

**Cause.** The corpus annotates **segments**, 128,219 of them across 77,429
words. The ingest matched location with

```
\((\d+):(\d+):(\d+):\d+\)
```

discarding the fourth group — the segment index — while the table keyed
`UNIQUE(surah_id, ayah_id, word_index)` and inserted with `OR IGNORE`. So for
each of the 42,093 multi-segment words, every segment after the first was dropped
silently. The survivor was the first, which for a prefixed word is the
`al-`/`wa-`/`bi-` particle: no lemma, no root.

54:1 is the clearest illustration. It should hold seven segments:

```
(54:1:1:1) {qotarabati  V    ROOT:qrb
(54:1:2:1) {l           DET  —
(54:1:2:2) s~aAEapu     N    ROOT:swE     <- lost
(54:1:3:1) wa           CONJ —
(54:1:3:2) {n$aq~a      V    ROOT:$qq     <- lost
(54:1:4:1) {lo          DET  —
(54:1:4:2) qamaru       N    ROOT:qmr     <- lost
```

It held four: the verb, and three particles.

**Fix.** Migration `0012` rebuilds the table on
`PRIMARY KEY (surah_id, ayah_id, word_index, segment_index)`, and
`scripts/ingest-morphology.mjs` now captures the segment index, pins the source
SHA-256, and refuses to emit unless the parse produces 128,219 segments with
49,968 roots — and unless root `qmr` is present, checked by name.

**Result.** Verified identical locally and in production:

| | before | after |
|---|---|---|
| rows | 77,429 | **128,219** |
| with a root | 32,749 | **49,968** |
| with a verb form | 0 | **8,977** |
| distinct roots | 1,451 | **1,642** |

Note the root *percentage* fell, from 42.3% to 39%. That is correct: the
denominator now includes prefixes and pronouns, which have no root. Assert the
absolute count, not the ratio.

The verb form was never extracted at all. It is the single most useful field for
pattern drills, and 8,977 verbs carry one.

## 2. The authored content had factual errors

The first of five grammar lessons — the one a beginner sees first — carried five:

- the sun-letter list had 13 of 14 letters (ض missing)
- `الْكِتَابُ` was annotated as a sun-letter example, but ك is a **moon** letter,
  and the entry's own transliteration `al-kitābu` shows the ل being pronounced
- all three sun-letter examples — `الْعَيْنُ`, `الْوَجْهُ`, `الْمَاءُ` — begin
  with moon letters

Plus one assessment instruction ending in `؟` (U+061F) inside an English
sentence, which reads as a backwards `?`.

None of that is a matter of taste. Sun and moon letters are closed sets of 14, so
membership is decidable and an example either begins with a letter of its own
class or it does not.

**Fix.** `scripts/check-content.mjs`, wired into CI. It found all seven
mechanically, including three I had not spotted by eye. Verified in both
directions: it passes on the corrected content, and re-seeding the original
errors turns CI red.

The examples are now `الشَّمْسُ` / `الْقَمَرُ` — the sun and the moon, which is
where the names come from.

## 3. Direction, not decoration

Reported as "some question marks were backwards". Cause:

```tsx
/[؀-ۿ]/.test(text) ? 'text-right arabic-text' : ''
```

in both `AssessmentFlow.tsx` and `TutorChat.tsx`. `.arabic-text` sets
`direction: rtl`, so a mostly-English sentence containing any Arabic was
reordered by the bidirectional algorithm and its trailing `?` moved to the left
end.

`.text-arabic` — font and leading, no direction — already existed alongside it.
The components had simply reached for the wrong one. Now `dir="auto"` plus
`.text-naskh`, so base direction comes from the first strong character: LTR for
*"What does مالك mean?"*, RTL for a wholly Arabic prompt.

This was the **third** instance of the same mistake in this codebase; the tutor
input was hardcoded RTL once too. The lesson is that "contains Arabic" is not the
same question as "is Arabic".

## 4. Squished script was a typeface property

Amiri has a small apparent size on the em: at a given `font-size` it renders
smaller and tighter than most faces. Leading was not the problem —
`--leading-arabic` was already 2.1.

Amiri stays for Quranic ayat, where it is the reference face for Uthmani and
handles stacked diacritics cleanly. **Noto Naskh Arabic** now carries
instructional text, where readability matters more than fidelity to the mushaf.

---

## What the corpus now supports

`workers/src/lib/buckwalter.ts` converts the corpus out of ASCII — it stores
`kita\`b`, not `كِتَٰب`, so nothing was displayable before this existed.
`workers/src/lib/root-families.ts` groups roots, infers Form I from an absent
marker (the corpus marks only II–XII, because Form I *is* the bare triliteral),
and builds drills whose distractors are all attested for that same root.

Three endpoints expose it, each returning the attribution so the UI cannot forget
it:

- `GET /api/grammar/root/:root` — the family in Arabic script
- `GET /api/grammar/word/:surah/:ayah/:word` — grounded i'rab, one entry per
  segment, nulls where the corpus is silent
- `GET /api/grammar/drills/forms` — pattern drills

Sample of what falls out without anyone authoring it: root ن ز ل yields أَنزَلَ
(Form IV) against نَزَّلَ (Form II) — a real point of exegesis, discovered in the
data.

**Attribution is a licence condition, not a courtesy.** The corpus is GNU GPL and
requires a visible link to corpus.quran.com wherever its data is surfaced.

## 5. The derived content, and what it renders

With the corpus whole, content generation became possible. 754 grammar exercises
and 908 memorization units, none of it authored.

`scripts/gen-derived-content.mjs` reads the two pinned inputs directly — corpus
and Quran text — verifies both by checksum, and refuses on mismatch.

**Grammar exercises** (`grammar_exercise_bank`), five kinds across five levels:

| kind | n | derived from |
|---|---|---|
| verb_form | 274 | the derived form II–XII, with Form I inferred from its absence |
| root_id | 240 | ROOT, distractors are other common roots sharing a letter |
| case_ending | 120 | NOM / ACC / GEN |
| pos_id | 60 | POS tag |
| aspect | 60 | PERF / IMPF / IMPV |

Level comes from root frequency: a word whose root occurs 300+ times is level 1.
Every item stores its `surah:ayah:word:segment`, and the UI shows that citation
after answering. **An exercise you can trace is one you can disprove** — the
property the five authored errors did not have.

All 754 were re-verified against the raw corpus file, independently of the
generator: every item has a real source, the answer appears in its options, no
duplicate options, and verb form, case and aspect each match the corpus row.
Zero defects.

**Memorization units** (`memorization_units`): 908 across all 114 surahs, ordered
shortest-surah-first, which is how they are learned in practice. Short surahs are
single units; longer ones split into groups of 5–8. Each unit records why it sits
where it does. Units already tracked are marked rather than offered again.

### Two quality problems caught by looking at the output

Neither would have failed a test, and both would have shipped.

**Fragments.** The first bank asked "what part of speech is سْمِ?" — the stem of
بِسْمِ with its `bi-` prefix split off, rendering as a letter followed by a sukun,
a form no learner meets alone. A first fix filtered words *starting* with a
diacritic and missed it exactly, because سْمِ starts with a letter. The real fix
is to ask only about segments that constitute a whole word: 35,336 of 77,429
qualify, which is ample.

**Stray ASCII.** 12,795 forms rendered with `^`, `@`, `,`, `.`, `[`, `#` and
others still in them — ضَّا^لِّينَ instead of ضَّآلِّينَ. The corpus uses an
*extended* Buckwalter for the mushaf's annotation marks that the standard table
omits.

Rather than guess fourteen mappings from memory, each was derived empirically:
rebuild every corpus word from its segments, map with the known table, and diff
against the same word in the pinned Tanzil text. The leftover codepoint is the
answer. Confidence ran 90–100% per mark.

    ^ U+0653 maddah above          @ U+06DF silent-letter zero
    , U+06E5 small waw             . U+06E6 small yeh
    [ U+06E2 small high meem       ] U+06ED small low meem
    # U+0654 hamza above           " U+06E0 upright rectangular zero

`[` and `]` resolving to the two iqlab meems is worth noting: those are
independently the same marks found while fixing the tajweed colouring. Two
separate investigations agreeing is better evidence than either alone.

### UI

`/grammar` has three tabs — Exercises, Roots, Deep-dive — with exercises first,
because it is the only one with depth behind it. `/memorization` gains a
Curriculum tab. Both surface the GPL attribution, which is a licence condition
rather than a courtesy.

## 6. Comprehension, and a tutor that stopped inventing Arabic

**The F4 gap.** All 754 exercises so far tested labelling — which form, which case,
which part of speech. Not one asked what a word *means*, because the morphology
corpus carries no English at all. An app that checks whether you can parse Arabic
but never whether you can read it is half built.

`quran_word_gloss` closes it: 77,429 words with English glosses from the
quran.com v4 word-by-word translation, cached under `data/wbw/`. From that,
1,200 comprehension items in two kinds — `word_meaning` ("what does X mean?") and
`find_word` ("which word here means Y?"), where the options are the other words of
that very ayah. Distractors are always real glosses of real words; an invented
gloss would be both guessable and a claim no source supports. All 1,200 were
re-verified against the cached source independently of the generator: zero defects.

The bank is now **3,034 exercises across 7 kinds**, after raising the per-bucket
cap from 60 to 150.

**The tutor was inventing Arabic.** Its madd answer offered السَّآمَّة and
الْحَآئِرِينَ as canonical examples. Checked against the pinned text: **0
occurrences each.** Both are fabricated, while the real examples — الضَّآلِّينَ
(6), السَّمَآء (118), جَآءَ (238) — sit in data the tutor never consulted. A chat
reply reads as more authoritative than a lesson, which makes this worse than the
sun-letter errors, not better.

It is now a classifier plus record lookups (`workers/src/lib/tutor-grounding.ts`).
It answers four things from data — a pasted word, a root, a location like `2:255`,
a named tajweed rule — and each branch has an explicit "the corpus does not
annotate this" path. Nothing generates prose about Arabic. No model is called,
which is both the F8 design and a necessity: Workers AI allows 10,000 neurons/day
shared across all users.

Verified live: "explain madd" now returns real annotated occurrences with
locations; `2:255` renders Ayat al-Kursi word by word with glosses.

One defect caught in my own rewrite: `answerWord` first pulled `LIMIT 20000` rows
and filtered in JS. That is roughly the first eight surahs, so any word later than
that was unfindable however it was typed. Now an indexed exact match with a
first-letter-bounded fallback.

## 7. Authored lessons, and the smaller items

Grammar lessons went from 5 to 10 — idafa, attached pronouns, verb forms I–IV,
demonstratives, negation. Prose cannot be derived, so this is the part that needs
checking by hand: **every Arabic example was verified to occur in the pinned text
before the lesson was written**, the same check that caught the tutor's
fabrications. Occurrence counts ranged from إِيَّاكَ (8) to لَا (4,381).

- **StatCard's positive trend had no colour.** It used `text-arabic-green`, which
  is not in the palette — `globals.css` lists it as a known dead token and
  ProgressBar and Badge had already been cleaned of it. Tailwind emits nothing for
  an undefined token, so a positive trend rendered unstyled while a negative one
  went red. Now `leaf-400`.
- **The weekly calendar showed dates and nothing else.** It now marks days with
  recorded activity, and says so when there is none, rather than looking like a
  streak tracker that never tracks. Also fixed a real bug: `getDate() - getDay() +
  1` lands on *next* Monday when today is Sunday.
- **`/health` and `/manifest.json` are public again**, via a *separate*
  path-scoped Access application — never a bypass on the main app, which is what
  silently exposed the whole site before. Verified: those two return 200 while
  `/`, `/dashboard`, `/grammar`, `/api/*` and the touch icon all still 302.
- **wrangler 3 → 4**, which required `@cloudflare/workers-types` 4 → 5 as a peer.
  Whole toolchain re-verified on v4: tests, `d1 execute`, `d1 migrations list`,
  `build:pages`, and the pages-config check.
- **`actions/checkout` and `actions/setup-node` bumped to v5.** The Node 20
  deprecation annotation was about the actions' own runtime, not the
  `node-version` input changed earlier — a correction to what I claimed then.

## 8. Checked against outside sources, and what that found

Everything above was verified against the corpus, the pinned text, or the
generator that produced it. None of that can catch an error the source itself
contains, or a claim I made confidently and never looked up. So: the glosses
against translators who are not our source, and every grammatical claim in the
ten lessons against outside references.

### The glosses hold. One earlier claim did not.

**A correction first.** I wrote that the 1,200 comprehension items were
"re-verified against the cached source independently of the generator." That was
weaker than it sounded: `gen-comprehension.mjs` builds *both* the exercise bank
and the gloss table from `data/wbw`, so agreement proves faithful transcription
and nothing about correctness.

**Alignment, properly independent.** Against the pinned Tanzil Uthmani text — a
different project from the gloss source — 6,236 ayahs and 77,429 words compared:
**1,196 of 1,200 items sit at the identical word position**, and the four
exceptions are the same word encoded differently (`ٱلْـَٔاخِرَةِ` against
`ٱلْءَاخِرَةِ`). Two structural differences are accounted for rather than waved
past: 112 ayahs where Tanzil folds the basmala into ayah 1, and 37:130, where
`إِلْ يَاسِينَ` is one word in one file and two in the other. This is the check
that matters, because a one-position shift would make every affected exercise
wrong while looking perfectly well-formed.

**corpus.quran.com cannot corroborate meaning.** Fetching 19:2 and 25:25 returned
glosses identical to ours word for word — quran.com serves the Leeds text. Worth
recording before someone cites it as a second opinion.

**Meaning, against five translators who are not our source.** Saheeh
International, Pickthall, Yusuf Ali, Hilali-Khan and Arberry, via tanzil.net:
**861 of 895** glosses with checkable content share vocabulary with at least one
— 96.2%. All 33 distinct exceptions read as translator divergence (`قَدْ` →
"Indeed" where all five say "already"), name transliteration (Maryam/Mary,
Isa/Jesus), or British spelling. No factual errors. Three upstream glosses are
weak — `عَلَيْهِمْ` → "on themselves" (1:7:7) and `هُمُ` → "themselves" (2:12:3,
2:13:15), where "them"/"they" is what the grammar supports. Left as the source
has them.

One source alone was useless: Saheeh International by itself flagged 17.9%, because
a word-by-word gloss and flowing prose legitimately choose different words. Five
sources with an any-match rule is what made the screen readable.

### Two real defects in the comprehension bank

- **Every item came from surahs 1–26, and 54% from surah 2 alone.** Nothing from
  Juz 30 — the short surahs a beginner memorises first. Candidates are generated
  in text order and the per-bucket cap took the first N, so the bank never reached
  the back of the book. Same mistake as the `LIMIT 20000` in the tutor's word
  lookup: the head of an ordered list where a spread was needed. Now a
  deterministic round-robin over surahs: **114 of 114 surahs, largest single-surah
  share 1.8%, all 37 Juz 30 surahs present.**
- **Four items had a distractor that was also correct** — "and the sky" against
  "the sky", and worst, `[the] people` against `(the) People`, which differ only
  in bracket style. Options were compared as lowercased strings. They are now
  compared on a normalised key that drops brackets, articles and leading
  particles. A fifth defect surfaced while fixing it: 17:72 says `أَعْمَىٰ` twice
  with two different glosses, so the gloss-uniqueness check passed while the
  options listed the same Arabic twice — one of two identical buttons marked
  wrong. Ayahs that repeat a word are now skipped.

Also fixed: `find_word` always asked about `teachable[0]`, the first eligible word
of the ayah, which made every item answerable by position rather than by meaning.

### Four confirmed defects in the lessons

Prose is the part no generator can check, and it is where the errors were.

1. **grammar-05 broke the rule grammar-01 teaches, three times.** All three
   examples spelled `الْرَّجُلُ` with both a sukoon on the lām and a shadda on the
   ر — asserting the lām is pronounced and assimilated at once. Sun letters take
   no sukoon on the lām. grammar-01 spells `الشَّمْسُ` correctly two lessons
   earlier, so the app taught the rule and then contradicted it.
2. **grammar-07 was a lesson on attached pronouns containing no attached
   pronoun.** `إِيَّاكَ` is a *detached* accusative pronoun (ضمير نصب منفصل), and
   the corpus settles it: `<iy~aAka` is tagged `STEM|POS:PRON|LEM:<iy~aA`, while
   genuine attached pronouns are `SUFFIX|PRON:3MS`. `نَعْبُدُ` is a single segment
   with no pronoun at all — its subject is implied (ضمير مستتر). Replaced with
   `رَبِّكَ` and `فِيهِ`, both real suffix cases, plus a rule naming the three
   categories so the contrast is explicit rather than accidental.
3. **grammar-04's prose contradicted its own conjugation table.** It listed the
   prefixes as "ت (you/he/she)"; ت never marks "he". And it gave the masculine
   plural suffix as `وُنا`, which is not the suffix — it is `ـُونَ`. The table
   itself was right.
4. **grammar-06 gave the wrong reason for a right answer.** "Both nouns genitive
   because the phrase follows مَٰلِكِ." The external i'rab of 1:4 has `يَوْمِ`
   genitive as the possessed term and `ٱلدِّينِ` as the second possessor in a
   *chained* idafa.

Two smaller ones: grammar-09 cited `ذَٰلِكَ ٱلْكِتَابُ` with a full alef where the
Quran writes a dagger alef, and grammar-10 omitted لم — which the reference calls
the main way to negate a past-tense verb — while teaching ما as though it were the
only one.

**Verified correct, which is most of it:** grammar-01's sun and moon lists are both
exactly 14 with ض present; grammar-08 is right on every count, including its claim
that the corpus marks Forms II–XII, which the file confirms exactly (II through XII
present, no Form I marker); grammar-10's four particle claims all match the
reference; grammar-09, grammar-03 and grammar-02's paradigm are sound.

### The gate now covers what it missed

`check-content.mjs` gained three checks, and **all seven seeded defects make it
exit non-zero** — including the two that got through last round:

- **Sun-letter orthography**, both directions: no sukoon on the lām of ال before a
  sun letter, no shadda on a moon letter directly after it. Decidable from the
  codepoints.
- **Arabic everywhere in a lesson, not just `content.examples`.** The previous
  check only walked the field I happened to think of, which is how two spellings
  in `rules[].description` shipped unexamined. Vocalised Arabic is treated as a
  quotation and must occur in the pinned text; unvocalised Arabic is metalanguage
  (المضاف إليه, حروف شمسية) and is skipped, which is what keeps the output
  readable. Authored teaching sentences declare themselves with `"quranic": false`
  — the default is the strict one, because both missed spellings were undeclared.
- **Options that mean the same thing**, on the same normalised key the generator
  now uses, plus repeated options and out-of-range `correct` indices.

**`scripts/gen-lessons-sql.mjs` is new, and closes a silent drift.**
`seed-lessons.sql` was hand-produced, so editing `lessons.json` changed the file
the gate reads and left the file the database is seeded from untouched — green
gate, stale content, no diff. `--check` runs in CI, the same pattern as
`sync-pages-config.mjs`.

## 9. Making the course actually teachable

Three items were left open after the external check: the lessons' pedagogy was
unexamined, three glosses looked weak, and level 5 verb_form was thin. Pulling on
each found something bigger than the item.

### Four of ten lessons could never be reached

grammar-02's only exercise was a `match`, and the grader excludes `match` from the
denominator — correctly, since there is no matching implementation. So it scored
0, never met the 70% completion bar, and never completed. grammar-04 lists it as a
prerequisite; grammar-08 and grammar-10 depend on grammar-04. **A learner stalled
permanently at lesson two, and six of the ten were unreachable in practice.**

Every individual lesson was fine. Nothing looked at the composition.

Six lessons also had exactly one gradable exercise, which at a 70% pass mark is
all-or-nothing: one wrong answer scores 0 and fails the lesson. Every lesson now
has at least two, so partial credit means something.

`scripts/check-pedagogy.mjs` is new and runs in CI. It simulates the whole path
from a standing start, and **all 7 seeded defects make it exit non-zero** —
including the exact shipped bug, its cascade, prerequisite cycles, a missing
prerequisite id, a backwards ramp (a level-2 lesson depending on a level-3 one),
and a hole in the level sequence. It asks whether the course *works*;
`check-content.mjs` asks whether it is *true*. Different questions.

### The glosses were not wrong. The questions were.

I had flagged `عَلَيْهِمْ` → "on themselves" and `هُمُ` → "themselves" as weak
upstream data. **That was my error.** Read in the source's own running chain —
"those who earned (Your) wrath | on themselves" — it is idiomatic and correct.
They only look wrong pulled out of the chain and posed as standalone questions.
Overriding the translation would have been the wrong fix.

The real defect was next door and much larger: **390 of the 1,200 comprehension
items — nearly a third — asked about a word with no lexical content.**
Prepositions, relative pronouns, negation particles, and 30 items on the Quranic
initials, which have no meaning to give at all. "What does مِن mean?" is not a
comprehension question; "What does الم mean?" has no answer.

The existing filter was an English wordlist, which cannot know that "Those who" is
ٱلَّذِينَ. The morphology corpus can: a word is askable when some segment of it is
a noun, verb, adjective, proper noun or adverb. Verified before relying on it —
corpus and word-by-word agree on the word count for all 6,236 ayahs, so index N
is the same word in both. **390 → 0.**

Also fixed: 20 questions displayed a waqf sign dangling off the end of the word
(`ٱلْأَرْضِ ۖ`), because the source attaches a between-words pause mark to the
word before it. Marks *inside* a word — the `۟` of `ءَامَنُوٓا۟` — are correct
Uthmani orthography and were left alone.

### "Level" did not mean anything for three of the five kinds

Level 5 verb_form having 34 of 150 items was a symptom. The cause: **three kinds
hard-coded their level.** `pos_id` was always 1, `aspect` always 2, `case_ending`
2 or 3. And `root_id` skipped any root occurring fewer than 20 times while level 5
is *defined* as fewer than 15 — the filter excluded exactly the band that defines
the level, so level 5 was unreachable by construction.

Only **13 of 25 (kind, level) buckets existed**, which is exactly what the database
contained. A learner choosing "Level 5 — rare roots" got 34 verb_form items and
nothing else; level 1 offered three kinds out of five.

Worse, the cap took the first N candidates in corpus order, so **eight of the
thirteen live buckets drew on two surahs or fewer, and their highest surah was 2.**
The learner was studying al-Baqarah and nothing else, and no part of the UI said so.

Now every kind ramps on word-form frequency, so "level" denotes one thing across
the bank, and selection round-robins over surahs. **All 25 buckets full at 150:
3,750 derived exercises, up from 1,834, spread over 114 of 114 surahs, balanced
750 per kind and 750 per level.** The UI labels were rewritten to match, since
"rare roots" only ever described one kind.

verb_form level 5 was fixed by asking the same question of a rare *word* from a
well-attested root rather than a rare root. 1,580 level-5 candidates existed under
the old definition, but a rare root seldom has the three attested forms the
question needs for real distractors, so nearly all were filtered out downstream.

The new validator caught two pre-existing defects while it was at it: some
verb_form items offered only 3 options rather than 4. That is kept, deliberately —
distractors must be forms the corpus attests for that root, and inventing a fourth
would teach something false. Requiring four would leave level 1 with 125
candidates instead of 150. Selection now prefers 4-option items and falls back to
3 only to fill. `aspect` and `case_ending` are inherently three-way.

The bank is now **4,950 exercises across 7 kinds**.

## 10. The first UI audit, and what it found

Nobody had ever looked at this app. Every UI change until now was made by reading
code and verified with tsc, lint and a build — none of which look at pixels. The
two defects reported from real use (squished script, backwards question marks) were
the only visual QA it had ever had.

So the app was served locally against the real database — Access blocks the
deployed site, but the middleware falls back to a bearer token when the Access
variables are unset — and driven at 1280x720 and 375x812. Everything below is
measured from the live DOM, not read off a screenshot, because the browser pane
produced one rendering artifact that looked exactly like a layout bug.

### The flagship feature was broken four ways at once

"Color-coded Quran text with rule visualization" is the headline of the Tajweed
page. It was rendering:

1. **The Quran in a Latin sans-serif.** The verse container carried
   `text-3xl text-center leading-loose` — no Arabic font class, no `lang`. Computed
   family: IBM Plex Sans. Every Arabic typography decision in the design system was
   bypassed on the one screen that displays scripture.
2. **With the cursive joins broken.** Each tagged letter was wrapped in a span with
   `padding: 0 2px`, which forces the shaping engine to break the run. Measured:
   بِسْمِ went 57.6px to 102.4px, a **78% inflation**, letters rendering in isolated
   rather than connected forms. For Arabic that is a correctness failure.
3. **Coloured as highlighter blocks.** `background-color` with a border radius,
   painted over the glyphs rather than colouring the script.
4. **In the palette the app had abandoned.** 9 of 10 rule colours were absent from
   globals.css, and three failed 4.5:1 outright — makharij 4.44, idghaam 3.89,
   silent 3.89.

globals.css says the tajweed colours were "retuned for the green ground" and names
the two problems it fixed. The retuning reached the CSS tokens. It never reached
`tajweed_rules` in D1 — which is what the reader actually renders, through an
inline style. The fix that was documented had never shipped.

**The decisive experiment** was whether spans break Arabic shaping at all, because
that determined the whole approach. They do not: a span setting only `color`
measures **byte-identical to plain text**, 57.6px either way. Padding was the
entire cause. So the reader now colours the script — which is also what a printed
Tajweed Quran does — in Amiri, with `lang="ar"` and `leading-arabic`.

**Four rule colours had no token at all**, because the renderer classifies ten
categories and the palette defined six. Those were designed against numbers rather
than by eye: each ≥ 4.5:1 on canvas, ≥ 25 CIE76 from every other rule colour so the
coding actually distinguishes, and ≥ 22 from gold-500 and leaf-500 so no rule looks
like the accent or like progress. Tightest pair is idghaam/qalqalah at ΔE 25.0 —
both warm, and hue 0 was the only gap the existing six left. `silent` is
deliberately ground-400 rather than a new hue: a letter that is not pronounced
should read as de-emphasised text, not as another colour competing for attention.
Migration 0016 aligns the data; the test fixtures moved with it, since their comment
claims to document what the API returns.

### The rest

- **The GPL attribution failed contrast** at 4.12:1 — ground-500 at 12px. That token
  is designated "disabled ink, icon rest", not text. Now ground-400, 5.05:1. It is
  also a licence condition, which makes it the worst thing to render sub-legibly.
- **The mobile menu trigger was 36×36**, the only way to navigate on a phone. Now
  44×44. The segmented control was 33px high; now 44. Sub-44px targets went 6 to 1.
- **The memorization index showed no Arabic at all** — a learner memorising Quran saw
  only transliterations and counts. surahs.ts already carried the Arabic from
  Tanzil's metadata, so it had been available the whole time. Now rendered in Amiri
  at 20px with `lang="ar"`.
- **The primary button had no hover state.** `hover:bg-gold-500` was identical to its
  base, so the app's main call to action did not respond to the pointer. Now
  gold-400. It was the only such no-op across all 44 components.

### Two findings that did not survive measurement

Both were mine, inferred from static greps, and both were wrong:

- **"Mobile is likely untested — 33 responsive utilities is thin."** At 375×812 there
  is no horizontal overflow, the hamburger has correct `aria-label` and
  `aria-expanded`, all nine links render at 45px when open, and the Arabic fits. The
  responsive layout is sound.
- **"At least 3 unlabelled form controls."** Not reproduced. Every control on the live
  pages had an accessible name; the static count compared `htmlFor` against control
  tags without accounting for `aria-label` or wrapping labels.

Verified working and left alone: the focus ring is exactly per spec — `:focus-visible`
matches on real keyboard Tab, 2px solid gold-500 at 2px offset. Both Arabic faces
load real 700 weights, so bold Arabic is not synthesised.

## 11. From eight modules to one text

The entry point never read the profile. `/` was a goal picker whose only exit was a
hard-coded `href="/assessment"`, so a learner with `onboarding_completed = 1` and a
stored `current_path` landed back on it and the only way forward was the fifteen-minute
test they had already passed. State written on submit, nothing at the entry point
consulting it — the same shape as the design-system drift and the lesson dead-end.

Pulling on that produced a product thesis rather than a routing patch.

### The corpus is closed, so coverage is arithmetic

Every language app works against an open vocabulary and therefore cannot tell you how
much you know. This one can. Measured from the data in this repository:

| | |
|---|---|
| 63 roots | half of every rooted word in the Quran |
| 249 roots | 80% |
| 100 roots | **620 ayahs** readable end to end |
| 400 roots | **3,046 ayahs — half the text** |

`user_known_root` is the only new table the model needed. `GET /api/progress/coverage`
turns it into true statements, and **620 at 100 roots has now been confirmed three
independent ways**: a Python pass over the raw corpus file, the SQL endpoint, and the
calibration flow.

### What shipped

- **Today** replaces the dashboard: one primary action chosen from what is actually
  due — reviews first because SM-2 decides when they matter, the next root when
  nothing is owed. Every value came from an endpoint that already existed and nothing
  was using.
- **`/read`** is the ayah as one object: one call to the new
  `GET /api/quran/ayah/:surah/:ayah`, five lenses. Unknown words render gold under a
  dotted underline and offer their root inline, so "2 words to learn" is a finishable
  task rather than a percentage.
- **Root calibration** measures rather than infers. Seeding known roots from the
  placement score was the tempting shortcut and would have been fabrication — the
  assessment's eighteen questions never ask which roots you know. Twelve roots sampled
  across the frequency ranking, answers recorded as fact, and the banded fill offered
  as the estimate it is with the monotonicity assumption stated in the sentence the
  learner reads.
- **6,236 translations** from Saheeh International via Tanzil, SHA-pinned with three
  spot-checks before emit. The column had existed empty all along, so the Meaning lens
  could only offer the gloss chain — and a gloss chain read as prose is exactly what
  made three glosses look wrong earlier when they were fine in sequence.
- **Nav 8 → 6.** Dashboard and Progress both answered "how am I doing"; "Advanced"
  named a drawer rather than a subject and was in no nav and no in-page link, so
  nothing in it was findable. It is now linked from Memorize, where its tools belong.

### Arabic shaping, verified rather than assumed

The tajweed reader had been rendering the Quran in a Latin sans, letter-by-letter with
`padding: 0 2px` breaking every cursive join — measured, بِسْمِ inflated 78%. The fix
was to colour the text and nothing else. The decisive experiment: a span setting only
`color` measures **byte-identical** to plain text.

Then checked everywhere, not just where the bug was. Clone each composite element into
an off-layout probe, render the same characters as one text node, compare widths;
Arabic shaping is width-sensitive, so equal width proves one continuous run. The
detector was validated against the real defect first — padding +44.8px, background
+44.8px, `inline-block` +20.8px all caught. Results: the basmala across 13 spans at
207.5px versus 207.5px plain; `/tajweed` 8 composite elements up to 14 spans each, all
passing; `/grammar` all single text nodes and unsplittable by construction.

**Two of my own checkers returned "clean" having examined nothing.** The first skipped
elements taller than 1.6 line-heights, which excluded the ayah — the only element that
mattered. The second was disabled by a `width < 2` guard, because the browser pane
reports `innerWidth: 0`, so every live rect measured zero. Both looked like passes.
That is why the invariant is now a CI gate: `gen-design-system.mjs --check` fails if
either renderer styles a segment span with padding, margin, background, border or
display, and it is proven to fail on the markup that shipped.

## Still open

- **The 96.2% gloss agreement is a screen, not a proof.** A correct word-by-word
  gloss can use vocabulary no flowing translation chose, and content-word matching
  with a truncating stemmer will both miss subtle errors and flag correct glosses.
  It rules out gross errors; it cannot certify nuance. No bulk gloss source of
  documented provenance independent of Leeds was findable.
- **`/dashboard` is unreachable.** Nothing links to it and it is not in the nav, so
  the only way in is to type the URL — the same condition `/advanced` was in. Its two
  panels, "Progress Overview" and "This Week", are both covered by `/progress`, and
  "what now" is covered by Today. It looks like dead weight that should be deleted,
  but removing a whole page is a call worth making deliberately rather than in passing.
- **The wordmark link is 88×22.** Below the tap floor, but it is a text logo rather
  than a control users hunt for, so it was left as it is.
- **Whether the explanations teach well is still unexamined.** Reachability, the
  ramp, prerequisite integrity and exercise weighting are now gated. Whether the
  prose actually lands is a judgement no script makes.
- **Two exercises per lesson is a floor, not a target.** It makes partial credit
  possible; it does not make a lesson thorough.
- **Self-recording is unimplemented**, deliberately excluded. The original hook
  was broken and microphone capture cannot be verified headlessly.
- **The D1 Time Travel drill was retired**, not deferred: every large table is
  regenerable from a committed generator with a checksummed input, and the only
  irreplaceable data is 13 rows. Revisit once real review history accumulates —
  SM-2 state records when someone actually studied, which no generator can
  reconstruct.
