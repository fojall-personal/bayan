#!/usr/bin/env node
/**
 * Add "category": "vocabulary" to all root lessons in root-lessons.json.
 *
 * This is a surgical fix — the deep-dive endpoint filters by category,
 * so without this field, 408 lessons are invisible to users.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const OUT = join(root, '..', 'content/grammar/root-lessons.json');

const raw = readFileSync(OUT, 'utf-8');
const data = JSON.parse(raw);
const lessons = data.lessons;

let updated = 0;
lessons.forEach((lesson) => {
  if (lesson.category !== 'vocabulary') {
    lesson.category = 'vocabulary';
    updated++;
  }
});

writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log(`Updated ${updated} of ${lessons.length} root lessons with category: "vocabulary"`);
