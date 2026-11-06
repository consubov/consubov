import { atomicCommandEnvelopeSchema, isProfileAuthorizedForCommand, validateCommandPayload, type CommandApiResponse } from '@consubov/contracts';
import { InMemoryLedger } from '../ledger/in-memory-ledger';
import { authenticateRequest } from '../auth/middleware';
import { LabGrantRegistry } from '../auth/grants';

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
export async function handleCommandsRequest(req: Request, ledger: InMemoryLedger, grants: LabGrantRegistry): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) return auth.response;
  let body: unknown;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > 1024 * 1024) return json({ error: 'REQUEST_TOO_LARGE' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: 'INVALID_JSON' }, 400); }
  const parsed = atomicCommandEnvelopeSchema.safeParse(body);
  const commandId = body && typeof body === 'object' && 'command_id' in body && typeof body.command_id === 'string' && body.command_id.trim() ? body.command_id : 'unknown';
  const invalid = (code: string, field: string, message: string) => json({ success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: commandId, violations: [{ code, field, message }] } } satisfies CommandApiResponse, 422);
  if (!parsed.success) return invalid('INVALID_ENVELOPE', 'envelope', 'Command envelope validation failed.');
  const command = parsed.data;
  if ([command.command_id, command.aggregate_id, command.correlation_id].some(id => !id.trim() || id.length > 128)) return invalid('INVALID_IDENTIFIER', 'envelope', 'Command and aggregate identifiers must be 1..128 characters.');
  if (!grants.check(auth.claims, 'sync.push') || !grants.matches(auth.claims, command) || !isProfileAuthorizedForCommand(auth.claims.profile_id, command.command_type)) {
    return json({ success: false, security: { error: 'FORBIDDEN_403', command_id: command.command_id, reason: 'Active grant does not authorize this command context.', required_capability: 'sync.push' } } satisfies CommandApiResponse, 403);
  }
  if (command.schema_version !== 1) return invalid('UNSUPPORTED_SCHEMA', 'schema_version', 'Only implemented payload schema version 1 is accepted.');
  for (const field of ['user_id', 'tenant_id', 'fazenda_id', 'retiro_id', 'product_id', 'profile_id', 'device_id'] as const) {
    if (field in command.payload && command.payload[field] !== command[field]) return json({ success: false, security: { error: 'FORBIDDEN_403', command_id: command.command_id, reason: 'Domain payload scope differs from the authenticated context.' } } satisfies CommandApiResponse, 403);
  }
  const validated = validateCommandPayload(command.command_type, command.payload);
  if (!validated.success) return json({ success: false, validation: { error: 'UNPROCESSABLE_ENTITY_422', command_id: command.command_id,
    violations: validated.errors.slice(0, 100).map(issue => ({ field: (issue.path.join('.') || 'payload').slice(0, 128), code: 'INVALID_DOMAIN_PAYLOAD', message: `${issue.code}: ${issue.message}`.slice(0, 500) }))
  } } satisfies CommandApiResponse, 422);
  // No await between the final grant check and the ledger's atomic in-memory commit.
  if (!grants.check(auth.claims, 'sync.push')) return json({ error: 'GRANT_REVOKED' }, 403);
  const result = ledger.processCommand(command);
  return result.success ? json({ success: true, ack: result.ack }, 200) : json(result.error, result.status);
}
