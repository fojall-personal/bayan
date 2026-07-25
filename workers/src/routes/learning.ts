import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type { LessonRow } from '../types';

export interface Exercise {
  type: 'multiple_choice' | 'fill_blank' | 'match' | string;
  question?: string;
  options?: string[];
  correct?: string | number;
  pairs?: Array<{ item: string; answer: string }>;
}

/**
 * Strip Arabic diacritics and tatweel, and normalise alef variants, so a
 * fill-in-the-blank answer is not marked wrong for a missing harakah. Requiring
 * byte-exact vowelled input would fail almost every learner typing on a plain
 * keyboard.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAnswerCorrect(exercise: Exercise, given: unknown): boolean {
  if (exercise.correct === undefined || exercise.correct === null) return false;

  if (exercise.type === 'multiple_choice') {
    // Content stores the option index. Accept the option text too, so a client
    // that sends the label still grades correctly.
    if (typeof given === 'number') return given === Number(exercise.correct);
    if (typeof given === 'string') {
      if (/^\d+$/.test(given)) return Number(given) === Number(exercise.correct);
      const idx = exercise.options?.indexOf(given) ?? -1;
      return idx >= 0 && idx === Number(exercise.correct);
    }
    return false;
  }

  if (exercise.type === 'fill_blank') {
    if (typeof given !== 'string') return false;
    return (
      normalizeArabic(given).toLowerCase() ===
      normalizeArabic(String(exercise.correct)).toLowerCase()
    );
  }

  return false;
}

export const learningRoutes = new Hono<AppEnv>();

// GET /api/learning/next — Get next available lesson based on learning path
learningRoutes.get('/next', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    // Get user's current path
    const user = await db.get<Record<string, unknown>>(
      `SELECT current_path FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all lessons ordered by level and ID
    const allLessons = await db.query<LessonRow>(
      `SELECT * FROM lessons ORDER BY level ASC, id ASC`
    );

    // Parse prerequisites for each lesson
    const lessonsWithPrereqs = allLessons.map((lesson) => ({
      ...lesson,
      prerequisites: JSON.parse(lesson.prerequisites || '[]') as string[],
    }));

    // Get completed lesson IDs
    const completedLessons = await db.query<Record<string, unknown>>(
      `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND completed = 1`,
      [userId]
    );
    const completedIds = completedLessons.map((l) => l.lesson_id as string);

    // Filter available lessons (prerequisites met)
    const availableLessons = lessonsWithPrereqs.filter((lesson) => {
      return lesson.prerequisites.every((prereq: string) =>
        completedIds.includes(prereq)
      );
    });

    // Get next uncompleted lesson in path order
    const pathOrder: string[] = ['literacy', 'grammar', 'vocabulary', 'tajweed'];
    const nextLesson = availableLessons.find(
      (lesson) =>
        pathOrder.includes(lesson.module) && !completedIds.includes(lesson.id)
    );

    if (!nextLesson) {
      return c.json({
        message: 'All lessons in your path are complete!',
        lesson: null,
        totalInPath: allLessons.length,
        completedInPath: completedIds.length,
      });
    }

    // Get current progress for this lesson
    const progress = await db.get<Record<string, unknown>>(
      `SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?`,
      [userId, nextLesson.id]
    );

    return c.json({
      lesson: {
        ...nextLesson,
        content: JSON.parse(nextLesson.content || '[]'),
        exercises: JSON.parse(nextLesson.exercises || '[]'),
      },
      progress: progress
        ? {
            completed: (progress.completed as number) === 1,
            score: progress.score,
            attempts: progress.attempts,
            streak: progress.streak,
          }
        : null,
      totalInPath: allLessons.length,
      completedInPath: completedIds.length,
    });
  } catch (error) {
    console.error('Learning next error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/learning/lessons — Get all lessons (or filtered by module/level)
learningRoutes.get('/lessons', async (c) => {
  const db = getDb(c);
  const { module: mod, level } = c.req.query();

  try {
    const where: string[] = [];
    const params: unknown[] = [];

    if (mod) {
      where.push('module = ?');
      params.push(mod);
    }
    if (level) {
      where.push('level = ?');
      params.push(level);
    }

    const sql =
      'SELECT * FROM lessons' +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ' ORDER BY level ASC, id ASC';

    const lessons = await db.query<Record<string, unknown>>(sql, params);

    return c.json({
      data: lessons.map((l) => ({
        ...l,
        content: JSON.parse((l.content as string) || '[]'),
        exercises: JSON.parse((l.exercises as string) || '[]'),
        prerequisites: JSON.parse((l.prerequisites as string) || '[]'),
      })),
    });
  } catch (error) {
    console.error('Learning lessons error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/learning/lessons/:id — Get single lesson with progress
learningRoutes.get('/lessons/:id', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  const db = getDb(c);

  try {
    const lesson = await db.get<Record<string, unknown>>(
      `SELECT * FROM lessons WHERE id = ?`,
      [lessonId]
    );

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const progress = await db.get<Record<string, unknown>>(
      `SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?`,
      [userId, lessonId]
    );

    return c.json({
      data: {
        ...lesson,
        content: JSON.parse((lesson.content as string) || '[]'),
        exercises: JSON.parse((lesson.exercises as string) || '[]'),
        prerequisites: JSON.parse((lesson.prerequisites as string) || '[]'),
        progress: progress
          ? {
              completed: (progress.completed as number) === 1,
              score: progress.score,
              attempts: progress.attempts,
              streak: progress.streak,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Learning lesson detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/learning/lessons/:id/submit — Submit exercise answers
learningRoutes.post('/lessons/:id/submit', async (c) => {
  const userId = c.get('userId');
  const lessonId = c.req.param('id');
  const db = getDb(c);
  const { answers, score, exerciseIndex } = await c.req.json();

  try {
    // Get lesson to parse exercises
    const lesson = await db.get<Record<string, unknown>>(
      `SELECT * FROM lessons WHERE id = ?`,
      [lessonId]
    );

    if (!lesson) {
      return c.json({ error: 'Lesson not found' }, 404);
    }

    const exercises: Exercise[] = JSON.parse((lesson.exercises as string) || '[]');

    // The contract: `answers` is positional — answers[i] is the response to
    // exercises[i]. Multiple choice sends the selected option's INDEX, matching
    // how the seeded content stores `correct`; fill-in-the-blank sends the text.
    //
    // Previously the client sent [{index, answer}] objects while this compared
    // them to scalars, so every comparison was false, every lesson scored 0%,
    // and nothing could ever reach the 70% completion threshold.
    const responses: unknown[] = Array.isArray(answers) ? answers : [];

    let correctCount = 0;
    let gradedCount = 0;

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];
      const given = responses[i];
      if (!exercise || given === undefined || given === null || given === '') continue;

      // `match` has no grading implementation, so it is excluded from the
      // denominator rather than silently counted correct — which is what the
      // old `isCorrect = true` did, inflating every score containing one.
      if (exercise.type === 'match') continue;

      gradedCount++;
      if (isAnswerCorrect(exercise, given)) correctCount++;
    }

    const totalExercises = gradedCount;
    const finalScore = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;
    const isCompleted = finalScore >= 70;

    // Upsert lesson progress
    await db.run(
      `INSERT INTO lesson_progress
         (user_id, lesson_id, module, completed, score, attempts, last_practiced, next_review, streak)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now', '+1 day'),
         CASE WHEN ? = 1 THEN 1 ELSE 0 END)
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         -- Completion is sticky and the score is a personal best. A failed
         -- retry previously overwrote both, so revisiting a passed lesson and
         -- slipping once un-completed it and wiped the score.
         completed = MAX(completed, ?),
         score = MAX(score, ?),
         attempts = attempts + 1,
         last_practiced = datetime('now'),
         next_review = datetime('now', '+1 day'),
         streak = CASE WHEN ? = 1 THEN streak + 1 ELSE 0 END`,
      [
        userId,
        lessonId,
        lesson.module,
        isCompleted ? 1 : 0,
        finalScore,
        isCompleted ? 1 : 0,
        isCompleted ? 1 : 0,
        finalScore,
        isCompleted ? 1 : 0,
      ]
    );

    // Log quiz attempt
    const id = crypto.randomUUID();
    await db.run(
      `INSERT INTO quiz_attempts (id, user_id, lesson_id, module, questions_answered, questions_correct, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        userId,
        lessonId,
        lesson.module,
        totalExercises,
        correctCount,
      ]
    );

    return c.json({
      data: {
        score: finalScore,
        correct: correctCount,
        total: totalExercises,
        completed: isCompleted,
      },
    });
  } catch (error) {
    console.error('Learning submit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/learning/flashcards — Get vocabulary flashcards for review
learningRoutes.get('/flashcards', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    const dueCards = await db.query<Record<string, unknown>>(
      `SELECT word, meaning_known, reading_known, next_review, reviews
       FROM vocabulary_mastery
       WHERE user_id = ? AND next_review <= datetime('now')
       ORDER BY next_review ASC
       LIMIT 20`,
      [userId]
    );

    return c.json({
      data: dueCards.map((card) => ({
        word: card.word,
        meaningKnown: card.meaning_known,
        readingKnown: card.reading_known,
        dueDate: card.next_review,
        reviewCount: card.reviews,
      })),
    });
  } catch (error) {
    console.error('Flashcards error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/learning/flashcards/review — Submit flashcard review
learningRoutes.post('/flashcards/review', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { word, quality } = await c.req.json();

  try {
    // Simple spaced repetition: interval doubles with quality 4-5
    const interval = quality >= 4
      ? Math.pow(2, quality - 1)
      : quality >= 3 ? 2 : 1;

    const nextReview = new Date(
      Date.now() + interval * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.run(
      `UPDATE vocabulary_mastery SET
         last_seen = datetime('now'),
         next_review = ?,
         reviews = reviews + 1,
         meaning_known = CASE WHEN ? >= 4 THEN 1 ELSE meaning_known END,
         reading_known = CASE WHEN ? >= 3 THEN 1 ELSE reading_known END
       WHERE user_id = ? AND word = ?`,
      [nextReview, quality, quality, userId, word]
    );

    return c.json({
      data: { success: true, next_review: nextReview, interval },
    });
  } catch (error) {
    console.error('Flashcard review error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
