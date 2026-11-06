import { syncPullRequestSchema } from '@consubov/contracts';
import { authenticateRequest } from '../auth/middleware';
import { LabGrantRegistry } from '../auth/grants';
import { InMemoryLedger } from '../ledger/in-memory-ledger';
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export async function handleSyncRequest(req: Request, ledger: InMemoryLedger, grants: LabGrantRegistry): Promise<Response> {
  if (req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) return auth.response;
  if (!grants.check(auth.claims, 'sync.pull')) return json({ error: 'FORBIDDEN', message: 'Active sync.pull grant required.' }, 403);
  const query = new URL(req.url).searchParams;
  if ([...query.keys()].some(key => !['tenant_id', 'fazenda_id', 'profile_id', 'since_cursor', 'limit'].includes(key)) || [...query.keys()].some(key => query.getAll(key).length !== 1)) return json({ error: 'INVALID_QUERY' }, 400);
  const parsed = syncPullRequestSchema.safeParse({ tenant_id: query.get('tenant_id'), fazenda_id: query.get('fazenda_id'), profile_id: query.get('profile_id'), since_cursor: query.get('since_cursor'), ...(query.has('limit') ? { limit: Number(query.get('limit')) } : {}) });
  if (!parsed.success) return json({ error: 'INVALID_QUERY' }, 400);
  const input = parsed.data, claims = auth.claims;
  if (input.tenant_id !== claims.tenant_id || input.fazenda_id !== claims.fazenda_id || input.profile_id !== claims.profile_id) return json({ error: 'CONTEXT_MISMATCH' }, 403);
  const response = ledger.pull(claims, input.since_cursor, input.limit ?? 100);
  return response ? json(response, 200) : json({ error: 'INVALID_CURSOR', message: 'Cursor is unknown, belongs to another session or expired with this laboratory process.' }, 400);
}
