/**
 * Authored next-lesson pointer.
 *
 * Roots stay off this queue. Literacy rows sort ahead of grammar rows.
 * Band ceiling is applied when current_band is known.
 */

import type { Database } from './db';
import type { LessonProgressRow, LessonsRow } from '../db/schema';
import { BOOK_LESSON_IDS, isBand, lessonAllowedForBand, type Band } from './band';

export const AUTHORED_LESSON_SQL = `
SELECT * FROM lessons
 WHERE (id LIKE 'grammar-%' OR id LIKE 'literacy-%')
 ORDER BY
   CASE
     WHEN id LIKE 'literacy-%' THEN 0
     ELSE 1
   END,
   level ASC,
   id ASC
`;

export async function selectNextAuthoredLesson(
  db: Database,
  userId: string,
  band: Band | null
): Promise<LessonsRow | null> {
  const allLessons = await db.query<LessonsRow>(AUTHORED_LESSON_SQL);
  const completed = await db.query<Pick<LessonProgressRow, 'lesson_id'>>(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND completed = 1`,
    [userId]
  );
  const completedIds = new Set(completed.map((l) => l.lesson_id));

  for (const lesson of allLessons) {
    if (completedIds.has(lesson.id)) continue;
    if (!lessonAllowedForBand(lesson.id, band)) continue;
    const prereqs = JSON.parse(lesson.prerequisites || '[]') as string[];
    if (!prereqs.every((p) => completedIds.has(p))) continue;
    return lesson;
  }
  return null;
}

/** Next unfinished dars on this book's sheet, not the full authored stack. */
export async function selectNextBookLesson(
  db: Database,
  userId: string,
  band: Band | null
): Promise<LessonsRow | null> {
  if (!band) return null;
  const ids = BOOK_LESSON_IDS[band];
  if (ids.length === 0) return null;
  const completed = await db.query<Pick<LessonProgressRow, 'lesson_id'>>(
    `SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND completed = 1`,
    [userId]
  );
  const done = new Set(completed.map((l) => l.lesson_id));
  for (const id of ids) {
    if (done.has(id)) continue;
    const lesson = await db.get<LessonsRow>(`SELECT * FROM lessons WHERE id = ?`, [id]);
    if (lesson) return lesson;
  }
  return null;
}

export async function readUserBand(
  db: Database,
  userId: string
): Promise<{ band: Band | null; currentPath: string | null; source: string | null; enteredAt: string | null }> {
  const user = await db.get<{
    current_band: string | null;
    current_path: string | null;
    band_source: string | null;
    band_entered_at: string | null;
  }>(
    `SELECT current_band, current_path, band_source, band_entered_at FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) {
    return { band: null, currentPath: null, source: null, enteredAt: null };
  }
  return {
    band: isBand(user.current_band) ? user.current_band : null,
    currentPath: user.current_path,
    source: user.band_source,
    enteredAt: user.band_entered_at,
  };
}
