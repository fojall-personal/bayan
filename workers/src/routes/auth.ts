import { Hono } from 'hono';
import type { Database } from '../lib/db';

export const authRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/auth/profile — Return user profile
authRoutes.get('/profile', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  try {
    const user = await db.get<{
      id: string;
      goal: string;
      onboarding_completed: number;
      current_path: string;
      created_at: string;
    }>(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (!user) {
      // Auto-create user on first access
      const insert = await db.run(
        `INSERT INTO users (id, goal, onboarding_completed, current_path) VALUES (?, ?, ?, ?)`,
        [userId, 'all', 0, 'path1']
      );

      return c.json({
        data: {
          id: userId,
          goal: 'all',
          onboarding_completed: false,
          current_path: 'path1',
          created_at: new Date().toISOString(),
        },
      });
    }

    return c.json({
      data: {
        id: user.id,
        goal: user.goal,
        onboarding_completed: user.onboarding_completed === 1,
        current_path: user.current_path,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/auth/onboard — Mark onboarding as complete
authRoutes.post('/onboard', async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const { goal, current_path } = await c.req.json();

  try {
    await db.run(
      `UPDATE users SET onboarding_completed = 1, goal = ?, current_path = ?, updated_at = datetime('now') WHERE id = ?`,
      [goal || 'all', current_path || 'path1', userId]
    );

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Onboard error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
