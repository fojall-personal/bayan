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
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Must match workers/src/routes/learning.ts. `match` is excluded there, so a
 * lesson whose exercises are all `match` is ungradable by construction.
 */
/**
 * The types the SERVER can actually grade.
 *
 * This list previously also claimed translation, pattern_recognition and audio_repeat.
 * `isAnswerCorrect` in workers/src/routes/learning.ts handles none of them and returns
 * false, so any lesson using one would have counted as gradable here while scoring
 * zero for every learner forever. Latent only because no lesson uses those types.
 *
 * Asserted against the source below rather than trusted, since the comment saying
 * "must match learning.ts" is exactly the kind of instruction that goes stale.
 */
const GRADABLE = new Set(['multiple_choice', 'fill_blank', 'match']);
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

const authoredLessons = JSON.parse(
  await readFile(join(root, 'content/grammar/lessons.json'), 'utf-8')
);
/**
 * Generated root lessons are checked too.
 *
 * They arrived as 60 lessons and 180 exercises — nine times the authored content — and
 * checking only the ten hand-written ones would leave the great majority of the path
 * ungated. Everything structural applies equally: a generated lesson can still be
 * unreachable, still land in a level hole, still carry too few gradable exercises.
 */
const generatedLessons = JSON.parse(
  await readFile(join(root, 'content/grammar/root-lessons.json'), 'utf-8')
).lessons;

const lessons = [...authoredLessons, ...generatedLessons];
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

// The notes flush moved to the END of this file. It sat here, above four blocks that each
// push one, so the only note ever printed was this line's own — the grader-agreement
// check, the practice mapping, the credited gates and the lesson categories all reported
// nothing about what they had verified. Their fail() calls worked throughout; it was
// solely the passing output that was lost, which is the harder kind to notice.
// ── The grader and this gate must agree about what is gradable ──────────────
{
  const grader = await readFile(join(root, 'workers/src/routes/learning.ts'), 'utf-8');
  const fn = grader.slice(
    grader.indexOf('export function isAnswerCorrect'),
    grader.indexOf('export const learningRoutes')
  );
  for (const type of GRADABLE) {
    if (!fn.includes(`'${type}'`)) {
      fail(
        'grader',
        `this gate treats "${type}" as gradable but isAnswerCorrect never mentions it ` +
          '— it would score 0 for every learner'
      );
    }
  }
}

// ── Every authored exercise type must be answerable in the UI ──────────────
//
// The check that was missing. A `match` exercise rendered each item beside its own
// answer and recorded no response, while "Next exercise" stayed disabled until a
// response existed — so grammar-02, which opens with one, could not be advanced past
// its first exercise. Nothing here noticed, because the old gate only counted how many
// exercises were gradable and this one WAS counted (as ungradeable, which was allowed).
//
// Two conditions, both mechanical: the page must have a branch for the type, and that
// branch must record an answer.
{
  const page = await readFile(
    join(root, 'src/app/components/learning/LearningPage.tsx'),
    'utf-8'
  );
  const types = new Set();
  for (const lesson of lessons) {
    for (const ex of lesson.exercises ?? []) if (ex.type) types.add(ex.type);
  }
  for (const type of types) {
    // The RENDER branch specifically. Matching the bare `type === 'match'` also hits
    // the isAnswered() helper, which compares the same string and legitimately does
    // not record an answer — the first version of this check failed on that and
    // reported a working branch as broken.
    const branch = `].type === '${type}'`;
    if (!page.includes(branch)) {
      fail(
        'ui',
        `exercises of type "${type}" exist in content but LearningPage has no ` +
          `${branch} branch — the learner sees a question with no way to answer it`
      );
      continue;
    }
    // The branch has to reach handleAnswer somewhere after it, or nothing is recorded
    // and the Next button can never enable.
    const from = page.indexOf(branch);
    const next = page.indexOf("type === '", from + branch.length);
    const body = page.slice(from, next === -1 ? undefined : next);
    if (!body.includes('handleAnswer')) {
      fail(
        'ui',
        `the "${type}" branch never calls handleAnswer, so no answer is recorded and ` +
          'the exercise cannot be advanced past'
      );
    }
  }
}

// ── Every authored lesson belongs to a named discipline ─────────────────────
//
// /grammar offers Syntax, Morphology and Rhetoric. Until the category column existed the
// three tabs were one tab: the endpoint took a category, used it for the mastery lookup,
// and then queried `module = 'grammar'`, so all three returned the same 418 lessons and
// Rhetoric contained no rhetoric.
//
// Checked here rather than trusted because the failure mode is silent in exactly the same
// way: a lesson with no category simply never appears under any tab, and a lesson with a
// misspelt one disappears just as quietly.
{
  const CATEGORIES = new Set(['nahw', 'sarf', 'balagha']);
  const counts = new Map();
  for (const lesson of authoredLessons) {
    if (!CATEGORIES.has(lesson.category)) {
      fail(
        'category',
        `${lesson.id} has category ${JSON.stringify(lesson.category)} — every authored ` +
          'lesson must name its discipline: nahw, sarf or balagha'
      );
      continue;
    }
    counts.set(lesson.category, (counts.get(lesson.category) ?? 0) + 1);
  }
  // Generated root lessons may carry "vocabulary" only — they teach vocabulary in a root
  // family, and 408 of them under a Syntax heading is what made the payload 823 KB.
  const miscategorised = generatedLessons.filter(
    (l) => l.category !== undefined && l.category !== 'vocabulary'
  );
  if (miscategorised.length > 0) {
    fail(
      'category',
      `${miscategorised.length} generated root lesson(s) carry an invalid category — ` +
        'only nahw, sarf, balagha or vocabulary are allowed'
    );
  }
  notes.push(
    'lesson categories: ' +
      [...counts].sort().map(([k, v]) => `${k}=${v}`).join(' ') +
      `, ${generatedLessons.length} generated uncategorised`
  );
}

// ── The review document's gate list ─────────────────────────────────────────
//
// docs/lesson-review.html tells a human reader which gates already settle the structural
// claims, so they can skip those and spend their attention on the prose. That list names
// scripts, and a name is exactly the kind of thing that rots: the page previously claimed
// "eight automated gates" and was wrong in both directions at once. Naming them fixed the
// count; this makes the names load-bearing.
{
  const src = await readFile(join(root, 'scripts/gen-lesson-review.mjs'), 'utf-8');
  const named = [...src.matchAll(/script:\s*'([^']+)'/g)].map((m) => m[1].split(' ')[0]);
  if (named.length === 0) {
    fail('review', 'gen-lesson-review.mjs no longer lists the gates it tells readers to trust');
  }
  for (const script of named) {
    if (!existsSync(join(root, 'scripts', script))) {
      fail(
        'review',
        `gen-lesson-review.mjs credits scripts/${script}, which does not exist — the ` +
          'review document would tell a reader to trust a gate that is not there'
      );
    }
  }
  notes.push(`review document credits ${named.length} gates, all present`);
}

// ── Lesson → practice mapping ───────────────────────────────────────────────
//
// src/app/lib/lesson-practice.ts decides which derived-bank kind follows each lesson.
// It is editorial judgement, so it cannot be generated — but it CAN drift: a new lesson
// with no entry would silently offer no practice, and a typo in a kind would link to a
// filter that returns nothing at all. Both are checked here.
{
  const src = await readFile(
    join(root, 'src/app/lib/lesson-practice.ts'),
    'utf-8'
  );
  const BANK_KINDS = new Set([
    'aspect', 'case_ending', 'verb_form', 'pos_id', 'root_id', 'word_meaning', 'find_word',
    'definiteness', 'negation', 'mood', 'voice', 'subject_agreement',
    'word_role', 'relative_pronoun', 'demonstrative', 'conditional',
    'sentence_type',
    'mubtada_khabar', 'subject_word', 'object', 'idafa', 'derived_noun', 'fronting', 'jinas', 'simile',
  ]);

  const mapped = new Map();
  for (const m of src.matchAll(/'(grammar-\d+)':\s*(null|\{)/g)) {
    mapped.set(m[1], m[2] === 'null' ? null : 'entry');
  }
  for (const m of src.matchAll(/kind:\s*'([a-z_]+)'/g)) {
    if (!BANK_KINDS.has(m[1])) {
      fail('practice', `"${m[1]}" is not one of the bank's kinds, so the link would return nothing`);
    }
  }
  // Authored lessons need an explicit decision each. Generated root lessons are handled
  // by prefix in practiceHref — they map onto root identification by construction, and
  // enumerating sixty of them would be noise rather than a decision.
  for (const lesson of authoredLessons) {
    if (!mapped.has(lesson.id)) {
      fail(
        'practice',
        `${lesson.id} has no entry in lesson-practice.ts — add a mapping, or an explicit ` +
          'null saying there is nothing honest to offer'
      );
    }
  }
  if (!/startsWith\('root-'\)/.test(src)) {
    fail('practice', 'practiceHref no longer handles generated root- lessons by prefix');
  }
  for (const id of mapped.keys()) {
    if (!authoredLessons.some((l) => l.id === id)) {
      fail('practice', `lesson-practice.ts maps ${id}, which is not a lesson`);
    }
  }
  const withPractice = [...mapped.values()].filter(Boolean).length;
  notes.push(`practice mapped for ${withPractice}/${lessons.length} lessons`);
}

// ── Every exercise must explain itself ──────────────────────────────────────
//
// The result screen now shows, per exercise, what the learner answered, the correct
// answer, and the authored explanation. An exercise without one renders as a bare "✗"
// — the learner is told they were wrong and nothing about why, which is the least
// useful moment to go quiet.
//
// Found by the review document rather than by a gate: grammar-02's match exercise had
// no explanation, and it took rendering all 201 exercises for a human to read before
// anyone noticed. Checked here now so the next one is caught before it ships.
for (const lesson of lessons) {
  for (const [i, ex] of (lesson.exercises ?? []).entries()) {
    const why = (ex.explanation ?? '').trim();
    if (why.length === 0) {
      fail(
        lesson.id,
        `exercise ${i + 1} (${ex.type}) has no explanation — the review screen would ` +
          'tell the learner they were wrong and nothing else'
      );
    } else if (why.length < 20) {
      // A placeholder is worse than an absence, because it passes a presence check.
      fail(lesson.id, `exercise ${i + 1} has a ${why.length}-character explanation`);
    }
  }
}

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
