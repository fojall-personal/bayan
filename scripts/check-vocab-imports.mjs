#!/usr/bin/env node
/**
 * Verify that the vocabulary components are actually wired into the grammar page.
 *
 *   node scripts/check-vocab-imports.mjs
 *
 * Catches the bug where you build a component but forget to import it,
 * leaving it as dead code that nobody ever sees.
 */

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const GRAMMAR_PAGE = join(root, 'src/app/app/grammar/page.tsx');
const VOCAB_DIR = join(root, 'src/app/components/vocabulary');
const DEEPDIVE_VIEW = join(root, 'src/app/components/grammar/DeepDiveView.tsx');

// 1. Check that the grammar page imports the vocabulary view
const grammarPage = await readFile(GRAMMAR_PAGE, 'utf-8');

if (!grammarPage.includes('VocabularyView')) {
  fail('src/app/app/grammar/page.tsx', 'does not import or render VocabularyView');
}

if (!grammarPage.includes("from '@/components/vocabulary/VocabularyView'")) {
  fail('src/app/app/grammar/page.tsx', 'does not import from ./components/vocabulary/VocabularyView');
}

// 2. Check that the vocabulary components exist
const expectedComponents = ['VocabularyView.tsx', 'RootCard.tsx', 'RootFamilyDetail.tsx'];
for (const comp of expectedComponents) {
  const compPath = join(VOCAB_DIR, comp);
  if (!(await fileExists(compPath))) {
    fail(`src/app/components/vocabulary/${comp}`, 'does not exist');
  }
}

// 3. Check that EMPTY_REASON has a 'vocabulary' entry
const deepdive = await readFile(DEEPDIVE_VIEW, 'utf-8');

// Extract the EMPTY_REASON object
const emptyReasonMatch = deepdive.match(/const EMPTY_REASON[^}]+}/s);
if (!emptyReasonMatch) {
  fail('DeepDiveView.tsx', 'cannot find EMPTY_REASON object');
} else {
  const emptyReasonBlock = emptyReasonMatch[0];
  if (!emptyReasonBlock.includes("'vocabulary'") && !emptyReasonBlock.includes('"vocabulary"')) {
    fail('DeepDiveView.tsx', 'EMPTY_REASON is missing the "vocabulary" key');
  }
}

// 4. Check that the vocabulary tab is actually rendered (not just defined)
if (!grammarPage.includes("view === 'vocabulary'")) {
  fail('src/app/app/grammar/page.tsx', 'does not render vocabulary view when tab is selected');
}

// Report
if (problems.length > 0) {
  console.error(`Found ${problems.length} problem(s):`);
  for (const p of problems) {
    console.error(`  ✘ ${p}`);
  }
  process.exit(1);
}

console.log('✅ Vocabulary components are properly wired into the grammar page');
process.exit(0);

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
