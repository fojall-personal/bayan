// Single entry point for every call to the Workers API.
//
// The frontend ships as a static export on Cloudflare Pages, so there is no
// server to proxy /api/* — relative paths resolve against the Pages origin and
// return the 404 page. Every request must name the Worker explicitly.
//
// Both values are inlined at build time by Next (NEXT_PUBLIC_*), so they have to
// be present in the build environment, not the runtime one. See
// .github/workflows/deploy.yml.
//
// Note: NEXT_PUBLIC_API_TOKEN is shipped in the JS bundle and is therefore
// readable by anyone who loads the page. It gates casual access to a
// single-user self-hosted deployment; it is not a secret.

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

function assertConfigured(path: string): void {
  const missing: string[] = [];
  if (!API_BASE) missing.push('NEXT_PUBLIC_API_URL');
  if (!API_TOKEN) missing.push('NEXT_PUBLIC_API_TOKEN');
  if (missing.length) {
    throw new ApiConfigError(
      `Cannot call ${path}: ${missing.join(' and ')} missing from this build. ` +
        'Set them in the build environment and redeploy.'
    );
  }
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
  headers.set('Authorization', `Bearer ${API_TOKEN}`);
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
