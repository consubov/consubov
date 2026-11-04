import {
  SYNTHETIC_USERS,
  LAB_DEFAULT_PASSWORD,
  signSyntheticJwt,
  SyntheticJwtClaims,
  SYNTHETIC_JWT_SECRET_LAB
} from '@consubov/auth-client';

export async function handleAuthRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: 'INVALID_JSON',
          message: 'Corpo da requisição deve ser um JSON válido.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const email = body.email || body.username;
    if (!email) {
      return new Response(
        JSON.stringify({
          error: 'MISSING_CREDENTIALS',
          message: 'Campo email é obrigatório para autenticação.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userRecord = SYNTHETIC_USERS[email];
    if (!userRecord) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Credenciais inválidas: usuário sintético não localizado.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const providedPassword = body.password ?? LAB_DEFAULT_PASSWORD;
    if (providedPassword !== userRecord.password_hash) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Credenciais inválidas: senha incorreta.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const activeMemberships = userRecord.memberships.filter(m => m.is_active);
    if (activeMemberships.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'FORBIDDEN',
          message: 'ACESSO_NEGADO_403: Usuário não possui vínculos ativos no sistema.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Se fornecido membership_id específico ou se houver vínculo
    const chosenMembership = body.membership_id
      ? activeMemberships.find(m => m.membership_id === body.membership_id)
      : activeMemberships[0]!;

    if (!chosenMembership) {
      return new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED_CONTEXT',
          message: 'Vínculo selecionado não pertence ao usuário ou está inativo.'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = 86400; // 24h

    const claims: SyntheticJwtClaims = {
      sub: userRecord.user_id,
      iss: 'consubov:auth:local',
      aud: 'consubov:platform:api',
      iat: now,
      exp: now + ttl,
      user_id: userRecord.user_id,
      email: userRecord.email,
      name: userRecord.name,
      tenant_id: chosenMembership.tenant_id,
      fazenda_id: chosenMembership.fazenda_id,
      retiro_id: chosenMembership.retiro_id,
      product_id: 'consubov',
      device_id: userRecord.device_id,
      session_id: `sess-${userRecord.user_id}-${now}`,
      profile_id: chosenMembership.profile_id,
      roles: [chosenMembership.profile_id],
      permissions: []
    };

    const token = await signSyntheticJwt(claims, SYNTHETIC_JWT_SECRET_LAB, {
      expiresInSeconds: ttl
    });

    return new Response(
      JSON.stringify({
        token,
        token_type: 'Bearer',
        expires_in: ttl,
        user: {
          id: userRecord.user_id,
          email: userRecord.email,
          name: userRecord.name,
          primary_profile: chosenMembership.profile_id
        },
        context: {
          tenant_id: chosenMembership.tenant_id,
          fazenda_id: chosenMembership.fazenda_id,
          profile_id: chosenMembership.profile_id
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'NOT_FOUND', message: 'Rota de autenticação não encontrada.' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
