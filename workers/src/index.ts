import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './lib/context';
import { SINGLE_USER_ID } from './lib/context';
import { IdentityError, resolveUser, verifyAccessJwt } from './lib/identity';
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

// Auth. Two modes, and the choice is made by configuration rather than by a
// request header, so a caller cannot pick the weaker one.
//
//   Access mode  — ACCESS_TEAM_DOMAIN and ACCESS_AUD are set. Every request
//                  carries a signed Access JWT; each person gets their own
//                  user row. This is the mode production runs in (plan §4).
//   Token mode   — neither is set. One shared bearer token resolves every
//                  request to SINGLE_USER_ID. For local development only: the
//                  token ships in the JS bundle, so with more than one real
//                  user it would let any of them read any other's data.
app.use('/api/*', async (c, next) => {
  const teamDomain = c.env.ACCESS_TEAM_DOMAIN;
  const aud = c.env.ACCESS_AUD;

  if (teamDomain && aud) {
    const assertion = c.req.header('cf-access-jwt-assertion');
    if (!assertion) {
      // Reaching the origin without an assertion means the request did not come
      // through Access — either the application is misconfigured or something is
      // bypassing it. Either way, refuse.
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const email = await verifyAccessJwt(assertion, teamDomain, aud);
      const identity = await resolveUser(c, email);
      c.set('userId', identity.userId);
      c.set('userEmail', identity.email);
    } catch (err) {
      if (err instanceof IdentityError) {
        console.error(err.message);
        return c.json({ error: 'Unauthorized' }, 401);
      }
      console.error('Identity resolution failed:', err);
      return c.json({ error: 'Internal server error' }, 500);
    }

    return next();
  }

  const expected = c.env.API_TOKEN;

  // Fail closed. An unset token previously fell back to a literal published in
  // the README, which meant a misconfigured deploy was silently world-readable.
  if (!expected) {
    console.error('Neither Access (ACCESS_TEAM_DOMAIN + ACCESS_AUD) nor API_TOKEN is configured');
    return c.json({ error: 'Server misconfigured' }, 500);
  }

  if (c.req.header('authorization') !== `Bearer ${expected}`) {
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
