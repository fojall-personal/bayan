#!/usr/bin/env node
/**
 * Validate the vocabulary lessons content.
 *
 *   node scripts/check-vocab-lessons.mjs
 *
 * Checks that content/grammar/vocabulary-lessons.json is structurally sound:
 * - exactly 103 lessons
 * - each has required fields (id, title, category, content, exercises)
 * - each exercise has a valid answer index
 * - no duplicate IDs
 * - roots reference real words in core-100.json
 * - Arabic examples contain Arabic text
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const ARABIC = /[؀-ۿ]/;

const coreVocab = JSON.parse(
  await readFile(join(root, 'content/vocabulary/core-100.json'), 'utf-8')
);
const coreVocabMap = new Map(coreVocab.map((v) => [v.word, v]));

const lessons = JSON.parse(
  await readFile(join(root, 'content/grammar/vocabulary-lessons.json'), 'utf-8')
);

if (!Array.isArray(lessons)) {
  fail('vocabulary-lessons.json', 'expected a top-level array');
  process.exit(1);
}

if (lessons.length !== 103) {
  fail('vocabulary-lessons.json', `expected 103 lessons, got ${lessons.length}`);
}

const seenIds = new Set();

for (const [i, lesson] of lessons.entries()) {
  const where = `lesson[${i}] ${lesson.id ?? '(no id)'}`;

  // Required top-level fields
  for (const field of ['id', 'title', 'category', 'content', 'exercises']) {
    if (lesson[field] === undefined) {
      fail(where, `missing "${field}"`);
    }
  }

  if (lesson.category !== 'vocabulary') {
    fail(where, `category is "${lesson.category}", expected "vocabulary"`);
  }

  if (!lesson.id || seenIds.has(lesson.id)) {
    fail(where, `duplicate or missing id`);
  }
  if (lesson.id) seenIds.add(lesson.id);

  // Content validation
  const content = lesson.content;
  if (content) {
    if (!content.root) fail(where, 'content.root is missing');
    if (!content.meaning) fail(where, 'content.meaning is missing');
    if (!content.transliteration) fail(where, 'content.transliteration is missing');

    // Root should match a word in core-100.json
    if (content.root && !coreVocabMap.has(content.root)) {
      fail(where, `root "${content.root}" not found in core-100.json`);
    }

    // Examples should contain Arabic
    for (const [j, ex] of (content.examples ?? []).entries()) {
      const exWhere = `${where}.content.examples[${j}]`;
      if (!ex.arabic) fail(exWhere, 'missing arabic text');
      if (ex.arabic && !ARABIC.test(ex.arabic)) {
        fail(exWhere, `arabic text "${ex.arabic}" contains no Arabic characters`);
      }
      if (!ex.translation) fail(exWhere, 'missing translation');
    }
  }

  // Exercises validation
  const exercises = lesson.exercises ?? [];
  if (!Array.isArray(exercises)) {
    fail(where, 'exercises is not an array');
    continue;
  }

  if (exercises.length < 5) {
    fail(where, `expected at least 5 exercises, got ${exercises.length}`);
  }

  for (const [j, ex] of exercises.entries()) {
    const exWhere = `${where}.exercises[${j}]`;

    if (!ex.type) fail(exWhere, 'missing type');
    if (!ex.prompt && !ex.question) fail(exWhere, 'missing prompt/question');

    if (ex.type === 'multiple_choice') {
      if (!Array.isArray(ex.options)) {
        fail(exWhere, 'options is not an array');
        continue;
      }

      if (ex.options.length < 2) {
        fail(exWhere, `expected at least 2 options, got ${ex.options.length}`);
      }

      // Answer should be a valid index
      if (typeof ex.answer === 'number') {
        if (ex.answer < 0 || ex.answer >= ex.options.length) {
          fail(exWhere, `answer index ${ex.answer} is out of bounds for ${ex.options.length} options`);
        }
      }

      // Options should be unique
      if (new Set(ex.options).size !== ex.options.length) {
        fail(exWhere, 'duplicate options');
      }

      // Each option should be a string
      for (const [k, opt] of ex.options.entries()) {
        if (typeof opt !== 'string') {
          fail(`${exWhere}.options[${k}]`, 'option is not a string');
        }
      }
    }

    if (!ex.explanation) {
      fail(exWhere, 'missing explanation');
    }
  }
}

// Report
if (problems.length > 0) {
  console.error(`Found ${problems.length} problem(s):`);
  for (const p of problems) {
    console.error(`  ✘ ${p}`);
  }
  process.exit(1);
}

console.log(`✅ Vocabulary lessons valid: ${lessons.length} lessons, all checks passed`);
process.exit(0);
