#!/usr/bin/env node
// Every exercise kind the UI can display must have a human label.
//
// KIND_LABELS drifted to 7 while the bank grew to 17, so ten kinds rendered as raw
// column values on /progress. gen-content-manifest gates the exercise TOTAL but not
// the kind list, so nothing caught it.
//
// Source of truth is ExerciseRunner's KINDS array: it is the filter the learner picks
// from, so any kind selectable there must be nameable on /progress.

import { readFileSync } from 'node:fs';

const RUNNER = 'src/app/components/grammar/ExerciseRunner.tsx';
const PROGRESS = 'src/app/app/progress/page.tsx';

const runner = readFileSync(RUNNER, 'utf-8');
const progress = readFileSync(PROGRESS, 'utf-8');

const kinds = [...runner.matchAll(/\{\s*value:\s*'([a-z_]+)'/g)]
  .map((m) => m[1])
  .filter((k) => k.length > 0);

// Scoped to the KIND_LABELS block rather than the whole file. A loose scan for
// `  key: '` would also pick up any other 2-space-indented object literal, and would
// break the moment someone reformatted the map.
const block = progress.match(/const KIND_LABELS[^=]*=\s*\{(.*?)\n\};/s);
if (!block) {
  console.error(`✗ could not find the KIND_LABELS map in ${PROGRESS}`);
  process.exit(1);
}
const labelled = new Set([...block[1].matchAll(/([a-z_]+)\s*:\s*['"]/g)].map((m) => m[1]));

const missing = kinds.filter((k) => !labelled.has(k));

if (kinds.length === 0) {
  console.error(`✗ parsed no kinds from ${RUNNER} — the regex or the file shape changed`);
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`✗ ${missing.length} exercise kind(s) have no label in ${PROGRESS}:`);
  for (const k of missing) console.error(`    ${k}`);
  console.error('  These render as raw database enums on the progress screen.');
  process.exit(1);
}

console.log(`✅ all ${kinds.length} exercise kinds have labels`);
