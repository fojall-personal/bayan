// Single-user bearer token authentication
// Token set via Workers environment variable (API_TOKEN)

export function verifyAuth(headers: Headers): { valid: boolean; userId: string } {
  const API_TOKEN = process.env.API_TOKEN || 'dev-token-change-in-production';
  const auth = headers.get('authorization');
  if (!auth || auth !== `Bearer ${API_TOKEN}`) {
    return { valid: false, userId: '' };
  }
  return { valid: true, userId: 'test-user-1' }; // Test user ID
}
