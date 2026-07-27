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

const lessons = [...(Array.isArray(authored) ? authored : authored.lessons), ...generated];

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
// Stable key order, so an unrelated reordering in the JSON cannot produce a diff.
const json = (v) => JSON.stringify(v);

const lines = [
  '-- Generated from content/grammar/lessons.json — do not edit by hand.',
  '-- Regenerate with: node scripts/gen-lessons-sql.mjs',
];

for (const l of lessons) {
  for (const field of ['id', 'title', 'module', 'level', 'content']) {
    if (l[field] === undefined) {
      process.stderr.write(`✘ lesson ${l.id ?? '(no id)'} is missing "${field}"\n`);
      process.exit(1);
    }
  }
  lines.push(
    'INSERT OR REPLACE INTO lessons (id, title, module, level, content, ' +
      'exercises, prerequisites, estimated_minutes) VALUES (' +
      [
        q(l.id),
        q(l.title),
        q(l.module),
        Number(l.level),
        q(json(l.content)),
        q(json(l.exercises ?? [])),
        q(json(l.prerequisites ?? [])),
        Number(l.estimated_minutes ?? 15),
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
