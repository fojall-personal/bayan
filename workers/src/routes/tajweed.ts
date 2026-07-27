import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import { colourTags, type RawTag } from '../lib/tajweed-colors';

export const tajweedRoutes = new Hono<AppEnv>();

// GET /api/tajweed/verses/:surahId — Get verses with tajweed tags for a surah
tajweedRoutes.get('/verses/:surahId', async (c) => {
  const { surahId } = c.req.param();
  const db = getDb(c);

  try {
    const verses = await db.query<Record<string, unknown>>(
      `SELECT surah, ayah, text_uthmani, text_simple, tajweed_tags
       FROM quran_verses
       WHERE surah = ?
       ORDER BY ayah ASC`,
      [surahId]
    );

    // The stored annotations carry only (rule, start, end) — the ingest has no
    // opinion on presentation. Colour comes from tajweed_rules, keyed by the
    // display category the rule belongs to. Read once per request: a long surah
    // has thousands of annotations and this would otherwise be a query per tag.
    const paletteRows = await db.query<Record<string, unknown>>(
      `SELECT id, name, color FROM tajweed_rules`
    );
    const palette = new Map(
      paletteRows.map((r) => [
        String(r.id),
        { color: String(r.color), name: String(r.name) },
      ])
    );

    const legend = new Map<string, { category: string; name: string; color: string }>();

    const shaped = verses.map((v) => {
      const raw: RawTag[] = v.tajweed_tags
        ? (JSON.parse(v.tajweed_tags as string) as RawTag[])
        : [];
      const tags = colourTags(raw, palette);

      // Build the legend from what this surah actually contains, rather than
      // listing every rule in the language.
      for (const t of tags) {
        if (t.category && t.color && !legend.has(t.category)) {
          legend.set(t.category, {
            category: t.category,
            name: t.categoryName ?? t.category,
            color: t.color,
          });
        }
      }

      return {
        surah: v.surah,
        ayah: v.ayah,
        text_uthmani: v.text_uthmani,
        text_simple: v.text_simple,
        tajweed_tags: tags,
      };
    });

    // surahId is not echoed back: it is already in the request path, so it is
    // context the caller supplied rather than payload.
    return c.json({
      data: {
        verses: shaped,
        legend: [...legend.values()],
      },
    });
  } catch (error) {
    console.error('Tajweed verses error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/tajweed/mastery — Get user's tajweed mastery by rule
tajweedRoutes.get('/mastery', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

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

