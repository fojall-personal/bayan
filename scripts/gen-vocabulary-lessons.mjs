#!/usr/bin/env node
/**
 * Generate vocabulary-lessons.json from core-100.json with real Quran verse
 * examples pulled from quran_word_gloss + quran_verses.
 *
 *   node scripts/gen-vocabulary-lessons.mjs
 *
 * Each lesson includes:
 *   - 5 multiple-choice exercises (existing)
 *   - Root-family context
 *   - 2-3 verse examples with Arabic text, translation, and reference
 *
 * The script connects to the local D1 database via node:sqlite (sync API),
 * falling back to no verse examples if the DB is not available.
 *
 * Usage:
 *   node scripts/gen-vocabulary-lessons.mjs              # with local DB
 *   node scripts/gen-vocabulary-lessons.mjs --no-db      # without DB
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const log = (m) => process.stderr.write(m + '\n');

const coreVocab = JSON.parse(
  await readFile(join(root, 'content/vocabulary/core-100.json'), 'utf-8')
);

if (!Array.isArray(coreVocab) || coreVocab.length === 0) {
  log('core-100.json is empty or not an array');
  process.exit(1);
}

/* -- connect to local D1 if available ---------------------------------- */

const args = process.argv.slice(2);
const noDb = args.includes('--no-db');
let db = null;

if (!noDb) {
  const dbPath = join(root, 'workers/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/e29f3a016a0c66c7fb66a3847c6c1dae68f843e69c82e0414e01c0d266fa4df5.sqlite');
  try {
    db = new DatabaseSync(dbPath, { readonly: true });
    log('Connected to local D1 database');
  } catch (err) {
    log(`\u26a0 Could not open local D1 database: ${err.message}`);
    log('  Verse examples will be skipped. Use --no-db to silence this.');
    db = null;
  }
}

/* -- query verse examples for a word ----------------------------------- */

function getVerseExamples(word, limit = 3) {
  if (!db) return [];

  const examples = [];

  try {
    // Find occurrences of this word in quran_word_gloss
    const glossStmt = db.prepare(`
      SELECT surah_id, ayah_id, position, english
      FROM quran_word_gloss
      WHERE arabic = ?
      LIMIT ?
    `);

    const rows = glossStmt.all(word, limit * 2);

    // Deduplicate by surah/ayah
    const seen = new Set();
    for (const row of rows) {
      const key = `${row.surah_id}:${row.ayah_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Get the full verse
      const verseStmt = db.prepare(`
        SELECT surah, ayah, text_uthmani, translation
        FROM quran_verses
        WHERE surah = ? AND ayah = ?
      `);

      const verse = verseStmt.get(row.surah_id, row.ayah_id);
      if (verse && verse.text_uthmani) {
        examples.push({
          arabic: verse.text_uthmani,
          translation: verse.translation || '',
          reference: `${row.surah_id}:${row.ayah_id}`,
        });

        if (examples.length >= limit) break;
      }
    }
  } catch (err) {
    log(`  \u26a0 Error querying examples for "${word}": ${err.message}`);
  }

  return examples.slice(0, limit);
}

/* -- generate exercises (existing logic) ------------------------------- */

function generateExercises(wordEntry, allWords) {
  const exercises = [];
  const { word, meaning, transliteration, root: wordRoot, part_of_speech } = wordEntry;

  // Get other words for distractors
  const otherWords = allWords
    .filter(w => w.word !== word)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  // Exercise 1: Meaning recall
  const distractorMeanings = otherWords.map(w => w.meaning);
  const options1 = [meaning, ...distractorMeanings].sort(() => Math.random() - 0.5);
  exercises.push({
    type: 'multiple_choice',
    question: `What does "${word}" (${transliteration}) mean?`,
    options: options1,
    answer: options1.indexOf(meaning),
    explanation: `"${word}" (${transliteration}) means "${meaning}". It is a ${part_of_speech} that appears ${wordEntry.quran_occurrences || 'frequently'} times in the Quran.`
  });

  // Exercise 2: Word identification from meaning
  const distractorWords = otherWords.map(w => w.word);
  const options2 = [word, ...distractorWords].sort(() => Math.random() - 0.5);
  exercises.push({
    type: 'multiple_choice',
    question: `Which Arabic word means "${meaning}"?`,
    options: options2,
    answer: options2.indexOf(word),
    explanation: `"${word}" is the Arabic word for "${meaning}". The transliteration is "${transliteration}".`
  });

  // Exercise 3: Root identification OR word component analysis
  if (wordRoot) {
    const otherRoots = [...new Set(allWords.filter(w => w.root).map(w => w.root))]
      .filter(r => r !== wordRoot)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const rootOptions = [wordRoot, ...otherRoots].sort(() => Math.random() - 0.5);
    exercises.push({
      type: 'multiple_choice',
      question: `What is the root of "${word}"?`,
      options: rootOptions,
      answer: rootOptions.indexOf(wordRoot),
      explanation: `"${word}" comes from the root ${wordRoot}. Words from this root share a common semantic field.`
    });
  } else {
    exercises.push({
      type: 'multiple_choice',
      question: `"${word}" is best described as:`,
      options: ['A preposition', 'A noun', 'A verb', 'A pronoun'],
      answer: part_of_speech === 'preposition' ? 0 : part_of_speech === 'noun' ? 1 : part_of_speech === 'verb' ? 2 : 3,
      explanation: `"${word}" is a ${part_of_speech}. It functions as a ${part_of_speech} in Arabic grammar.`
    });
  }

  // Exercise 4: Part of speech
  const posOptions = ['noun', 'verb', 'preposition', 'pronoun', 'adjective'].sort(() => Math.random() - 0.5);
  const posDistractors = posOptions.filter(p => p !== part_of_speech).slice(0, 3);
  const posChoices = [part_of_speech, ...posDistractors].sort(() => Math.random() - 0.5);
  exercises.push({
    type: 'multiple_choice',
    question: `What part of speech is "${word}"?`,
    options: posChoices,
    answer: posChoices.indexOf(part_of_speech),
    explanation: `"${word}" is a ${part_of_speech}. It functions as a ${part_of_speech} in Arabic grammar.`
  });

  // Exercise 5: Frequency understanding
  const freqRank = wordEntry.frequency_rank;
  exercises.push({
    type: 'multiple_choice',
    question: `"${word}" is ranked #${freqRank} in Quranic frequency. This means it is:`,
    options: [
      `Among the most common words in the Quran`,
      `A rare word that appears only a few times`,
      `Only found in one surah`,
      `Not actually in the Quran`
    ],
    answer: 0,
    explanation: `With a frequency rank of ${freqRank}, "${word}" is among the most common words in the Quran, appearing ${wordEntry.quran_occurrences || 'many'} times.`
  });

  return exercises;
}

/* -- generate lessons -------------------------------------------------- */

const lessons = [];
let examplesFound = 0;

for (let i = 0; i < coreVocab.length; i++) {
  const entry = coreVocab[i];
  const exercises = generateExercises(entry, coreVocab);

  // Get verse examples
  const examples = getVerseExamples(entry.word, 3);
  if (examples.length > 0) examplesFound++;

  lessons.push({
    id: `vocab-${String(i + 1).padStart(3, '0')}`,
    title: `${entry.word} (${entry.transliteration}) — ${entry.meaning}`,
    category: 'vocabulary',
    content: {
      root: entry.word,
      meaning: entry.meaning,
      transliteration: entry.transliteration,
      part_of_speech: entry.part_of_speech,
      frequency_rank: entry.frequency_rank,
      quran_occurrences: entry.quran_occurrences,
      notes: entry.part_of_speech === 'preposition' 
        ? 'Prepositions in Arabic often carry important grammatical and semantic weight.'
        : entry.part_of_speech === 'noun'
        ? 'Nouns in Arabic can be definite or indefinite, masculine or feminine.'
        : '',
      examples,
    },
    exercises
  });

  if ((i + 1) % 10 === 0 || i === coreVocab.length - 1) {
    process.stderr.write(`  generated ${i + 1}/${coreVocab.length}\n`);
  }
}

await writeFile(
  join(root, 'content/grammar/vocabulary-lessons.json'),
  JSON.stringify(lessons, null, 2),
  'utf-8'
);

log(`\n\u2705 Generated ${lessons.length} vocabulary lessons`);
log(`   Each lesson has ${lessons[0].exercises.length} exercises`);
log(`   ${examplesFound} lessons have verse examples`);
log(`   ${lessons.length - examplesFound} lessons have no verse examples (DB empty or word not found)`);

if (db) {
  db.close();
}
