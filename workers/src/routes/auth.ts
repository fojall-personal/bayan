import { Hono } from 'hono';
import { Database } from '../lib/db';
import { getCurrentUser } from '../index';

export const authRoutes = new Hono<{ Bindings: { DB: Database } }>();

// GET /api/auth/profile — Return user profile
authRoutes.get('/profile', async (c) => {
  const { id: userId } = getCurrentUser();
  const db = c.env.DB;

  try {
    const user = await db.get<Record<string, unknown>>(
      `SELECT id, goal, onboarding_completed, current_path, created_at FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({ data: user });
  } catch (error) {
    console.error('Auth profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/auth/onboarding — Complete onboarding and save preferences
authRoutes.post('/onboarding', async (c) => {
  const { id: userId } = getCurrentUser();
  const db = c.env.DB;
  const { goal, readingAbility, memorizedSurahs, challenge } = await c.req.json();

  try {
    // Determine initial learning path based on self-assessment
    let currentPath = 'path1'; // Default: beginner
    if (readingAbility === 'yes' && memorizedSurahs !== '0') {
      currentPath = 'path3'; // Advanced
    } else if (readingAbility === 'partial') {
      currentPath = 'path2'; // Conversational
    }

    await db.run(
      `UPDATE users SET
         goal = ?,
         current_path = ?,
         onboarding_completed = 1,
         updated_at = datetime('now')
       WHERE id = ?`,
      [goal, currentPath, userId]
    );

    return c.json({ success: true, currentPath });
  } catch (error) {
    console.error('Onboarding error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
