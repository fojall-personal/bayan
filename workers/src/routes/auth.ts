import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { getDb } from '../lib/db';
import type { Database } from '../lib/db';
import type {
  UsersRow,
} from '../db/schema';

export const authRoutes = new Hono<AppEnv>();

// GET /api/auth/whoami — report the resolved identity and which auth mode is
// active. The quickest way to confirm Access is wired up correctly.
//
// Registered here rather than on the parent app: a parent-level
// app.get('/api/auth/whoami') is shadowed by app.route('/api/auth', authRoutes),
// which answers with the sub-app's 404. That shadowing did not show up under
// `wrangler dev` (where the Hono app is the default export) but did through the
// Pages _worker.js, so it was only caught by smoke-testing the production path.
authRoutes.get('/whoami', (c) =>
  c.json({
    data: {
      userId: c.get('userId'),
      email: c.get('userEmail') ?? null,
      mode: c.env.ACCESS_TEAM_DOMAIN && c.env.ACCESS_AUD ? 'access' : 'shared-token',
    },
  })
);

// GET /api/auth/profile — Return user profile
authRoutes.get('/profile', async (c) => {
  try {
    const userId = c.get('userId');
    const db = getDb(c);

    try {
      const user = await db.get<Pick<UsersRow, 'id' | 'goal' | 'onboarding_completed' | 'current_path' | 'created_at'>>(
        `SELECT id, goal, onboarding_completed, current_path, created_at FROM users WHERE id = ?`,
        [userId]
      );

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      return c.json({ data: user });
    } catch (dbError) {
      console.error('DB error:', dbError);
      return c.json({ error: 'Database error', details: (dbError as Error).message }, 500);
    }
  } catch (error) {
    console.error('Auth profile error:', error);
    return c.json({ error: 'Internal server error', details: (error as Error).message }, 500);
  }
});

// POST /api/auth/onboarding — Complete onboarding and save preferences
authRoutes.post('/onboarding', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch (error) {
    console.error('Onboarding body parse error:', error);
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  const { goal, readingAbility, memorizedSurahs, challenge } = body;

  // Validate required fields — `goal` is NOT NULL in the schema, so sending
  // {} produces a silent constraint violation that becomes an opaque 500.
  if (typeof goal !== 'string' || goal.length === 0) {
    return c.json(
      { error: "Validation failed: 'goal' is required and must be a non-empty string" },
      400
    );
  }

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

    return c.json({ data: { success: true, currentPath } });
  } catch (error) {
    console.error('Onboarding error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
