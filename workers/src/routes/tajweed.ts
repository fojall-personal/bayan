import { Hono } from 'hono';
import { Database } from '../lib/db';
import { getCurrentUser } from '../index';

function getDB(c: any) {
  const raw = c.env.DB;
  if (raw && typeof raw.prepare === 'function') {
    return new Database(raw);
  }
  return raw;
}


export const tajweedRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/tajweed/rules — Get all tajweed rules with examples
tajweedRoutes.get('/rules', async (c) => {
  const db = getDB(c);

  try {
    const rules = await db.query<Record<string, unknown>>(
      `SELECT * FROM tajweed_rules ORDER BY name ASC`
    );

    return c.json({
      data: rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        color: r.color,
        colorName: r.color_name,
      })),
    });
  } catch (error) {
    console.error('Tajweed rules error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tajweed/verses/:surahId — Get verses with tajweed tags for a surah
tajweedRoutes.get('/verses/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const db = getDB(c);

  try {
    const verses = await db.query<Record<string, unknown>>(
      `SELECT surah, ayah, text_uthmani, text_simple, tajweed_tags
       FROM quran_verses
       WHERE surah = ?
       ORDER BY ayah ASC`,
      [surahId]
    );

    return c.json({
      surahId: Number(surahId),
      verses: verses.map((v) => ({
        surah: v.surah,
        ayah: v.ayah,
        text_uthmani: v.text_uthmani,
        text_simple: v.text_simple,
        tajweed_tags: v.tajweed_tags ? JSON.parse(v.tajweed_tags as string) : [],
      })),
    });
  } catch (error) {
    console.error('Tajweed verses error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tajweed/mastery — Get user's tajweed mastery by rule
tajweedRoutes.get('/mastery', async (c) => {
  const { id: userId } = getCurrentUser();
  const db = getDB(c);

  try {
    const mastery = await db.query<Record<string, unknown>>(
      `SELECT r.id as rule_id, r.name, r.color, r.color_name,
              COUNT(tp.id) as total_attempts,
              SUM(CASE WHEN tp.correct = 1 THEN 1 ELSE 0 END) as correct,
              CASE WHEN COUNT(tp.id) > 0 THEN
                ROUND(SUM(CASE WHEN tp.correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(tp.id), 1)
              ELSE 0 END as mastery_percentage
       FROM tajweed_rules r
       LEFT JOIN tajweed_practice tp ON r.id = tp.rule_id AND tp.user_id = ?
       GROUP BY r.id, r.name, r.color, r.color_name
       ORDER BY mastery_percentage DESC`,
      [userId]
    );

    return c.json({
      data: mastery.map((m) => ({
        ruleId: m.rule_id,
        name: m.name,
        color: m.color,
        colorName: m.color_name,
        totalAttempts: m.total_attempts,
        correct: m.correct,
        masteryPercentage: m.mastery_percentage,
      })),
    });
  } catch (error) {
    console.error('Tajweed mastery error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/tajweed/practice/:ruleId/submit — Submit practice result
tajweedRoutes.post('/practice/:ruleId/submit', async (c) => {
  const { ruleId } = c.req.param();
  const { id: userId } = getCurrentUser();
  const db = getDB(c);
  const { wordId, correct, timeSpent } = await c.req.json();

  try {
    await db.run(
      `INSERT OR REPLACE INTO tajweed_practice (id, user_id, rule_id, word_id, correct, time_spent, practiced_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), userId, ruleId, wordId, correct ? 1 : 0, timeSpent]
    );

    const totalAttempts = await db.get<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM tajweed_practice WHERE user_id = ? AND rule_id = ?`,
      [userId, ruleId]
    );
    const correctAttempts = await db.get<Record<string, unknown>>(
      `SELECT COUNT(*) as count FROM tajweed_practice WHERE user_id = ? AND rule_id = ? AND correct = 1`,
      [userId, ruleId]
    );

    const mastery = totalAttempts?.count
      ? Math.round(((correctAttempts?.count || 0) / totalAttempts.count) * 100)
      : 0;

    return c.json({
      data: { success: true, mastery, totalAttempts: totalAttempts?.count || 0 },
    });
  } catch (error) {
    console.error('Tajweed practice submit error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
