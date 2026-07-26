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

## Still open

- **Level 5 verb_form is 34 items, not 150** — rare roots do not supply enough
  whole-word verb candidates. Reported short rather than padded.
- **Self-recording is unimplemented**, deliberately excluded. The original hook
  was broken and microphone capture cannot be verified headlessly.
- **The D1 Time Travel drill was retired**, not deferred: every large table is
  regenerable from a committed generator with a checksummed input, and the only
  irreplaceable data is 13 rows. Revisit once real review history accumulates —
  SM-2 state records when someone actually studied, which no generator can
  reconstruct.
