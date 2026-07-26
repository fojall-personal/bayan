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

## Still open

- **Volume.** The derivation machinery exists and 1,642 roots are available, but
  only three endpoints consume it and no UI renders them yet. That is the next
  increment, and it is now safe volume.
- **D1 Time Travel restore drill** — never run. Content is the asset hardest to
  reproduce, and the backup remains untested.
- `/health` and the icon paths sit behind Access. Re-exposing them needs a
  separate path-scoped Access application — never a bypass policy on the main
  app, which is what silently left the whole site public before.
