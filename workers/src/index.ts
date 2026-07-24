import { Hono } from 'hono';
import { verifyAuth } from './lib/auth';
import { Database } from './lib/db';
import { authRoutes } from './routes/auth';
import { assessmentRoutes } from './routes/assessment';
import { learningRoutes } from './routes/learning';
import { memorizationRoutes } from './routes/memorization';
import { progressRoutes } from './routes/progress';
import { tajweedRoutes } from './routes/tajweed';
import { grammarRoutes } from './routes/grammar';

interface Env {
  DB: Database;
  API_TOKEN: string;
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Auth middleware — all /api/* routes require bearer token
app.use('/api/*', async (c, next) => {
  const { valid, userId } = verifyAuth(c.req.raw.headers);
  if (!valid) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('userId', userId);
  await next();
});

// Mount route handlers
app.route('/api/auth', authRoutes);
app.route('/api/assessment', assessmentRoutes);
app.route('/api/learning', learningRoutes);
app.route('/api/memorization', memorizationRoutes);
app.route('/api/progress', progressRoutes);
app.route('/api/tajweed', tajweedRoutes);
app.route('/api/grammar', grammarRoutes);

export default app;
