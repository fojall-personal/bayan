/**
 * Coverage for the Access-JWT auth mode (plan §4) — the mode production
 * actually runs in, per AGENTS.md, but every other test in this suite runs
 * in shared-bearer-token mode via harness()/helpers/harness.ts, so
 * verifyAccessJwt() (workers/src/lib/identity.ts) and the Access branch of
 * the auth middleware (workers/src/index.ts) had zero coverage.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { accessHarness, type AccessHarness } from './helpers/harness';

let h: AccessHarness | null = null;
afterEach(() => {
  h?.close();
  h = null;
});
const H = async () => (h ??= await accessHarness());

describe('Access-JWT auth mode', () => {
  it('a valid Access JWT resolves the caller and reports access mode', async () => {
    const harness = await H();
    const token = await harness.signToken('friend@example.com');
    const { status, body } = await harness.json<{
      data: { userId: string; email: string; mode: string };
    }>('/api/auth/whoami', {
      headers: { 'cf-access-jwt-assertion': token },
    });

    expect(status).toBe(200);
    expect(body.data.email).toBe('friend@example.com');
    expect(body.data.mode).toBe('access');
    expect(body.data.userId).toBeTruthy();
  });

  it('a request with no assertion is rejected with 401', async () => {
    const harness = await H();
    const { status } = await harness.json('/api/auth/whoami');
    expect(status).toBe(401);
  });

  it('a JWT signed by the wrong key is rejected with 401', async () => {
    const harness = await H();
    // A syntactically well-formed but unsigned-by-our-JWKS token — three
    // base64url segments, none of which verify against the mocked keyset.
    const forged = 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6ImV2aWxAZXhhbXBsZS5jb20ifQ.forged-signature';
    const { status } = await harness.json('/api/auth/whoami', {
      headers: { 'cf-access-jwt-assertion': forged },
    });
    expect(status).toBe(401);
  });

  it('a JWT with the wrong audience is rejected with 401', async () => {
    const harness = await H();
    const token = await harness.signToken('friend@example.com', { aud: 'some-other-app' });
    const { status } = await harness.json('/api/auth/whoami', {
      headers: { 'cf-access-jwt-assertion': token },
    });
    expect(status).toBe(401);
  });

  it('a valid JWT presented as the CF_Authorization cookie also works', async () => {
    const harness = await H();
    const token = await harness.signToken('cookie@example.com');
    const { status, body } = await harness.json<{ data: { email: string } }>(
      '/api/auth/whoami',
      { headers: { Cookie: `CF_Authorization=${token}` } }
    );
    expect(status).toBe(200);
    expect(body.data.email).toBe('cookie@example.com');
  });

  it('the same e-mail across two requests resolves to the same userId', async () => {
    const harness = await H();
    const token = await harness.signToken('repeat@example.com');
    const first = await harness.json<{ data: { userId: string } }>('/api/auth/whoami', {
      headers: { 'cf-access-jwt-assertion': token },
    });
    const second = await harness.json<{ data: { userId: string } }>('/api/auth/whoami', {
      headers: { 'cf-access-jwt-assertion': token },
    });
    expect(first.body.data.userId).toBe(second.body.data.userId);
  });
});
