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
import { tutorRoutes } from './routes/tutor';
import { certificateRoutes } from './routes/certificate';

interface Env {
  DB: Database;
  API_TOKEN: string;
}

// Shared variable to pass userId across route boundaries
let currentUser: { id: string } | null = null;

export function getCurrentUser() {
  if (!currentUser) {
    throw new Error('Not authenticated');
  }
  return currentUser;
}

export function setCurrentUser(user: { id: string } | null) {
  currentUser = user;
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
  // For single-user app, always use the same user ID
  setCurrentUser({ id: 'test-user-1' });
  await next();
});

// Mount route handlers with the shared currentUser helper
app.route('/api/auth', authRoutes);
app.route('/api/assessment', assessmentRoutes);
app.route('/api/learning', learningRoutes);
app.route('/api/memorization', memorizationRoutes);
app.route('/api/progress', progressRoutes);
app.route('/api/tajweed', tajweedRoutes);
app.route('/api/grammar', grammarRoutes);
app.route('/api/tutor', tutorRoutes);
app.route('/api/certificate', certificateRoutes);

export default app;
