// Per-user identity from Cloudflare Access.
//
// Why Access rather than hand-written auth (plan §4): the audience is a small
// group of friends. Access is free to 50 seats, handles login itself (Google,
// GitHub, or one-time e-mail PIN), and stores no passwords. Adding someone is
// adding an address to a policy.
//
// Access sits in front of the origin and attaches a signed JWT to every request
// in the `Cf-Access-Jwt-Assertion` header. It also sets
// `Cf-Access-Authenticated-User-Email`, but that header is NOT trustworthy on
// its own — anything that can reach the origin directly could forge it. Only the
// verified JWT decides who the caller is.

import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Context } from 'hono';
import type { AppEnv } from './context';
import { getDb } from './db';

export interface Identity {
  /** Stable internal key. Survives an e-mail change. */
  userId: string;
  email: string;
}

/**
 * JWKS fetches are cached per team domain for the lifetime of the isolate. jose
 * also caches and honours the endpoint's cache headers, so this does not fetch
 * per request.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`)
    );
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

export class IdentityError extends Error {}

/**
 * Verify the Access JWT and return the caller's e-mail.
 *
 * Throws IdentityError when the assertion is absent, unsigned by the team's
 * keys, expired, or issued for a different application.
 */
export async function verifyAccessJwt(
  token: string,
  teamDomain: string,
  audience: string
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience,
    });

    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!email) throw new IdentityError('Access token carries no e-mail claim');
    return email.toLowerCase();
  } catch (err) {
    if (err instanceof IdentityError) throw err;
    throw new IdentityError(
      `Access token rejected: ${(err as Error).message}`
    );
  }
}

/**
 * Map a verified e-mail to a user row, creating it on first sight.
 *
 * Provisioning is just-in-time because there is no sign-up flow — the Access
 * policy is the invite list. `id` stays an opaque key so that changing an
 * address does not orphan someone's progress.
 */
export async function resolveUser(
  c: Context<AppEnv>,
  email: string
): Promise<Identity> {
  const db = getDb(c);

  const existing = await db.get<{ id: string }>(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  );
  if (existing) return { userId: existing.id, email };

  const id = crypto.randomUUID();

  // INSERT OR IGNORE, not ON CONFLICT(email).
  //
  // The unique index on this column is PARTIAL:
  //   CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL
  // and SQLite refuses a partial index as an ON CONFLICT target, raising
  // "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".
  //
  // That threw on every single /api/* request the moment Access was switched on,
  // because this function runs in the auth middleware and its exception surfaced
  // as a bare 500. It had never fired before: Access mode had never actually
  // been active, so no request had ever reached this line.
  //
  // OR IGNORE honours a partial index and gives the same semantics — skip the
  // insert when the address is already present.
  await db.run(
    `INSERT OR IGNORE INTO users (id, email, goal, onboarding_completed, current_path)
     VALUES (?, ?, 'all', 0, 'path1')`,
    [id, email]
  );

  // Re-read rather than trusting the insert: a concurrent first request for the
  // same address would have lost the race, and OR IGNORE made that a no-op.
  const row = await db.get<{ id: string }>(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  );
  if (!row) throw new IdentityError(`Could not provision a user for ${email}`);
  return { userId: row.id, email };
}
