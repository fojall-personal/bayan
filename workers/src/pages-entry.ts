/**
 * Entry point for Cloudflare Pages "advanced mode": a single _worker.js at the
 * root of the build output that handles every request — /api/* through the Hono
 * app, everything else from the static assets binding.
 *
 * Why one origin (docs/APPLICATION-PLAN-v2.md §5, Change 1): Cloudflare Access
 * cookies are per-hostname. With the site on pages.dev and the API on
 * workers.dev, a single logged-in session cannot span both without a custom
 * domain, which costs money. Access can protect *.pages.dev, so collapsing to
 * one origin buys per-user identity for free — and drops CORS and the bearer
 * token in the JS bundle as a side effect.
 *
 * Bundled from this package rather than from a root-level functions/ directory
 * so that hono resolves to exactly one copy. A root install produced a second
 * copy whose Hono<Env> types were structurally incompatible with this one's.
 */

import app from './index';
import type { AppEnv } from './lib/context';

type PagesEnv = AppEnv['Bindings'] & {
  /** Static assets binding, injected by Pages in advanced mode. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

export default {
  async fetch(request: Request, env: PagesEnv, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/health' || pathname.startsWith('/api/')) {
      return app.fetch(request, env as unknown as AppEnv['Bindings'], ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
