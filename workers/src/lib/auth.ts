// Single-user bearer token authentication
// Token set via Workers environment variable (API_TOKEN)

export function verifyAuth(headers: Headers): { valid: boolean; userId: string } {
  const API_TOKEN = (headers.get('x-api-token') || 'dev-token-change-in-production');
  const auth = headers.get('authorization');
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    return { valid: false, userId: '' };
  }
  return { valid: true, userId: 'fouad' }; // Single user ID for self-hosted
}
