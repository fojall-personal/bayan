import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type { LessonRow } from '../types';
import { applySM2 } from '../lib/space-repetition';

export interface Exercise {
  type: 'multiple_choice' | 'fill_blank' | 'match' | string;
  question?: string;
  options?: string[];
  correct?: string | number;
  pairs?: Array<{ item: string; answer: string }>;
}

/**
 * Strip Arabic diacritics and tatweel, and fold the letter variants, so a
 * fill-in-the-blank answer is not marked wrong for a missing harakah.
 *
 * One real bug fixed here: alef wasla (U+0671, ٱ) was not folded to a plain alef, so
 * the Uthmani ٱلْحَمْدُ could never match a typed الحمد. 143 answers in the exercise
 * bank contain it.
 *
 * The superscript "dagger" alef (U+0670, ٰ) is still DELETED rather than turned into
 * an alef, and that is deliberate: modern spelling writes it out in some words and
 * not others — ٱلْعَٰلَمِينَ is العالمين but ٱلرَّحْمَٰنِ is الرحمن — so neither
 * choice is right for every word. Deleting keeps this comparison conservative, which
 * is what a fill-in-the-blank needs: the article exercise in grammar-01 depends on
 * الكتاب NOT matching كتاب.
 *
 * Recall grading needs the opposite trade-off and has its own, more forgiving
 * comparison in src/app/lib/arabic-compare.ts.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    // The other two hamza carriers. Folding أ إ آ but not ؤ ئ was arbitrary: nobody
    // types the hamza on a plain keyboard, so يُؤْمِنُونَ never matched يومنون.
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
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
    // LEFT JOIN, not an inner join: a word already in someone's queue should
    // still appear if it is missing from the content table, rather than silently
    // vanishing from their review list.
    const dueCards = await db.query<Record<string, unknown>>(
      `SELECT vm.word, vm.meaning_known, vm.reading_known, vm.next_review, vm.reviews,
              v.meaning, v.transliteration, v.root, v.part_of_speech
       FROM vocabulary_mastery vm
       LEFT JOIN vocabulary v ON v.word = vm.word
       WHERE vm.user_id = ? AND vm.next_review <= datetime('now')
       ORDER BY vm.next_review ASC
       LIMIT 20`,
      [userId]
    );

    return c.json({
      data: dueCards.map((card) => ({
        word: card.word,
        // Previously absent, which is why Flashcards.tsx carried a hardcoded
        // ternary over ten words and printed the literal string "Meaning" for
        // everything else.
        meaning: card.meaning ?? null,
        transliteration: card.transliteration ?? null,
        root: card.root ?? null,
        partOfSpeech: card.part_of_speech ?? null,
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

// POST /api/learning/vocabulary/start — Add the next unlearned words to the queue
//
// The missing link. Nothing ever inserted into vocabulary_mastery — only an
// UPDATE existed — so the review queue could never be anything but empty, and the
// Flashcards tab always showed its empty state regardless of what the content
// table held.
learningRoutes.post('/vocabulary/start', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  let count = 10;
  try {
    const body = (await c.req.json()) as { count?: unknown };
    if (body && body.count !== undefined) {
      if (!Number.isInteger(body.count) || (body.count as number) < 1) {
        return c.json({ error: 'count must be a positive integer' }, 400);
      }
      count = Math.min(body.count as number, 50);
    }
  } catch {
    // No body is fine — fall back to the default batch size.
  }

  try {
    const next = await db.query<{ word: string }>(
      `SELECT v.word
       FROM vocabulary v
       LEFT JOIN vocabulary_mastery vm
         ON vm.word = v.word AND vm.user_id = ?
       WHERE vm.word IS NULL
       ORDER BY v.frequency_rank ASC
       LIMIT ?`,
      [userId, count]
    );

    if (next.length === 0) {
      return c.json({ added: 0, words: [], message: 'No new words available' });
    }

    // Due immediately: the point of adding a word is to study it now.
    for (const row of next) {
      await db.run(
        `INSERT INTO vocabulary_mastery
           (user_id, word, meaning_known, reading_known, last_seen, next_review, reviews, ease_factor, interval_days)
         VALUES (?, ?, 0, 0, NULL, datetime('now'), 0, 2.5, 1)
         ON CONFLICT(user_id, word) DO NOTHING`,
        [userId, row.word]
      );
    }

    return c.json({ added: next.length, words: next.map((r) => r.word) });
  } catch (error) {
    console.error('Vocabulary start error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/learning/flashcards/review — Submit flashcard review
learningRoutes.post('/flashcards/review', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);
  const { word, quality } = await c.req.json();

  try {
    // Use the same SM-2 implementation as memorization rather than a second,
    // untested formula. The old one was `interval = quality >= 4 ? 2^(q-1) : q >= 3
    // ? 2 : 1`, computed from the QUALITY alone and ignoring the stored interval
    // and ease factor entirely — so a word answered "OK" on its fiftieth review
    // still came back in two days, and vocabulary_mastery's ease_factor and
    // interval_days columns were never read or written. Same class of bug as the
    // one already fixed in the memorization scheduler.
    const current = await db.get<{
      interval_days: number;
      ease_factor: number;
      reviews: number;
    }>(
      `SELECT interval_days, ease_factor, reviews FROM vocabulary_mastery
       WHERE user_id = ? AND word = ?`,
      [userId, word]
    );

    if (!current) {
      return c.json({ error: 'That word is not in your review queue' }, 404);
    }

    // applySM2 was written for memorization entries; a flashcard only carries the
    // scheduling fields, so the rest are filled with values it does not read for
    // scheduling. `status` is not persisted for vocabulary — vocabulary_mastery
    // tracks meaning_known / reading_known instead.
    const result = applySM2(
      {
        id: word,
        quality,
        interval: current.interval_days,
        ease_factor: current.ease_factor,
        reviews_count: current.reviews,
        status: 'learning',
        next_review: '',
      },
      quality
    );

    await db.run(
      `UPDATE vocabulary_mastery SET
         last_seen = datetime('now'),
         next_review = ?,
         interval_days = ?,
         ease_factor = ?,
         reviews = reviews + 1,
         meaning_known = CASE WHEN ? >= 4 THEN 1 ELSE meaning_known END,
         reading_known = CASE WHEN ? >= 3 THEN 1 ELSE reading_known END
       WHERE user_id = ? AND word = ?`,
      [
        result.nextReview,
        result.interval,
        result.easeFactor,
        quality,
        quality,
        userId,
        word,
      ]
    );

    return c.json({
      data: {
        success: true,
        next_review: result.nextReview,
        interval: result.interval,
        ease_factor: result.easeFactor,
      },
    });
  } catch (error) {
    console.error('Flashcard review error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
