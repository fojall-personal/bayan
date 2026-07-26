#!/usr/bin/env node
/**
 * Check that the learning path can actually be walked.
 *
 *   node scripts/check-pedagogy.mjs
 *
 * ── Why ─────────────────────────────────────────────────────────────────────
 *
 * check-content.mjs asks whether each lesson is *true*. This asks whether the
 * course *works*, which is a different question and had a worse answer: four of
 * ten lessons were permanently unreachable.
 *
 * grammar-02's only exercise was a `match`, and the grader excludes `match` from
 * the denominator because there is no matching implementation. So it scored 0,
 * never met the 70% completion bar, and never completed — while grammar-04 listed
 * it as a prerequisite, and grammar-08 and grammar-10 depend on grammar-04 in
 * turn. Every individual piece was correct. The composition was a dead end, and
 * nothing looked at the composition.
 *
 * These are structural properties, decidable from the content plus two constants
 * the server owns (the pass mark and which exercise types can be graded). Whether
 * an explanation actually teaches is not decidable here and is not attempted.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Must match workers/src/routes/learning.ts. `match` is excluded there, so a
 * lesson whose exercises are all `match` is ungradable by construction.
 */
const GRADABLE = new Set([
  'multiple_choice', 'fill_blank', 'translation', 'pattern_recognition', 'audio_repeat',
]);
const PASS_MARK = 70;
/**
 * At a 70% pass mark, one gradable exercise is all-or-nothing: a single wrong
 * answer scores 0 and fails the lesson. Two is the minimum at which partial
 * credit means anything.
 */
const MIN_GRADABLE = 2;

const problems = [];
const notes = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

const lessons = JSON.parse(
  await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8')
);
const byId = new Map(lessons.map((l) => [l.id, l]));

// ── 1. Prerequisite integrity ───────────────────────────────────────────────
for (const l of lessons) {
  const where = `grammar/${l.id}`;
  for (const p of l.prerequisites ?? []) {
    if (!byId.has(p)) {
      fail(where, `prerequisite "${p}" does not exist`);
      continue;
    }
    // A lesson may not depend on something harder than itself, or the ramp runs
    // backwards: the learner is sent to a level-3 lesson to unlock a level-2 one.
    const pre = byId.get(p);
    if ((pre.level ?? 0) > (l.level ?? 0)) {
      fail(
        where,
        `is level ${l.level} but depends on ${p}, which is level ${pre.level} — ` +
          'the ramp runs backwards'
      );
    }
  }
}

// Cycles, via depth-first search. A cycle makes every lesson in it unreachable
// while each one looks individually fine.
const WHITE = 0, GREY = 1, BLACK = 2;
const colour = new Map(lessons.map((l) => [l.id, WHITE]));
function visit(id, stack) {
  if (colour.get(id) === GREY) {
    fail('grammar', `prerequisite cycle: ${[...stack, id].join(' → ')}`);
    return;
  }
  if (colour.get(id) === BLACK) return;
  colour.set(id, GREY);
  for (const p of byId.get(id)?.prerequisites ?? []) {
    if (byId.has(p)) visit(p, [...stack, id]);
  }
  colour.set(id, BLACK);
}
for (const l of lessons) visit(l.id, []);

// ── 2. Every lesson must be gradable, and fairly weighted ──────────────────
for (const l of lessons) {
  const where = `grammar/${l.id}`;
  const exercises = l.exercises ?? [];
  const gradable = exercises.filter((e) => GRADABLE.has(e.type));
  if (gradable.length === 0) {
    fail(
      where,
      `has ${exercises.length} exercise(s) but none gradable ` +
        `(types: ${exercises.map((e) => e.type).join(', ') || 'none'}). It scores 0, ` +
        `never reaches the ${PASS_MARK}% pass mark, and blocks every lesson that ` +
        'lists it as a prerequisite.'
    );
  } else if (gradable.length < MIN_GRADABLE) {
    fail(
      where,
      `has ${gradable.length} gradable exercise, so at a ${PASS_MARK}% pass mark ` +
        'one wrong answer scores 0 and fails the lesson. Needs at least ' +
        `${MIN_GRADABLE}.`
    );
  }
}

// ── 3. Simulate the whole path from a standing start ───────────────────────
//
// The check that would have caught the real defect. Individually-valid lessons
// can still compose into a dead end.
const completable = new Set();
for (let changed = true; changed; ) {
  changed = false;
  for (const l of lessons) {
    if (completable.has(l.id)) continue;
    const ready = (l.prerequisites ?? []).every((p) => completable.has(p));
    const gradable = (l.exercises ?? []).some((e) => GRADABLE.has(e.type));
    if (ready && gradable) {
      completable.add(l.id);
      changed = true;
    }
  }
}
const blocked = lessons.filter((l) => !completable.has(l.id));
if (blocked.length) {
  fail(
    'grammar/path',
    `${blocked.length} of ${lessons.length} lessons can never be reached: ` +
      blocked.map((l) => l.id).join(', ')
  );
}

// ── 4. The level filter must have something at every level it offers ───────
const levels = new Map();
for (const l of lessons) levels.set(l.level, (levels.get(l.level) ?? 0) + 1);
const present = [...levels.keys()].sort((a, b) => a - b);
for (let lv = present[0]; lv <= present[present.length - 1]; lv += 1) {
  if (!levels.has(lv)) {
    fail('grammar/levels', `no lesson at level ${lv}, but levels ${present[0]}–${present[present.length - 1]} exist — the ramp has a hole`);
  }
}
notes.push(
  `lessons per level: ${present.map((lv) => `L${lv}=${levels.get(lv)}`).join(' ')}`
);

// ── Report ─────────────────────────────────────────────────────────────────
for (const n of notes) process.stdout.write(`  note  ${n}\n`);
if (problems.length === 0) {
  process.stdout.write(
    `✅ pedagogy checks pass — all ${lessons.length} lessons reachable, ` +
      `each with >= ${MIN_GRADABLE} gradable exercises\n`
  );
  process.exit(0);
}
for (const p of problems) process.stderr.write(`  ✘ ${p}\n`);
process.stderr.write(
  `\n${problems.length} pedagogy problem(s). These are structural, not stylistic.\n`
);
process.exit(1);
