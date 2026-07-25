import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './lib/context';
import { SINGLE_USER_ID } from './lib/context';
import { authRoutes } from './routes/auth';
import { assessmentRoutes } from './routes/assessment';
import { learningRoutes } from './routes/learning';
import { memorizationRoutes } from './routes/memorization';
import { progressRoutes } from './routes/progress';
import { tajweedRoutes } from './routes/tajweed';
import { grammarRoutes } from './routes/grammar';
import { tutorRoutes } from './routes/tutor';
import { certificateRoutes } from './routes/certificate';

const app = new Hono<AppEnv>();

/** Origins allowed when ALLOWED_ORIGINS is not set. */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://languagebuilder-frontend.pages.dev',
  'http://localhost:3000',
];

// Health check — public, no auth. Used to verify the Worker is reachable.
app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// CORS must run before auth so preflight requests are answered rather than
// rejected with 401. The frontend is a static export on a different origin, so
// every authorized request is preceded by an OPTIONS preflight.
app.use('/api/*', (c, next) => {
  const configured = c.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowed = configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;

  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })(c, next);
});

// Auth — all /api/* routes require the shared bearer token.
app.use('/api/*', async (c, next) => {
  const expected = c.env.API_TOKEN;

  // Fail closed. An unset token previously fell back to a literal published in
  // the README, which meant a misconfigured deploy was silently world-readable.
  if (!expected) {
    console.error('API_TOKEN is not configured for this Worker');
    return c.json({ error: 'Server misconfigured' }, 500);
  }

  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${expected}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('userId', SINGLE_USER_ID);
  await next();
});

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
