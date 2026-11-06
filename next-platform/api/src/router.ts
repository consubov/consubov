import { InMemoryLedger } from './ledger/in-memory-ledger';
import { LabGrantRegistry } from './auth/grants';
import { handleHealthRequest } from './handlers/health';
import { handleCommandsRequest } from './handlers/commands';
import { handleAuthRequest } from './handlers/auth';
import { handleSyncRequest } from './handlers/sync';
import { handleAttachmentRequest } from './handlers/attachments';
import { handleAdminAuditRequest } from './handlers/audit';
export function createRouter(ledger: InMemoryLedger, grants: LabGrantRegistry = new LabGrantRegistry()) {
  return async function router(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Attachment-Sha256, X-Attachment-Size, X-Attachment-Local-Ref'
    } });
    let response: Response;
    const attachment = /^\/api\/v1\/attachments\/([^/]+)$/.exec(url.pathname);
    if (url.pathname === '/api/v1/health') response = handleHealthRequest();
    else if (url.pathname === '/api/v1/commands') response = await handleCommandsRequest(req, ledger, grants);
    else if (url.pathname === '/api/v1/auth/login') response = await handleAuthRequest(req, ledger, grants);
    else if (url.pathname === '/api/v1/sync') response = await handleSyncRequest(req, ledger, grants);
    else if (attachment) response = await handleAttachmentRequest(req, attachment[1]!, ledger, grants);
    else if (url.pathname === '/api/v1/admin/audit') response = await handleAdminAuditRequest(req, ledger, grants);
    else response = new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
}
