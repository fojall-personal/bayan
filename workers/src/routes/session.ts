/**
 * Mixed daily session planner and recorder.
 *
 * One time-boxed sitting: due hifz, due vocabulary, and the next unlocked
 * lesson, interleaved, under a ~12 minute budget. GET /plan reuses today's
 * open session so a refresh does not spawn a second row. POST /complete
 * writes the journal AND applies FSRS grades to the underlying rows —
 * a session that only recorded JSON would leave tomorrow's queue unchanged.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type {
  LessonProgressRow,
  LessonsRow,
  MemorizationRow,
  VocabularyMasteryRow,
} from '../db/schema';
import { isGrade, schedule, REQUEST_RETENTION, type Grade } from '../lib/space-repetition';
import { hifzRetentionFor, precedingSpanWarmStart } from './memorization';

export const sessionRoutes = new Hono<AppEnv>();

export type SessionItemType =
  | 'hifz'
  | 'vocabulary'
  | 'lesson'
  | 'function_word'
  | 'intensive'
  | 'production'
  | 'elided'
  | 'freeflow';

export interface SessionItem {
  id: string;
  type: SessionItemType;
  label: string;
  estimatedSeconds: number;
  payload: Record<string, unknown>;
}

export interface SessionPlan {
  sessionId: string;
  items: SessionItem[];
  plannedSeconds: number;
  summary: {
    hifz: number;
    vocabulary: number;
    lesson: number;
    function_word: number;
    intensive: number;
    production: number;
    elided: number;
    freeflow: number;
  };
}

interface ItemResult {
  itemId: string;
  grade?: unknown;
  correct?: boolean;
  seconds?: number;
  /** ReviewSession already wrote FSRS; do not apply again. */
  scheduled?: boolean;
}

export type SessionReflection = 'recall' | 'particles' | 'meaning' | 'production';

const TARGET_SECONDS = 1500;
const MAX_HIFZ = 4;
const MAX_VOCAB = 5;
const LESSON_SECONDS = 180;
const LOOP_SECONDS = 180;
const PATH_ORDER = ['literacy', 'grammar', 'vocabulary', 'tajweed'];

function uid(): string {
  return crypto.randomUUID();
}

function summarise(items: SessionItem[]): SessionPlan['summary'] {
  const count = (t: SessionItemType) => items.filter((i) => i.type === t).length;
  return {
    hifz: count('hifz'),
    vocabulary: count('vocabulary'),
    lesson: count('lesson'),
    function_word: count('function_word'),
    intensive: count('intensive'),
    production: count('production'),
    elided: count('elided'),
    freeflow: count('freeflow'),
  };
}

function toPlan(sessionId: string, items: SessionItem[], plannedSeconds: number): SessionPlan {
  return { sessionId, items, plannedSeconds, summary: summarise(items) };
}

/** Due sabaq/sabqi spans. Manzil stays on its own contiguous path. */
async function fetchDueHifz(db: Database, userId: string): Promise<SessionItem[]> {
  const rows = await db.query<
    MemorizationRow & { ayah_text: string | null; text_simple: string | null }
  >(
    `SELECT m.*,
            q.text_uthmani AS ayah_text,
            q.text_simple  AS text_simple
     FROM memorization m
     LEFT JOIN quran_verses q ON m.surah_id = q.surah AND m.ayah_to = q.ayah
     WHERE m.user_id = ?
       AND m.next_review <= datetime('now')
       AND (m.last_reviewed IS NULL OR julianday('now') - julianday(m.last_reviewed) <= 30)
     ORDER BY m.next_review ASC
     LIMIT ?`,
    [userId, MAX_HIFZ]
  );

  return rows.map((row) => ({
    id: `hifz:${row.id}`,
    type: 'hifz' as const,
    label: `Surah ${row.surah_id}:${row.ayah_from}${row.ayah_to !== row.ayah_from ? `–${row.ayah_to}` : ''}`,
    estimatedSeconds: 90,
    payload: {
      memorizationId: row.id,
      surahId: row.surah_id,
      ayahFrom: row.ayah_from,
      ayahTo: row.ayah_to,
      textUthmani: row.ayah_text,
      textSimple: row.text_simple,
      status: row.status,
    },
  }));
}

interface VocabDueRow {
  word: string;
  reviews: number;
  meaning: string | null;
  transliteration: string | null;
  root: string | null;
  source_surah: number | null;
  source_ayah: number | null;
}

/** Due vocabulary, with the same gloss join the flashcard queue uses. */
async function fetchDueVocab(db: Database, userId: string): Promise<SessionItem[]> {
  const rows = await db.query<VocabDueRow>(
    `SELECT vm.word, vm.reviews,
            COALESCE(v.meaning, g.english)                 AS meaning,
            COALESCE(v.transliteration, g.transliteration) AS transliteration,
            COALESCE(
              v.root,
              (SELECT mm.root FROM quran_word_morphology mm
                WHERE mm.surah_id   = vm.source_surah
                  AND mm.ayah_id    = vm.source_ayah
                  AND mm.word_index = vm.source_position
                  AND mm.root IS NOT NULL
                ORDER BY mm.segment_index LIMIT 1)
            )                                              AS root,
            vm.source_surah, vm.source_ayah
     FROM vocabulary_mastery vm
     LEFT JOIN vocabulary v ON v.word = vm.word
     LEFT JOIN quran_word_gloss g
            ON g.surah_id = vm.source_surah
           AND g.ayah_id  = vm.source_ayah
           AND g.position = vm.source_position
     WHERE vm.user_id = ?
       AND vm.next_review <= datetime('now')
     ORDER BY vm.next_review ASC
     LIMIT ?`,
    [userId, MAX_VOCAB]
  );

  return rows.map((row) => ({
    id: `vocab:${row.word}`,
    type: 'vocabulary' as const,
    label: row.word,
    estimatedSeconds: 45,
    payload: {
      word: row.word,
      meaning: row.meaning,
      transliteration: row.transliteration,
      root: row.root,
      sourceSurah: row.source_surah,
      sourceAyah: row.source_ayah,
      reviews: row.reviews,
    },
  }));
}

/** Same “next unlocked” rule as GET /api/learning/next. */
async function fetchNextLesson(db: Database, userId: string): Promise<SessionItem | null> {
  const allLessons = await db.query<LessonsRow>(
    `SELECT * FROM lessons ORDER BY level ASC, id ASC`
  );
  const completed = await db.query<Pick<LessonProgressRow, 'lesson_id'>>(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND completed = 1`,
    [userId]
  );
  const completedIds = new Set(completed.map((l) => l.lesson_id));

  const next = allLessons.find((lesson) => {
    if (!PATH_ORDER.includes(lesson.module) || completedIds.has(lesson.id)) return false;
    const prereqs = JSON.parse(lesson.prerequisites || '[]') as string[];
    return prereqs.every((p) => completedIds.has(p));
  });

  if (!next) return null;

  return {
    id: `lesson:${next.id}`,
    type: 'lesson',
    label: next.title,
    estimatedSeconds: Math.min(LESSON_SECONDS, (next.estimated_minutes || 15) * 60),
    payload: {
      lessonId: next.id,
      title: next.title,
      level: next.level,
    },
  };
}

function loopItems(hasElided: boolean): SessionItem[] {
  const items: SessionItem[] = [
    {
      id: 'fn:track',
      type: 'function_word',
      label: 'Function words',
      estimatedSeconds: LOOP_SECONDS,
      payload: {},
    },
    {
      id: 'intensive:queue',
      type: 'intensive',
      label: 'Just past your edge',
      estimatedSeconds: LOOP_SECONDS,
      payload: {},
    },
    {
      id: 'production:tashkil',
      type: 'production',
      label: 'Vowel the endings',
      estimatedSeconds: LOOP_SECONDS,
      payload: {},
    },
  ];
  if (hasElided) {
    items.push({
      id: 'elided:subj',
      type: 'elided',
      label: 'The unwritten فاعل',
      estimatedSeconds: LOOP_SECONDS,
      payload: {},
    });
  }
  items.push({
    id: 'freeflow:run',
    type: 'freeflow',
    label: 'Read a page you know',
    estimatedSeconds: 300,
    payload: {},
  });
  return items;
}

function mixItems(
  hifz: SessionItem[],
  vocab: SessionItem[],
  lesson: SessionItem | null,
  loop: SessionItem[],
  prefer: SessionReflection | null
): SessionItem[] {
  let ordered: SessionItem[] = [...hifz, ...loop, ...vocab];
  if (lesson) ordered.push(lesson);

  if (prefer === 'particles') {
    ordered = [
      ...ordered.filter((i) => i.type === 'function_word'),
      ...ordered.filter((i) => i.type !== 'function_word'),
    ];
  } else if (prefer === 'meaning') {
    ordered = [
      ...ordered.filter((i) => i.type === 'intensive' || i.type === 'vocabulary'),
      ...ordered.filter((i) => i.type !== 'intensive' && i.type !== 'vocabulary'),
    ];
  } else if (prefer === 'production') {
    ordered = [
      ...ordered.filter((i) => i.type === 'production' || i.type === 'elided'),
      ...ordered.filter((i) => i.type !== 'production' && i.type !== 'elided'),
    ];
  }

  const selected: SessionItem[] = [];
  let used = 0;
  for (const item of ordered) {
    if (used + item.estimatedSeconds > TARGET_SECONDS && selected.length > 0) break;
    selected.push(item);
    used += item.estimatedSeconds;
  }
  return selected;
}

async function lastReflection(db: Database, userId: string): Promise<SessionReflection | null> {
  const row = await db.get<{ reflection: string | null }>(
    `SELECT reflection FROM user_sessions
      WHERE user_id = ? AND completed_at IS NOT NULL
      ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );
  const value = row?.reflection;
  if (value === 'recall' || value === 'particles' || value === 'meaning' || value === 'production') {
    return value;
  }
  return null;
}

async function hasElidedSubjects(db: Database): Promise<boolean> {
  const row = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM quran_syntax WHERE is_implied = 1 AND rel = 'Subj'`
  );
  return (row?.n ?? 0) > 0;
}

async function todaysOpenSession(
  db: Database,
  userId: string
): Promise<{ id: string; planned_items: string; planned_seconds: number } | undefined> {
  return db.get(
    `SELECT id, planned_items, planned_seconds
       FROM user_sessions
      WHERE user_id = ?
        AND completed_at IS NULL
        AND date(started_at) = date('now')
      ORDER BY started_at DESC
      LIMIT 1`,
    [userId]
  );
}

async function applyHifzGrade(
  db: Database,
  userId: string,
  memorizationId: string,
  grade: Grade
): Promise<boolean> {
  const entry = await db.get<MemorizationRow>(
    `SELECT * FROM memorization WHERE id = ? AND user_id = ?`,
    [memorizationId, userId]
  );
  if (!entry) return false;

  const now = new Date();
  const result = schedule(
    {
      stability: entry.stability,
      difficulty: entry.difficulty,
      last_review: entry.last_review,
      fsrs_state: entry.fsrs_state,
      interval: entry.interval,
      reviews: entry.revision_count,
    },
    grade,
    now,
    (await hifzRetentionFor(db, userId)) ?? REQUEST_RETENTION
  );
  const warmStart = await precedingSpanWarmStart(
    db,
    userId,
    entry.surah_id,
    entry.ayah_from,
    now
  );

  await db.run(
    `UPDATE memorization SET
       last_reviewed = datetime('now'),
       next_review = ?,
       revision_count = revision_count + 1,
       status = ?,
       interval = ?,
       stability = ?,
       difficulty = ?,
       fsrs_state = ?,
       last_review = ?,
       warm_start = ?
     WHERE id = ? AND user_id = ?`,
    [
      result.nextReview,
      result.status,
      result.interval,
      result.stability,
      result.difficulty,
      result.fsrsState,
      result.lastReview,
      warmStart ? 1 : 0,
      memorizationId,
      userId,
    ]
  );
  return true;
}

async function applyVocabGrade(
  db: Database,
  userId: string,
  word: string,
  grade: Grade
): Promise<boolean> {
  const current = await db.get<
    Pick<
      VocabularyMasteryRow,
      'interval_days' | 'reviews' | 'stability' | 'difficulty' | 'last_review' | 'fsrs_state'
    >
  >(
    `SELECT interval_days, reviews, stability, difficulty, last_review, fsrs_state
       FROM vocabulary_mastery WHERE user_id = ? AND word = ?`,
    [userId, word]
  );
  if (!current) return false;

  const result = schedule(
    {
      stability: current.stability,
      difficulty: current.difficulty,
      last_review: current.last_review,
      fsrs_state: current.fsrs_state,
      interval: current.interval_days,
      reviews: current.reviews,
    },
    grade
  );

  await db.run(
    `UPDATE vocabulary_mastery SET
       last_seen = datetime('now'),
       next_review = ?,
       interval_days = ?,
       reviews = reviews + 1,
       stability = ?,
       difficulty = ?,
       fsrs_state = ?,
       last_review = ?,
       meaning_known = CASE WHEN ? IN ('good', 'easy') THEN 1 ELSE meaning_known END,
       reading_known = CASE WHEN ? <> 'again' THEN 1 ELSE reading_known END
     WHERE user_id = ? AND word = ?`,
    [
      result.nextReview,
      result.interval,
      result.stability,
      result.difficulty,
      result.fsrsState,
      result.lastReview,
      grade,
      grade,
      userId,
      word,
    ]
  );
  return true;
}

/**
 * Apply grades from the journal onto the live schedulers.
 * seconds === 0 is a skip: recorded, not scheduled.
 */
async function applyResults(
  db: Database,
  userId: string,
  planned: SessionItem[],
  results: ItemResult[]
): Promise<{ hifz: number; vocabulary: number; lesson: number }> {
  const byId = new Map(planned.map((item) => [item.id, item]));
  const applied = { hifz: 0, vocabulary: 0, lesson: 0 };

  for (const result of results) {
    if (result.seconds === 0 || result.scheduled) continue;
    const item = byId.get(result.itemId);
    if (!item) continue;

    if (item.type === 'hifz' && isGrade(result.grade)) {
      const id = item.payload.memorizationId;
      if (typeof id === 'string' && (await applyHifzGrade(db, userId, id, result.grade))) {
        applied.hifz += 1;
      }
    } else if (item.type === 'vocabulary' && isGrade(result.grade)) {
      const word = item.payload.word;
      if (typeof word === 'string' && (await applyVocabGrade(db, userId, word, result.grade))) {
        applied.vocabulary += 1;
      }
    }
    // Lesson items are a pointer into /learning. Completing the lesson is the
    // submit handler's job — a "continue" tap here must not write lesson_progress.
  }

  return applied;
}

sessionRoutes.get('/plan', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const existing = await todaysOpenSession(db, userId);
    if (existing) {
      const items = JSON.parse(existing.planned_items) as SessionItem[];
      return c.json({
        data: toPlan(existing.id, items, existing.planned_seconds),
      });
    }

    const [hifz, vocab, lesson, prefer, elided] = await Promise.all([
      fetchDueHifz(db, userId),
      fetchDueVocab(db, userId),
      fetchNextLesson(db, userId),
      lastReflection(db, userId),
      hasElidedSubjects(db),
    ]);

    const items = mixItems(hifz, vocab, lesson, loopItems(elided), prefer);
    const plannedSeconds = items.reduce((s, i) => s + i.estimatedSeconds, 0);
    const sessionId = uid();

    // Empty plans are not persisted. There is nothing to complete, and a
    // refresh must not fill user_sessions with abandoned zero-item rows.
    if (items.length > 0) {
      await db.run(
        `INSERT INTO user_sessions (id, user_id, planned_items, planned_seconds, started_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [sessionId, userId, JSON.stringify(items), plannedSeconds]
      );
    }

    return c.json({ data: toPlan(sessionId, items, plannedSeconds) });
  } catch (error) {
    console.error('Session plan error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

sessionRoutes.post('/complete', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  let body: {
    sessionId?: string;
    results?: unknown;
    actualSeconds?: number;
    reflection?: unknown;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Expected a JSON body' }, 400);
  }

  const { sessionId, results, actualSeconds, reflection } = body;
  const savedReflection =
    reflection === 'recall' ||
    reflection === 'particles' ||
    reflection === 'meaning' ||
    reflection === 'production'
      ? reflection
      : null;
  if (!sessionId || typeof sessionId !== 'string') {
    return c.json({ error: 'sessionId is required' }, 400);
  }
  if (!Array.isArray(results)) {
    return c.json({ error: 'results must be an array' }, 400);
  }

  try {
    const existing = await db.get<{
      id: string;
      user_id: string;
      completed_at: string | null;
      planned_items: string;
    }>(
      `SELECT id, user_id, completed_at, planned_items FROM user_sessions WHERE id = ?`,
      [sessionId]
    );

    if (!existing || existing.user_id !== userId) {
      return c.json({ error: 'Session not found' }, 404);
    }
    if (existing.completed_at) {
      return c.json({ error: 'Session already completed' }, 409);
    }

    const planned = JSON.parse(existing.planned_items) as SessionItem[];
    const applied = await applyResults(db, userId, planned, results as ItemResult[]);

    await db.run(
      `UPDATE user_sessions
       SET results = ?, actual_seconds = ?, reflection = ?, completed_at = datetime('now')
       WHERE id = ?`,
      [
        JSON.stringify(results),
        typeof actualSeconds === 'number' ? actualSeconds : null,
        savedReflection,
        sessionId,
      ]
    );

    return c.json({
      data: {
        success: true,
        sessionId,
        applied,
      },
    });
  } catch (error) {
    console.error('Session complete error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
