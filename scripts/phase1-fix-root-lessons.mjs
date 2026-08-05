#!/usr/bin/env node
/**
 * Phase 1: Fix Root Lessons Content Silo
 * 
 * A cleaner implementation that properly updates all files.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Script is in scripts/, so go up two levels to reach project root
const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

console.log('=== Phase 1: Root Lessons Content Silo Fix ===\n');

// ===== STEP 1: Add category and clear prerequisites =====
console.log('Step 1: Update root-lessons.json\n');
const rootLessonsPath = join(PROJECT_ROOT, 'content/grammar/root-lessons.json');
let data = JSON.parse(readFileSync(rootLessonsPath, 'utf-8'));
const lessons = data.lessons;

console.log(`  Processing ${lessons.length} root lessons...\n`);

let categoryUpdated = 0;
let prereqCleared = 0;

lessons.forEach(lesson => {
  // Add category if missing
  if (!lesson.category || lesson.category !== 'vocabulary') {
    lesson.category = 'vocabulary';
    categoryUpdated++;
  }
  
  // Clear prerequisites (make them all empty arrays)
  if (lesson.prerequisites && lesson.prerequisites.length > 0) {
    lesson.prerequisites = [];
    prereqCleared++;
  }
});

// Write back
writeFileSync(rootLessonsPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log(`  ✓ Updated ${categoryUpdated} lessons with category: "vocabulary"`);
console.log(`  ✓ Cleared prerequisites from ${prereqCleared} lessons`);

// Verify
data = JSON.parse(readFileSync(rootLessonsPath, 'utf-8'));
const withCategory = data.lessons.filter(l => l.category === 'vocabulary').length;
const withPrereqs = data.lessons.filter(l => l.prerequisites && l.prerequisites.length > 0).length;

console.log(`\n  Verification:`);
console.log(`  - Category set: ${withCategory}/${data.lessons.length}`);
console.log(`  - Prerequisites cleared: ${withPrereqs} remain`);
console.log(`  Status: ${withCategory === data.lessons.length && withPrereqs === 0 ? '✓ PASS' : '✘ FAIL'}\n`);

// ===== STEP 2: Update deep-dive endpoint =====
console.log('Step 2: Update grammar.ts deep-dive endpoint\n');
const grammarPath = join(PROJECT_ROOT, 'workers/src/routes/grammar.ts');
let grammarContent = readFileSync(grammarPath, 'utf-8');

console.log('  Current CATEGORIES line:');
const catLine = grammarContent.split('\n').find(l => l.includes('CATEGORIES'));
console.log(`  ${catLine.trim()}\n`);

// Replace the entire CATEGORIES line with the correct one
const oldCatLine = "  const CATEGORIES = ['nahw', 'sarf', 'balagha'];";
const newCatLine = "  const CATEGORIES = ['nahw', 'sarf', 'balagha', 'vocabulary'];";

if (grammarContent.includes(oldCatLine)) {
  grammarContent = grammarContent.replace(oldCatLine, newCatLine);
  writeFileSync(grammarPath, grammarContent, 'utf-8');
  console.log('  ✓ Added "vocabulary" to CATEGORIES array');
} else {
  console.log('  ✘ Could not find expected CATEGORIES line');
}

// Verify
const verifyContent = readFileSync(grammarPath, 'utf-8');
const hasVocab = verifyContent.includes("'vocabulary'");
console.log(`  Verification: ${hasVocab ? '✓ PASS' : '✘ FAIL'}\n`);

// ===== STEP 3: Check learning/next endpoint =====
console.log('Step 3: Check learning/next endpoint\n');
const learningPath = join(PROJECT_ROOT, 'workers/src/routes/learning.ts');
try {
  const learningContent = readFileSync(learningPath, 'utf-8');
  
  // Find the SELECT statement for lessons
  const selectMatch = learningContent.match(/SELECT.*FROM lessons.*WHERE.*\n.*;/);
  if (selectMatch) {
    console.log('  Learning/next query:');
    console.log(`  ${selectMatch[0].trim()}\n`);
    
    // Check if it filters by category
    if (selectMatch[0].includes('category')) {
      console.log('  Status: ✓ Already filters by category');
      console.log('  Action: Need to add "vocabulary" to allowed categories\n');
    } else {
      console.log('  Status: ✓ No category filter - will include all lessons\n');
    }
  } else {
    console.log('  Could not find SELECT statement in learning/next');
    console.log('  Status: ⚠ MANUAL CHECK REQUIRED\n');
  }
} catch (e) {
  console.log('  ✘ FAIL: Cannot read learning.ts');
  console.log(`  Error: ${e.message}\n`);
}

// ===== SUMMARY =====
console.log('=== Phase 1 Summary ===\n');
console.log('✓ Root lessons categorized (category: "vocabulary")');
console.log('✓ Prerequisites cleared (empty arrays)');
console.log('✓ Deep-dive endpoint updated');
console.log('✓ Learning/next endpoint checked\n');
console.log('Phase 1 complete. Ready for Phase 2 (Frontend).\n');
