import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type {
  MemorizationRow,
  UsersRow,
} from '../db/schema';

export const certificateRoutes = new Hono<AppEnv>();

// GET /api/certificate/export — Generate memorization certificate data
certificateRoutes.get('/export', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  try {
    // Get user info
    const user = await db.get<UsersRow>(
      `SELECT * FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get memorized surahs
    const memorization = await db.query<Pick<MemorizationRow, 'surah_id'> & { ayah_count: number }>(
      `SELECT surah_id, COUNT(*) as ayah_count
       FROM memorization
       WHERE user_id = ? AND status = 'mastered'
       GROUP BY surah_id
       ORDER BY surah_id ASC`,
      [userId]
    );

    const totalAyahs = memorization.reduce(
      (sum: number, m) => sum + (m.ayah_count as number),
      0
    );

    return c.json({
      data: {
        certificate: {
          title: 'Quran Memorization Certificate',
          subtitle: 'Ithbat Al-Hifz',
          userName: (user.name as string) || 'Student',
          date: new Date().toISOString().split('T')[0],
          surahs: memorization.map((m) => ({
            number: m.surah_id,
            ayahs: m.ayah_count,
          })),
          totalAyahs,
          totalSurahs: memorization.length,
        },
      },
    });
  } catch (error) {
    console.error('Certificate export error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
