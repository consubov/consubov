import { SyntheticJwtClaims, verifySyntheticJwt, SYNTHETIC_JWT_SECRET_LAB } from '@consubov/auth-client';

export type AuthResult =
  | { authenticated: true; claims: SyntheticJwtClaims }
  | { authenticated: false; response: Response };

/**
 * Middleware de Autenticação Bearer com Fail-Closed para a API Bun.
 * Rejeita qualquer requisição sem token válido com HTTP 401.
 */
export async function authenticateRequest(
  req: Request,
  secret: string = SYNTHETIC_JWT_SECRET_LAB
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Cabeçalho Authorization ausente ou com formato inválido. Esperado: Bearer <token>'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({
          error: 'UNAUTHORIZED',
          message: 'Token Bearer não fornecido após o prefixo.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  const verifyResult = await verifySyntheticJwt(token, secret);

  if (!verifyResult.valid) {
    if (verifyResult.error === 'TOKEN_EXPIRED') {
      return {
        authenticated: false,
        response: new Response(
          JSON.stringify({
            error: 'TOKEN_EXPIRED',
            message: 'Sessão expirada. Realize novo login sintético.',
            expired: true
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      };
    }

    return {
      authenticated: false,
      response: new Response(
        JSON.stringify({
          error: 'INVALID_TOKEN',
          message: 'Assinatura do token sintético inválida ou adulterada.'
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }

  return {
    authenticated: true,
    claims: verifyResult.payload
  };
}
