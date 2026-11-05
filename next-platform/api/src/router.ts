import { InMemoryLedger } from './ledger/in-memory-ledger';
import { handleHealthRequest } from './handlers/health';
import { handleCommandsRequest } from './handlers/commands';
import { handleAuthRequest } from './handlers/auth';
import { handleSyncRequest } from './handlers/sync';
import { handleAdminAuditRequest } from './handlers/audit';

export function createRouter(ledger: InMemoryLedger) {
  return async function router(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Tratamento de OPTIONS (CORS)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        }
      });
    }

    let response: Response;

    if (url.pathname === '/api/v1/health') {
      response = handleHealthRequest();
    } else if (url.pathname === '/api/v1/commands') {
      response = await handleCommandsRequest(req, ledger);
    } else if (url.pathname.startsWith('/api/v1/auth')) {
      response = await handleAuthRequest(req);
    } else if (url.pathname.startsWith('/api/v1/sync')) {
      response = await handleSyncRequest(req);
    } else if (url.pathname === '/api/v1/admin/audit') {
      response = await handleAdminAuditRequest(req, ledger);
    } else {
      response = new Response(
        JSON.stringify({
          error: 'NOT_FOUND',
          message: `Rota ${url.pathname} não encontrada.`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Injeta headers de CORS em todas as respostas
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  };
}
