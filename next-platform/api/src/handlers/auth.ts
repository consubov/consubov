export async function handleAuthRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Ignora erro de JSON
    }

    const username = body.username || 'gerente@teste.consubov.local';

    return new Response(
      JSON.stringify({
        token: `synthetic-jwt-token-for-${username}`,
        user: {
          id: 'user-lab-001',
          email: username,
          name: 'Usuário Sintético Lab'
        },
        expires_in: 86400
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ error: 'NOT_FOUND' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
