// Single-user bearer token authentication
// Token set via Workers environment variable (API_TOKEN)

const API_TOKEN = (env as { API_TOKEN?: string }).API_TOKEN || 'dev-token-change-in-production';

export function verifyAuth(headers: Headers): { valid: boolean; userId: string } {
  const auth = headers.get('authorization');
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    return { valid: false, userId: '' };
  }
  return { valid: true, userId: 'fouad' }; // Single user ID for self-hosted
}
