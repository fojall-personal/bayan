import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type { LessonRow } from '../types';

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
      `SELECT * FROM lesson_progress WHERE lesson_id = ?`,
      [nextLesson.id]
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
    let sql = 'SELECT * FROM lessons';
    const params: unknown[] = [];

    if (mod) {
      sql += ' WHERE module = ?';
      params.push(mod);
    }
    if (level) {
      sql += level ? ' AND level = ?' : '';
      params.push(level);
    }

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
      `SELECT * FROM lesson_progress WHERE lesson_id = ?`,
      [lessonId]
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

    const exercises = JSON.parse((lesson.exercises as string) || '[]');
    const totalExercises = exercises.length;

    // Calculate correct count from answers
    let correctCount = 0;
    if (Array.isArray(answers)) {
      for (let i = 0; i < answers.length; i++) {
        const exercise = exercises[i];
        if (!exercise) continue;

        let isCorrect = false;
        if (exercise.type === 'multiple_choice') {
          isCorrect = answers[i] === exercise.correct;
        } else if (exercise.type === 'fill_blank') {
          isCorrect = answers[i]?.toLowerCase() === exercise.correct?.toLowerCase();
        } else if (exercise.type === 'match') {
          // For match exercises, check if pairs are correct
          isCorrect = true; // Simplified — full match logic would compare pairs
        }

        if (isCorrect) correctCount++;
      }
    }

    const finalScore = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;
    const isCompleted = finalScore >= 70;

    // Upsert lesson progress
    await db.run(
      `INSERT INTO lesson_progress (lesson_id, module, completed, score, attempts, last_practiced, next_review, streak)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 day'),
         CASE WHEN ? = 1 THEN
           (SELECT COALESCE(streak, 0) FROM lesson_progress WHERE lesson_id = ?) + 1
         ELSE 1 END)
       ON CONFLICT(lesson_id) DO UPDATE SET
         completed = ?,
         score = ?,
         attempts = attempts + 1,
         last_practiced = datetime('now'),
         next_review = datetime('now', '+1 day'),
         streak = CASE WHEN ? = 1 THEN streak + 1 ELSE 1 END`,
      [
        lessonId,
        lesson.module,
        isCompleted ? 1 : 0,
        finalScore,
        isCompleted ? 1 : 0,
        lessonId,
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
