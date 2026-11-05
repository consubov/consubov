import { InMemoryLedger, CommandLogFilter } from '../ledger/in-memory-ledger';
import { authenticateRequest } from '../auth/middleware';

export async function handleAdminAuditRequest(
  req: Request,
  ledger: InMemoryLedger
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 1. Autenticação Bearer (Fail-Closed 401)
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return auth.response;
  }

  const claims = auth.claims;

  // 2. Autorização RBAC: Apenas perfil administrador ou roles administrativas (Fail-Closed 403)
  const hasAdminProfile = claims.profile_id === 'administrador';
  const hasAdminRole = Array.isArray((claims as any).roles) &&
    (claims as any).roles.some((r: string) => ['super_admin', 'support_admin', 'financial_admin'].includes(r));

  if (!hasAdminProfile && !hasAdminRole) {
    return new Response(
      JSON.stringify({
        error: 'FORBIDDEN',
        message: 'Acesso negado: apenas operadores administrativos globais podem consultar o ledger de auditoria.'
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Extração dos parâmetros de busca
  const url = new URL(req.url);
  const filter: CommandLogFilter = {};

  const tenantId = url.searchParams.get('tenant_id');
  if (tenantId) filter.tenant_id = tenantId;

  const userId = url.searchParams.get('user_id');
  if (userId) filter.user_id = userId;

  const profileId = url.searchParams.get('profile_id');
  if (profileId) filter.profile_id = profileId;

  const commandType = url.searchParams.get('command_type');
  if (commandType) filter.command_type = commandType;

  const startDate = url.searchParams.get('start_date');
  if (startDate) filter.start_date = startDate;

  const endDate = url.searchParams.get('end_date');
  if (endDate) filter.end_date = endDate;

  const status = url.searchParams.get('status');
  if (status) filter.status = status;

  // 4. Consulta ao ledger
  const logs = ledger.queryLogs(filter);

  return new Response(
    JSON.stringify({
      total: logs.length,
      logs
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
