// Single entry point for every call to the API.
//
// The API is served from the same origin as the site: a _worker.js at the root
// of the Pages output routes /api/* into the Hono app and everything else to
// static assets (workers/src/pages-entry.ts). So NEXT_PUBLIC_API_URL is
// normally EMPTY and requests are relative.
//
// Set NEXT_PUBLIC_API_URL only to point at a Worker on a different origin — a
// standalone `wrangler dev` during development, for instance. In that case CORS
// applies and the origin must be listed in ALLOWED_ORIGINS.
//
// NEXT_PUBLIC_* values are inlined at build time, so they must be present in the
// build environment, not the runtime one. See .github/workflows/deploy.yml.
//
// Note: NEXT_PUBLIC_API_TOKEN ships in the JS bundle and is readable by anyone
// who loads the page. It gates casual access to a self-hosted deployment; it is
// not a secret, and Cloudflare Access replaces it (plan §4).

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the build did not receive NEXT_PUBLIC_API_URL / _TOKEN. */
export class ApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigError';
  }
}

function assertConfigured(_path: string): void {
  // Nothing to assert any more.
  //
  // Under Cloudflare Access there is no token to ship: Access authenticates at
  // the edge and the Worker reads identity from the signed assertion, ignoring
  // the Authorization header entirely (workers/src/index.ts). Requiring a token
  // here would break every call on a correctly configured deployment.
  //
  // A missing token used to be worth shouting about because it meant a broken
  // build. Now its ABSENCE is the desired state — the token previously shipped
  // inside this bundle, readable by anyone who loaded the page.
}

/**
 * Call the Workers API and return the parsed JSON body.
 *
 * Throws ApiConfigError when the build is misconfigured and ApiError on any
 * non-2xx response, so callers can render a real message instead of silently
 * rendering nothing.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  assertConfigured(path);

  const headers = new Headers(init.headers);
  // Only when a token is actually present. Under Access this is empty and the
  // header is omitted, rather than sending a literal "Bearer undefined".
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) detail = body.error;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiError(detail, res.status, path);
  }

  return (await res.json()) as T;
}

/** Convenience wrapper for `POST` with a JSON body. */
export function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

/** Human-readable message for any error thrown by apiFetch. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiConfigError) return err.message;
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Not authorized — check the API token.';
    if (err.status === 404) return `Not found: ${err.path}`;
    return `Request failed (${err.status}): ${err.message}`;
  }
  return 'Could not reach the API. Check your connection and try again.';
}
