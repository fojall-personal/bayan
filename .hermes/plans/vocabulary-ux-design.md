# Vocabulary Tab — UX Design Specification

## Design Goals
- **Explore first, drill second**: Show the root-family structure prominently; mastery is secondary
- **Every element works**: No dead-end empty states; honest "no data" messages
- **Arabic room**: Amiri for Arabic text, Noto Naskh for teaching text, leading-arabic for Arabic containers
- **Gold means act here**: The root name is gold because it's the primary interactive element

## Data Model
- 103 words in `content/vocabulary/core-100.json`
- ~84 unique roots (some words share a root, ~4 words have no root)
- Words without roots: مِن, فِي, عَلَى, etc. (prepositions/function words)
- Each word: word (Arabic), transliteration, meaning, root, part_of_speech, frequency_rank
- Mastery tracked in `vocabulary_mastery`: meaning_known, reading_known, reviews

## Layout

### All Roots View (default)
```
┌─────────────────────────────────────────────────────────┐
│  Vocabulary (الجُذُور)                                    │
│  84 roots · 103 words · 4 unrooted                         │
├─────────────────────────────────────────────────────────┤
│  [Search: _________________]                             │
│  Showing 84 of 84 roots                                   │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │  ك ت ب             │  │  مـن               │         │
│  │  book / write      │  │  from, of          │         │
│  │  5 words · ★★★☆☆   │  │  function word     │         │
│  │  ──────────────    │  │  ░░░░░░░░░░░░░░░░  │         │
│  │  Mastery: 3/5      │  │  Mastery: 0/5      │         │
│  └────────────────────┘  └────────────────────┘         │
│                                                          │
│  ┌────────────────────┐  ┌────────────────────┐         │
│  │  اللَّه            │  │  عَلَى             │         │
│  │  God               │  │  on, upon          │         │
│  │  1 word · ★★★★★   │  │  function word     │         │
│  │  ──────────────    │  │  ──────────────    │         │
│  │  Mastery: 5/5      │  │  Mastery: 2/5      │         │
│  └────────────────────┘  └────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### Root Family Detail View
```
┌─────────────────────────────────────────────────────────┐
│  ← Back to all roots                                      │
├─────────────────────────────────────────────────────────┤
│  ك ت ب                                                    │
│  to write (core meaning of the family)                     │
│  5 words in family · ★★★☆☆ mastered                      │
├─────────────────────────────────────────────────────────┤
│  Family Members:                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  كتاب (kitāb)  noun  #45     12 reviews  Mastered  │ │
│  │    meaning: book, written text                      │ │
│  ├────────────────────────────────────────────────────┤ │
│  │  كاتب (kātib)  noun  #128   5 reviews              │ │
│  │    meaning: writer, author                          │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  Corpus Evidence (from quran_word_morphology):           │
│  2,857 occurrences across 48 surahs                       │
├─────────────────────────────────────────────────────────┤
│              [Practice this root]                         │
└─────────────────────────────────────────────────────────┘
```

## Empty States
- No vocabulary loaded: "Vocabulary content hasn't been seeded yet. Contact the administrator."
- No search results: "No roots match "{search}". Try a different term."
- Root with no family members: shouldn't happen (by definition a root has at least one word)
- No mastery data: show gray progress bar, no green

## API Contract
- `GET /api/vocabulary` → `{ data: [{ word, transliteration, meaning, root, frequency_rank, part_of_speech, mastery: {meaningKnown, readingKnown, reviews} }] }`
- `GET /api/vocabulary/root/:root` → `{ data: { root, meaning, members: [...], corpusEvidence: {...} } }`
- `POST /api/vocabulary/mastery` → `{ data: { success, root, mastery: {...} } }`

## Component Structure
- `VocabularyView` — main view, grid of RootCards, search bar, stats header
- `RootCard` — single root display (Arabic name, meaning, word count, mastery bar)
- `RootFamilyDetail` — expanded view of one root's family
- `FunctionWordCard` — separate card for words without roots (smaller, different styling)
