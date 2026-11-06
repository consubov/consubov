import { InMemoryLedger, CommandLogFilter } from '../ledger/in-memory-ledger';
import { authenticateRequest } from '../auth/middleware';
import { LabGrantRegistry } from '../auth/grants';

export async function handleAdminAuditRequest(
  req: Request,
  ledger: InMemoryLedger,
  grants: LabGrantRegistry
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

  // Global audit requires the current server grant; caller roles alone cannot authorize it.
  const hasAdminProfile = claims.profile_id === 'administrador';

  if (!hasAdminProfile || !grants.check(claims, 'audit:view')) {
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
