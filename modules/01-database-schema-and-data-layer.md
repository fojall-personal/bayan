# Module 1 — Database Schema & Data Layer

## Overview
Populates D1 with all content data: Quran verses, vocabulary, grammar lessons, assessment questions, and tajweed rules. This module transforms the empty schema from Module 0 into a working knowledge base.

## Dependencies
- **Module 0** must be complete: D1 database exists, schema migrated, `Database` wrapper class works
- Data files must exist in `content/` directory (seeded before production deploy)

## What This Module Delivers
- Seeded database with 114 surahs + 6236 ayahs (minimal data)
- 1000-word Quranic vocabulary frequency list with meanings and patterns
- 30 grammar lessons across 5 levels (beginner → advanced)
- 4 assessment modules with 60+ questions
- Tajweed rule definitions with color mappings
- Quran API integration layer (tanzil.net + Quran.com)

## Data Architecture

### Data Flow

```
Static Content (content/*.json)
        ↓
  Seed Script (scripts/seed-db.ts)
        ↓
  D1 Database Tables
        ↓
  Workers API (read-only for content)
        ↓
  Frontend (renders lessons, quizzes, vocabulary)
```

### Data Sources
| Content | Source | Format | Storage |
|---------|--------|--------|---------|
| Quran text | tanzil.net (Uthmani) + Quran.com API | JSON | D1 + KV cache |
| Translations | Dr. Mustafa Khattab (Clear Quran) | JSON | D1 + KV cache |
| Audio | Quran.com API (Alafasy, AbdulBasit) | URLs | KV (stored, not downloaded) |
| Vocabulary | Quranic Arabic Corpus + custom | JSON | D1 |
| Grammar lessons | Custom curriculum (Arabic for Non-Natives inspired) | JSON | D1 |
| Assessment questions | Custom (60+ questions) | JSON | D1 |
| Tajweed rules | Custom + Quran.com tajweed data | JSON | D1 |

## File Specifications

### `content/vocabulary.json` — Vocabulary Database
```json
[
  {
    "word": "الرحمن",
    "transliteration": "ar-raḥmān",
    "meaning": "The Most Merciful",
    "root": "ر ح م",
    "pattern": "فَعْلَان",
    "part_of_speech": "noun",
    "frequency_rank": 45,
    "surahs_appearing": [1, 2, 3, 5, 6, 17, 19, 21, 25, 43, 55, 57, 59, 67, 78, 81, 85, 87, 88, 89, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
    "examples": [
      {"surah": 1, "ayah": 3, "text": "الرَّحْمَٰنِ الرَّحِيمِ"},
      {"surah": 55, "ayah": 1, "text": "الرَّحْمَٰنُ"}
    ]
  },
  {
    "word": "سَمِعَ",
    "transliteration": "sami'a",
    "meaning": "he heard",
    "root": "س م ع",
    "pattern": "فَعِلَ",
    "part_of_speech": "verb",
    "frequency_rank": 112,
    "surahs_appearing": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114],
    "examples": [
      {"surah": 2, "ayah": 28, "text": "كَيْفَ تَكْفُرُونَ بِاللَّهِ وَكُنتُمْ أَمْوَاتًا فَأَحْيَاكُم ۖ ثُمَّ يُمِيتُكُمْ ثُمَّ يُحْيِيكُمْ ثُمَّ إِلَيْهِ تُرْجَعُونَ"},
      {"surah": 3, "ayah": 38, "text": "رَبِّ هَبْ لِي مِن لَّدُنكَ ذُرِّيَّةً طَيِّبَةً ۖ إِنَّكَ سَمِيعُ الدُّعَاءِ"}
    ]
  }
]
```

### `content/grammar/lessons.json` — Grammar Curriculum
```json
[
  {
    "id": "grammar-01",
    "title": "Articles and Nouns (الArticles and Nouns)",
    "module": "grammar",
    "level": 1,
    "prerequisites": [],
    "estimated_minutes": 20,
    "content": {
      "explanation": "Arabic nouns are either definite or indefinite. The definite article is ال (al-). When attached, it changes based on the first letter of the noun...",
      "examples": [
        {"arabic": "الْكِتَابُ", "transliteration": "al-kitābu", "meaning": "the book", "rule": "sun letter — ال assimilates to ت"},
        {"arabic": "الْقَمَرُ", "transliteration": "al-qamaru", "meaning": "the moon", "rule": "moon letter — ال keeps its ل sound"}
      ],
      "rules": [
        {
          "name": "Sun Letters (حروف شمسية)",
          "description": "When ال attaches to a noun starting with one of these letters, the ل is dropped and the following letter takes a shadda",
          "letters": "ت ث د ذ ر ز س ش ص ط ظ ل ن",
          "examples": ["الْعَيْنُ", "الْوَجْهُ", "الْمَاءُ"]
        },
        {
          "name": "Moon Letters (حروف قمرية)",
          "description": "When ال attaches to a noun starting with one of these letters, the ل is pronounced",
          "letters": "ا ب ج ح خ ع غ ف ق ك م ه و ي",
          "examples": ["الْبَابُ", "الْجَبَلُ", "الْقَمَرُ"]
        }
      ]
    },
    "exercises": [
      {
        "type": "multiple_choice",
        "question": "Which of these is a moon letter?",
        "options": ["ت", "س", "ب", "ر"],
        "correct": 2,
        "explanation": "ب is a moon letter. ت، س، and ر are sun letters."
      },
      {
        "type": "fill_blank",
        "question": "Complete: ال + كِتَاب = ___",
        "correct": "الْكِتَابُ",
        "explanation": "ك is a moon letter, so the ل is pronounced."
      }
    ]
  },
  {
    "id": "grammar-02",
    "title": "Verb Conjugation — Past Tense (الماضي)",
    "module": "grammar",
    "level": 1,
    "prerequisites": ["grammar-01"],
    "estimated_minutes": 25,
    "content": {
      "explanation": "Arabic verbs change based on the subject. The past tense (ماضي) is the simplest form...",
      "conjugation_table": {
        "root": "ك ت ب",
        "meaning": "to write",
        "forms": {
          "he": "كَتَبَ",
          "she": "كَتَبَتْ",
          "they_two": "كَتَبَا",
          "they_men": "كَتَبُوا",
          "they_women": "كَتَبْنَ",
          "you_m": "كَتَبْتَ",
          "you_f": "كَتَبْتِ",
          "we": "كَتَبْنَا",
          "I": "كَتَبْتُ"
        }
      }
    },
    "exercises": [
      {
        "type": "match",
        "question": "Match the conjugation of كَتَبَ (he wrote) with the correct subject",
        "pairs": [
          {"item": "كَتَبُوا", "answer": "they (men) wrote"},
          {"item": "كَتَبْنَ", "answer": "they (women) wrote"},
          {"item": "كَتَبْنا", "answer": "we wrote"}
        ]
      }
    ]
  }
]
```

### `content/assessments/placement-test.json` — Assessment Questions
```json
{
  "modules": [
    {
      "id": "literacy",
      "title": "Arabic Script Literacy",
      "duration_minutes": 10,
      "passing_score": 60,
      "questions": [
        {
          "id": "lit-01",
          "type": "audio_listen",
          "instruction": "Listen to the word. Select the correct Arabic spelling.",
          "audio": "https://cdn.quran.com/audio/word/1.mp3",
          "options": [
            {"text": "كِتَاب", "correct": true},
            {"text": "كَتَبَ", "correct": false},
            {"text": "كُتُب", "correct": false},
            {"text": "مَكْتَب", "correct": false}
          ]
        },
        {
          "id": "lit-02",
          "type": "vowel_recognition",
          "instruction": "Select the correct diacritical marks for: ك _ ت _ ب",
          "options": [
            {"text": "كِتَاب (book)", "correct": true},
            {"text": "كَتَبَ (he wrote)", "correct": false},
            {"text": "كُتُب (books)", "correct": false},
            {"text": "كَتّاب (writers)", "correct": false}
          ]
        }
      ]
    },
    {
      "id": "comprehension",
      "title": "Classical Arabic Comprehension",
      "duration_minutes": 15,
      "passing_score": 50,
      "questions": [
        {
          "id": "comp-01",
          "type": "reading_comprehension",
          "surah": 1,
          "ayah_range": "1-7",
          "instruction": "Read the verse and answer: What does 'الرَّحْمَٰنِ الرَّحِيمِ' mean?",
          "options": [
            {"text": "The Merciful, The Forgiving", "correct": true},
            {"text": "The King, The Powerful", "correct": false},
            {"text": "The Creator, The Sustainer", "correct": false},
            {"text": "The Guide, The Protector", "correct": false}
          ],
          "difficulty": 1
        },
        {
          "id": "comp-02",
          "type": "reading_comprehension",
          "surah": 2,
          "ayah_range": "1-5",
          "instruction": "What does the Quran say about the Muttaqeen (God-conscious)?",
          "options": [
            {"text": "They are the successful ones", "correct": true},
            {"text": "They are the wealthy ones", "correct": false},
            {"text": "They are the powerful ones", "correct": false},
            {"text": "They are the learned ones", "correct": false}
          ],
          "difficulty": 2
        }
      ]
    },
    {
      "id": "grammar",
      "title": "Arabic Grammar Knowledge",
      "duration_minutes": 15,
      "passing_score": 40,
      "questions": [
        {
          "id": "gram-01",
          "type": "identification",
          "instruction": "Identify the type of noun: كِتَاب",
          "options": [
            {"text": "Definite noun (مَعْرِفَة)", "correct": false},
            {"text": "Indefinite noun (نَكِرَة)", "correct": true},
            {"text": "Proper noun (عَلَم)", "correct": false},
            {"text": "Pronoun (ضَمِير)", "correct": false}
          ],
          "explanation": "كِتَاب without ال is indefinite (نَكِرَة)."
        },
        {
          "id": "gram-02",
          "type": "pattern_recognition",
          "instruction": "What verb pattern is كَتَبَ?",
          "options": [
            {"text": "فَعَلَ (Form I, past tense)", "correct": true},
            {"text": "فَاعَلَ (Form II, past tense)", "correct": false},
            {"text": "فَعِّلَ (Form III, past tense)", "correct": false},
            {"text": "أَفْعَلَ (Form IV, past tense)", "correct": false}
          ]
        }
      ]
    },
    {
      "id": "memorization",
      "title": "Memorization Baseline",
      "duration_minutes": 10,
      "passing_score": 30,
      "questions": [
        {
          "id": "mem-01",
          "type": "next_ayah",
          "instruction": "What is the next ayah after: بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
          "options": [
            {"text": "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ", "correct": true},
            {"text": "الرَّحْمَٰنِ الرَّحِيمِ", "correct": false},
            {"text": "مَالِكِ يَوْمِ الدِّينِ", "correct": false},
            {"text": "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", "correct": false}
          ],
          "surah": 1,
          "ayah": 2
        }
      ]
    }
  ]
}
```

### `content/tajweed-rules.json` — Tajweed Rule Definitions
```json
[
  {
    "id": "madd",
    "name": "Madd (مَدّ)",
    "description": " elongation of certain vowels",
    "subcategories": [
      {
        "id": "madd_natural",
        "name": "Madd Tabi'i (مَدّ طَبِيعِيّ)",
        "description": "Natural elongation of alif, waw, or yaa when followed by their corresponding sukun",
        "duration": "2 counts",
        "example": "قَالَ — elongate the alif for 2 counts",
        "color": "#3b82f6"
      },
      {
        "id": "madd_necessary",
        "name": "Madd Lazim (مَدّ لَزِم)",
        "description": "Forced elongation when a madd letter is followed by a shadda",
        "duration": "6 counts",
        "example": "الْحَآئِرِينَ — elongate for 6 counts",
        "color": "#ef4444"
      }
    ],
    "color": "#3b82f6"
  },
  {
    "id": "noon_saakin",
    "name": "Noon Saakin and Tanween (نُون سَاكِنَة وتَنْوِين)",
    "description": "Rules for when noon with sukun or tanween appears",
    "subcategories": [
      {
        "id": "idgham_with_ghunnah",
        "name": "Idgham with Ghunnah (إِدْغَام بِغُنَّة)",
        "description": "When noon saakin is followed by ي، ر، م، ل، و، ن",
        "duration": "2 counts ghunnah",
        "example": "مِنْ يَوْمِ — noon merges into yaa with nasalization",
        "color": "#22c55e"
      },
      {
        "id": "iqra",
        "name": "Iqlab (إِقْلَاب)",
        "description": "When noon saakin is followed by ب",
        "duration": "2 counts",
        "example": "مِن بَعْدِ — noon changes to meem sound",
        "color": "#f59e0b"
      },
      {
        "id": "izhar",
        "name": "Izhar (إِظْهَار)",
        "description": "Clear pronunciation of noon when followed by throat letters",
        "duration": "1 count",
        "example": "مِنْ أَنسَانٍ — noon pronounced clearly",
        "color": "#8b5cf6"
      }
    ]
  },
  {
    "id": "meem_saakin",
    "name": "Meem Saakin (مِيم سَاكِنَة)",
    "description": "Rules for meem with sukun",
    "subcategories": [
      {
        "id": "ikhfa_shafawi",
        "name": "Ikhfa Shafawi (إِخْفَاء شَفَوِيّ)",
        "description": "When meem saakin is followed by ب",
        "duration": "2 counts",
        "example": "تَرْمِيهِم بِحِجَارَة — meem merges with slight nasalization",
        "color": "#06b6d4"
      },
      {
        "id": "idgham_shafawi",
        "name": "Idgham Shafawi (إِدْغَام شَفَوِيّ)",
        "description": "When meem saakin is followed by م",
        "duration": "2 counts idgham",
        "example": "لَّهُم مَّا — meem merges into following meem",
        "color": "#a855f7"
      }
    ]
  }
]
```

### `scripts/seed-db.ts` — Database Seeding Script
```typescript
// Seeds D1 database with all content data
// Run: npx tsx scripts/seed-db.ts

import { Database } from '../workers/src/lib/db';

async function seedDatabase(db: Database) {
  console.log('🌱 Seeding database...');

  // 1. Create default user
  const userId = crypto.randomUUID();
  await db.run(
    `INSERT OR IGNORE INTO users (id, goal, onboarding_completed, current_path) VALUES (?, ?, ?, ?)`,
    [userId, 'all', 0, 'path1']
  );
  console.log(`✅ Created user: ${userId}`);

  // 2. Seed vocabulary
  const vocabulary = JSON.parse(await readFile('content/vocabulary.json'));
  for (const word of vocabulary) {
    await db.run(
      `INSERT OR IGNORE INTO vocabulary_mastery (word, user_id, meaning_known, reading_known) VALUES (?, ?, 0, 0)`,
      [word.word, userId]
    );
  }
  console.log(`✅ Seeded ${vocabulary.length} vocabulary words`);

  // 3. Seed grammar lessons
  const lessons = JSON.parse(await readFile('content/grammar/lessons.json'));
  for (const lesson of lessons) {
    await db.run(
      `INSERT OR IGNORE INTO lessons (id, title, module, level, content, exercises, prerequisites, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lesson.id,
        lesson.title,
        lesson.module,
        lesson.level,
        JSON.stringify(lesson.content),
        JSON.stringify(lesson.exercises),
        JSON.stringify(lesson.prerequisites || []),
        lesson.estimated_minutes
      ]
    );
  }
  console.log(`✅ Seeded ${lessons.length} grammar lessons`);

  // 4. Seed assessment questions
  const assessment = JSON.parse(await readFile('content/assessments/placement-test.json'));
  // Store assessment as a single JSON blob in KV (not D1, since it's static)
  // This is handled by the workers route

  console.log('🎉 Database seeding complete!');
  return userId;
}

// Helper to read files
async function readFile(path: string): Promise<string> {
  return await Deno.readTextFile(path);
}

// Main execution
const db = new Database(Deno.env.get('D1_DB')!);
const userId = await seedDatabase(db);
console.log(`\nUser ID: ${userId}`);
console.log(`Set this as your D1 binding in wrangler.toml`);
```

### `workers/src/lib/quran.ts` — Quran API Integration
```typescript
// Fetches Quran data from external APIs
// Data is cached in Cloudflare KV for performance

const KV_CACHE_TTL = 3600; // 1 hour cache
const TANZIL_BASE = 'https://download.tanzil.net';
const QURAN_COM_BASE = 'https://api.quran.com/api/v4';

export class QuranService {
  constructor(private kv: KVNamespace) {}

  // Get all verses with translation (cached)
  async getVerses(surah?: number, translation?: string): Promise<QuranVerse[]> {
    const cacheKey = `verses:${surah || 'all'}:${translation || 'en'}`;
    const cached = await this.kv.get(cacheKey, { type: 'json' });
    if (cached) return cached;

    // Fetch from Tanzil.net (Uthmani script)
    const data = await this.fetchTanzil(surah);

    // Cache for 1 hour
    await this.kv.put(cacheKey, JSON.stringify(data), { expirationTtl: KV_CACHE_TTL });
    return data;
  }

  // Get audio URL for specific verse
  getAudioUrl(surah: number, ayah: number, reciter: string = 'alafasy'): string {
    return `https://cdn.islamic.network/quran/audio/128/${reciter}/${(surah * 10000 + ayah).toString().padStart(6, '0')}.mp3`;
  }

  // Fetch from Tanzil.net
  private async fetchTanzil(surah?: number): Promise<any[]> {
    const url = surah
      ? `${TANZIL_BASE}/quran-${surah}.uthmani.json`
      : `${TANZIL_BASE}/quran-all.uthmani.json`;

    const response = await fetch(url);
    return response.json();
  }
}
```

## Setup Commands

```bash
# 1. Create content directory structure
mkdir -p content/vocabulary content/grammar content/assessments

# 2. Download Quran data (first time)
npx tsx scripts/export-quran.ts

# 3. Seed the database with all content
npx tsx scripts/seed-db.ts

# 4. Verify seeding worked
wrangler d1 execute languagebuilder --command="SELECT COUNT(*) FROM vocabulary_mastery"
wrangler d1 execute languagebuilder --command="SELECT COUNT(*) FROM lessons"
```

## Verification Checklist
- [ ] `content/vocabulary.json` contains 1000+ words
- [ ] `content/grammar/lessons.json` contains 30+ lessons
- [ ] `content/assessments/placement-test.json` contains 60+ questions
- [ ] `content/tajweed-rules.json` contains all major rules
- [ ] `scripts/seed-db.ts` runs without errors
- [ ] Database tables have correct record counts after seeding
- [ ] Quran API integration returns valid verse data
- [ ] Audio URLs follow correct pattern for Quran.com

## What's NOT in This Module
- Assessment scoring algorithm (Module 2)
- Learning path logic (Module 2)
- Any interactive features (Module 3+)
- Spaced repetition scheduling (Module 4)

## Next Module
**Module 2: Assessment Engine** — Uses the seeded data to create the 4-module diagnostic test, scoring algorithm, and adaptive learning path generation.
