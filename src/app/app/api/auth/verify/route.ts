// Client-side auth token check
// Used by frontend to verify API connectivity and auth setup

export async function GET() {
  try {
    const token = process.env.NEXT_PUBLIC_API_TOKEN || 'dev-token';

    const res = await fetch('http://localhost:8787/health', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return Response.json(
        { error: 'API not reachable', status: res.status },
        { status: res.status }
      );
    }

    return Response.json({ data: await res.json() });
  } catch (error) {
    return Response.json(
      { error: 'Failed to reach API server' },
      { status: 500 }
    );
  }
}
