#!/usr/bin/env node
/**
 * Turn content/grammar/lessons.json into scripts/seed-lessons.sql.
 *
 *   node scripts/gen-lessons-sql.mjs            # write the file
 *   node scripts/gen-lessons-sql.mjs --check    # fail if it is out of date
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * seed-lessons.sql was hand-produced. So editing lessons.json changed the file
 * the content gate reads and left the file the database is seeded from untouched
 * — a silent drift with no diff and no error, where the gate reports green on
 * content the app never serves. Exactly the shape of the Pages-bindings problem:
 * the authority lived in one place and the deployed truth in another.
 *
 * --check is what CI runs, so a lessons.json edit that forgets to regenerate is
 * a red build rather than a surprise in production.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const authored = JSON.parse(
  await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8')
);
let literacy = [];
try {
  literacy = JSON.parse(await readFile(join(root, 'content/literacy/lessons.json'), 'utf-8'));
  if (!Array.isArray(literacy)) literacy = [];
} catch {
  literacy = [];
}
/**
 * Generated root-family lessons, appended after the authored ten.
 *
 * Kept in a separate file so the two stay tellable apart — 60 corpus-derived lessons
 * would otherwise bury the 10 hand-written ones, and the pedagogy gate, the review
 * document and anyone reading the content all need to know which is which. Seeded into
 * the same table because a lesson is a lesson to the learner.
 */
const generated = JSON.parse(
  await readFile(join(root, 'content/grammar/root-lessons.json'), 'utf-8')
).lessons;

const authoredList = Array.isArray(authored) ? authored : authored.lessons;
const authoredIds = new Set(authoredList.map((l) => l.id));
const lessons = [...literacy, ...authoredList, ...generated];

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
// Stable key order, so an unrelated reordering in the JSON cannot produce a diff.
const json = (v) => JSON.stringify(v);

const lines = [
  '-- Generated from content/grammar/lessons.json — do not edit by hand.',
  '-- Regenerate with: node scripts/gen-lessons-sql.mjs',
];

/**
 * The three classical disciplines, and which lessons belong to which.
 *
 * `category` is required on authored lessons and absent from generated root lessons,
 * which is the honest split: a root lesson teaches vocabulary in a root family, not
 * grammar, and serving 408 of them under a Syntax heading is what made the deep-dive
 * payload 823 KB. NULL there means "not one of the three disciplines".
 *
 * Required rather than defaulted, because a silent default is how all three tabs came to
 * show the same thing. A new authored lesson must state which discipline it teaches.
 */
const CATEGORIES = new Set(['nahw', 'sarf', 'balagha']);

for (const l of lessons) {
  for (const field of ['id', 'title', 'module', 'level', 'content']) {
    if (l[field] === undefined) {
      process.stderr.write(`✘ lesson ${l.id ?? '(no id)'} is missing "${field}"\n`);
      process.exit(1);
    }
  }
  // Required of authored lessons, forbidden of generated ones — checked in both
  // directions, because "missing" and "wrongly present" are equally silent at runtime:
  // one hides a lesson from every tab, the other puts a vocabulary lesson under a
  // grammar heading, which is how the payload reached 823 KB.
  const isAuthored = authoredIds.has(l.id);
  if (l.module === 'literacy') {
    /* literacy rows are not nahw/sarf/balagha */
  } else if (isAuthored && !CATEGORIES.has(l.category)) {
    process.stderr.write(
      `✘ authored lesson ${l.id} has category "${l.category}" — must be nahw, sarf or balagha\n`
    );
    process.exit(1);
  }
  if (!isAuthored && l.category !== undefined && l.category !== 'vocabulary') {
    process.stderr.write(
      `✘ generated lesson ${l.id} carries category "${l.category}" — root lessons may only carry \"vocabulary\"\n`
    );
    process.exit(1);
  }
  lines.push(
    'INSERT OR REPLACE INTO lessons (id, title, module, level, content, ' +
      'exercises, prerequisites, estimated_minutes, category) VALUES (' +
      [
        q(l.id),
        q(l.title),
        q(l.module),
        Number(l.level),
        q(json(l.content)),
        q(json(l.exercises ?? [])),
        q(json(l.prerequisites ?? [])),
        Number(l.estimated_minutes ?? 15),
        l.category === undefined ? 'NULL' : q(l.category),
      ].join(', ') +
      ');'
  );
}

const sql = `${lines.join('\n')}\n`;
const target = join(root, 'scripts/seed-lessons.sql');

if (check) {
  let current = null;
  try {
    current = await readFile(target, 'utf-8');
  } catch {
    /* missing counts as out of date */
  }
  if (current !== sql) {
    process.stderr.write(
      '✘ scripts/seed-lessons.sql is out of date with content/grammar/lessons.json.\n' +
        '  Run: node scripts/gen-lessons-sql.mjs\n'
    );
    process.exit(1);
  }
  process.stdout.write(`✅ seed-lessons.sql matches lessons.json (${lessons.length} lessons)\n`);
  process.exit(0);
}

await writeFile(target, sql, 'utf-8');
process.stdout.write(`wrote scripts/seed-lessons.sql — ${lessons.length} lessons\n`);
