/**
 * Review scheduling, FSRS-6.
 *
 * ── Why this replaced SM-2 ──────────────────────────────────────────────────
 *
 * SM-2 is a fixed heuristic hand-tuned in the 1980s: multiply the interval by an ease
 * factor, nudge the factor up or down. FSRS-6 is a memory model fitted to a public
 * benchmark of roughly 519 million reviews from ~10,000 users, and it predicts recall
 * measurably better. For hifz that means less time re-reading what is already solid.
 *
 * Two things worth stating plainly, because the obvious version of this argument is
 * wrong on both counts:
 *
 *   • FSRS is OPT-IN in Anki, not the default — the manual still calls SM-2 the
 *     baseline. The case for it here rests on the benchmark, not on Anki's choice.
 *   • The algorithm is NOT reimplemented here. ts-fsrs is the reference TypeScript
 *     implementation from the same project that publishes the benchmark: MIT, FSRS-6,
 *     no runtime dependencies, 58kb bundled with no Node builtins. Twenty-one fitted
 *     parameters transcribed by hand from a wiki page is how you get a scheduler that
 *     is subtly wrong and schedules badly in total silence.
 *
 * ── Four grades, not five ───────────────────────────────────────────────────
 *
 * FSRS grades on exactly four values. The hifz review used to ask a five-point
 * question, which would have to collapse two answers onto one grade — and a scale
 * where two answers schedule identically is a lie to the learner. So callers pass a
 * Grade, and each surface's mapping onto it is stated explicitly rather than hidden
 * inside arithmetic.
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade as FsrsGrade,
} from 'ts-fsrs';

export type MemorizationStatus = 'new' | 'learning' | 'reviewing' | 'mastered';

/**
 * How well the learner did — FSRS's four grades, named for what they mean rather
 * than by number.
 */
export type Grade = 'again' | 'hard' | 'good' | 'easy';

const GRADES: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Every grade the API will accept, for validating a request body. */
export const GRADE_VALUES: Grade[] = ['again', 'hard', 'good', 'easy'];

export function isGrade(value: unknown): value is Grade {
  return typeof value === 'string' && (GRADE_VALUES as string[]).includes(value);
}

/**
 * Retention target: the recall probability the schedule aims for at review time.
 *
 * 0.9 is the FSRS default, and it means roughly one lapse in ten reviews BY DESIGN.
 * Written down because a learner who forgets an ayah occasionally should know that is
 * the schedule working rather than a fault — and because anyone tempted to raise it
 * should see the cost, which is more reviews for the same material.
 *
 * Stays the DEFAULT for any caller that does not pass one explicitly — nobody's
 * existing schedule shifts because this file grew a `retention` parameter.
 */
export const REQUEST_RETENTION = 0.9;

/**
 * Per-track defaults, named rather than left as one global constant.
 *
 * Two real tracks call `schedule()` today — memorization.ts (hifz) and
 * learning.ts (vocabulary_mastery) — so these are the two tracks that exist, not
 * an invented three-way split. Hifz gets a higher target: for verbatim recall of
 * scripture, the FSRS default's "one lapse in ten by design" is arguably too
 * loose, where traditional practice implies something closer to 0.95. Neither
 * value is applied automatically — see schedule()'s `retention` parameter.
 */
export const TRACK_RETENTION = {
  hifz: 0.95,
  vocabulary: 0.9,
} as const;
export type Track = keyof typeof TRACK_RETENTION;

/**
 * No learning or relearning steps.
 *
 * FSRS ships with sub-day steps by default — a new card comes back in a minute, then
 * ten. That is right for a desktop flashcard session and wrong here for two reasons.
 * `next_review` is stored as a DATE, so anything under a day flattens to "due today"
 * and the step is lost; and a hifz review is a deliberate sitting, not something you
 * repeat ninety seconds later.
 *
 * Found by a test rather than by reading: with steps enabled, feeding the stored
 * columns back in produced a card that never graduated from Learning. The step index
 * lives on the FSRS card and this schema does not persist it, so every review was
 * step one again — stability climbed from 2.3 to 20.6 across five reviews while the
 * interval stayed at zero days. Removing the steps removes the state that would
 * otherwise have to be stored, and every review now yields a day-scale interval.
 *
 * Built per retention target rather than once at module load — `generatorParameters`
 * is cheap (a config object, not a fitted model), so parameterizing it costs nothing
 * measurable and is what makes per-track retention possible at all.
 */
function buildScheduler(retention: number) {
  return fsrs(
    generatorParameters({
      request_retention: retention,
      learning_steps: [],
      relearning_steps: [],
    })
  );
}

/** Stored memory state. Null throughout on a row that has had no FSRS review yet. */
export interface FsrsState {
  stability: number | null;
  difficulty: number | null;
  /** ISO timestamp of the previous review. */
  last_review: string | null;
  fsrs_state: number | null;
  /** SM-2's interval in days, used to seed stability on the first FSRS review. */
  interval?: number | null;
  reviews?: number | null;
}

export interface ScheduleResult {
  /** ISO date (YYYY-MM-DD), matching what the columns already hold. */
  nextReview: string;
  /** Whole days until the next review. */
  interval: number;
  stability: number;
  difficulty: number;
  fsrsState: number;
  /** ISO timestamp of this review, to store as the next `last_review`. */
  lastReview: string;
  status: MemorizationStatus;
}

/**
 * Rebuild an FSRS card from stored columns.
 *
 * A row with no FSRS state is not treated as new. It carries an SM-2 interval that
 * represents real review history, and discarding that would drop an ayah the learner
 * has held for months back to day one. The interval seeds stability, which is the
 * closest honest translation: stability IS the interval at which recall probability
 * falls to the retention target, so a 30-day SM-2 interval means roughly 30 days of
 * stability. Difficulty has no SM-2 equivalent, so it starts mid-scale and converges
 * on the first real answer.
 */
function toCard(state: FsrsState, now: Date): Card {
  const card = createEmptyCard(now);

  if (state.stability != null && state.difficulty != null) {
    card.stability = state.stability;
    card.difficulty = state.difficulty;
    card.state = (state.fsrs_state ?? State.Review) as Card['state'];
    card.reps = state.reviews ?? 0;
    if (state.last_review) {
      const prev = new Date(state.last_review);
      if (!Number.isNaN(prev.getTime())) {
        card.last_review = prev;
        card.elapsed_days = Math.max(
          0,
          Math.round((now.getTime() - prev.getTime()) / 86_400_000)
        );
      }
    }
    return card;
  }

  const seeded = state.interval ?? 0;
  if (seeded > 0) {
    card.stability = seeded;
    card.difficulty = 5;
    card.state = State.Review;
    card.reps = state.reviews ?? 1;
    card.last_review = new Date(now.getTime() - seeded * 86_400_000);
    card.elapsed_days = seeded;
  }
  return card;
}

/**
 * The learner-facing label, derived from the interval.
 *
 * FSRS has its own state machine (New / Learning / Review / Relearning), but that is
 * the scheduler's vocabulary. `learning` / `reviewing` / `mastered` already appear
 * throughout the UI and the database, and they describe how settled an ayah is rather
 * than which queue it sits in. Kept as a function of the interval so the two
 * vocabularies cannot drift into each other.
 */
function statusFor(intervalDays: number, grade: Grade): MemorizationStatus {
  if (grade === 'again') return 'learning';
  if (intervalDays >= 30) return 'mastered';
  if (intervalDays >= 7) return 'reviewing';
  return 'learning';
}

/**
 * Schedule the next review.
 *
 * `retention` defaults to REQUEST_RETENTION (0.9) — every existing caller that
 * does not pass one gets byte-for-byte the same schedule as before this
 * parameter existed. Pass TRACK_RETENTION.hifz / .vocabulary, or a per-user
 * override, to opt a specific call site in.
 */
export function schedule(
  state: FsrsState,
  grade: Grade,
  now: Date = new Date(),
  retention: number = REQUEST_RETENTION
): ScheduleResult {
  const card = toCard(state, now);
  const next = buildScheduler(retention).repeat(card, now)[GRADES[grade]].card;

  // FSRS returns a same-day due date for a lapse. The columns and the UI both speak
  // in whole days, and 0 — "due today" — is the honest rendering of that.
  const interval = Math.max(
    0,
    Math.round((next.due.getTime() - now.getTime()) / 86_400_000)
  );

  return {
    nextReview: next.due.toISOString().split('T')[0],
    interval,
    stability: next.stability,
    difficulty: next.difficulty,
    fsrsState: next.state,
    lastReview: now.toISOString(),
    status: statusFor(interval, grade),
  };
}

/**
 * Map a 0..1 accuracy from `gradeRecall` onto a grade.
 *
 * The recall endpoint used to compute the new quality from the PREVIOUS one
 * (`isCorrect ? 5 : quality - 2`), which says nothing about how the current attempt
 * went: a learner who had been doing well got a gentler penalty than one who had not,
 * for the same recitation. Accuracy is the measurement actually in hand.
 *
 * The bands are deliberately asymmetric. Word-level recall of scripture is close to
 * all-or-nothing, so anything under half is a genuine lapse, and only a near-perfect
 * pass counts as effortless.
 */
export function gradeFromAccuracy(accuracy: number): Grade {
  if (accuracy < 0.5) return 'again';
  if (accuracy < 0.8) return 'hard';
  if (accuracy < 0.98) return 'good';
  return 'easy';
}

interface ReviewDay {
  day: number;
  label: string;
  description: string;
}

/**
 * The illustrative review ladder shown in the UI.
 *
 * Not a schedule any item follows — FSRS computes each interval from that item's own
 * stability — so this is a rough picture of how spacing grows, and it is labelled as
 * such wherever it is displayed.
 */
export function calculateReviewSchedule(): ReviewDay[] {
  return [1, 2, 4, 7, 14, 30, 60, 90, 180, 365].map((day) => ({
    day,
    label: getReviewLabel(day),
    description: getReviewDescription(day),
  }));
}

function getReviewLabel(days: number): string {
  if (days === 1) return 'Today';
  if (days === 2) return 'Tomorrow';
  if (days === 7) return '1 week';
  if (days === 30) return '1 month';
  if (days === 365) return '1 year';
  return `${days} days`;
}

function getReviewDescription(days: number): string {
  if (days <= 1) return 'Review today to reinforce memory';
  if (days <= 7) return 'Regular review to maintain recall';
  if (days <= 30) return 'Monthly maintenance review';
  return 'Annual maintenance — quick scan through memorization';
}

/**
 * Rough workload estimate for a candidate retention target: "at 0.95 this is
 * ~34 reviews/day; at 0.90, ~21" (the plan's own example), computed from the
 * caller's REAL current items rather than asserted as a general figure.
 *
 * Method: schedule each item's next review from its CURRENT state at the
 * candidate retention with a 'good' grade — the modal real-world outcome, not
 * a best or worst case — then count how many land within the horizon and
 * average per day. A real simulation over real items, not a canned number;
 * accuracy is bounded by how well "assume everyone grades good" holds, which
 * is why this is presented as an estimate, never a promise.
 */
export function estimateReviewsPerDay(
  states: FsrsState[],
  retention: number,
  now: Date = new Date(),
  horizonDays = 30
): number {
  if (states.length === 0 || horizonDays <= 0) return 0;
  let dueWithinHorizon = 0;
  for (const s of states) {
    const result = schedule(s, 'good', now, retention);
    if (result.interval <= horizonDays) dueWithinHorizon += 1;
  }
  return Math.round((dueWithinHorizon / horizonDays) * 10) / 10;
}
