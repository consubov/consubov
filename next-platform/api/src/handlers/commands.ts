import {
  atomicCommandEnvelopeSchema,
  isAllowedCommand,
  isProfileAuthorizedForCommand,
  validateCommandPayload,
  AtomicCommandEnvelope
} from '@consubov/contracts';
import { InMemoryLedger } from '../ledger/in-memory-ledger';
import { authenticateRequest } from '../auth/middleware';

export async function handleCommandsRequest(
  req: Request,
  ledger: InMemoryLedger
): Promise<Response> {
  // 1. Método HTTP
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Parse do Corpo da Requisição
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: 'INVALID_JSON',
        message: 'O corpo da requisição não é um JSON válido.'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 3. Checagem prévia da allowlist se o campo command_type existir
  if (body && typeof body === 'object' && 'command_type' in body) {
    const cmdType = String((body as Record<string, unknown>).command_type);
    if (!isAllowedCommand(cmdType)) {
      return new Response(
        JSON.stringify({
          error: 'COMMAND_NOT_ALLOWED',
          message: `O comando '${cmdType}' não consta na allowlist de comandos permitidos da API.`
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 4. Barreira de Autenticação Bearer (Fail-Closed 401)
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    return auth.response;
  }
  const claims = auth.claims;

  // 5. Validação Zod da Estrutura do Envelope Atômico (Fail-Closed 400)
  const validationResult = atomicCommandEnvelopeSchema.safeParse(body);
  if (!validationResult.success) {
    return new Response(
      JSON.stringify({
        error: 'VALIDATION_FAILED',
        message: 'Envelope rejeitado na barreira de schemas Zod',
        issues: validationResult.error.issues
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const envelope = validationResult.data as unknown as AtomicCommandEnvelope;

  // 6. Anti-Spoofing de Contexto e Perfil (Fail-Closed 403)
  if (claims.tenant_id !== envelope.tenant_id) {
    return new Response(
      JSON.stringify({
        error: 'CONTEXT_MISMATCH',
        message: `Violação de isolamento multi-tenant: o tenant_id do token (${claims.tenant_id}) diverge do envelope (${envelope.tenant_id}).`,
        token_tenant_id: claims.tenant_id,
        envelope_tenant_id: envelope.tenant_id
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (claims.profile_id !== envelope.profile_id) {
    return new Response(
      JSON.stringify({
        error: 'PROFILE_MISMATCH',
        message: `Violação de perfil: o profile_id do token (${claims.profile_id}) diverge do envelope (${envelope.profile_id}).`,
        token_profile_id: claims.profile_id,
        envelope_profile_id: envelope.profile_id
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 7. Matriz RBAC Declarativa por Perfil (Fail-Closed 403)
  if (!isProfileAuthorizedForCommand(claims.profile_id, envelope.command_type)) {
    return new Response(
      JSON.stringify({
        error: 'FORBIDDEN_COMMAND',
        message: `O perfil '${claims.profile_id}' não possui autorização para executar o comando '${envelope.command_type}'.`,
        profile_id: claims.profile_id,
        command_type: envelope.command_type
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 8. Validação Zod do Payload de Domínio Específico (Fail-Closed 400)
  const domainValidation = validateCommandPayload(envelope.command_type, envelope.payload);
  if (!domainValidation.success) {
    return new Response(
      JSON.stringify({
        error: 'INVALID_DOMAIN_PAYLOAD',
        message: `O payload fornecido viola as regras de validação de domínio do comando '${envelope.command_type}'.`,
        command_type: envelope.command_type,
        issues: domainValidation.errors
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 9. Processamento no Ledger Multi-Tenant & OCC (Fail-Closed 409)
  const processResult = ledger.processCommand(envelope);

  if (!processResult.success) {
    return new Response(JSON.stringify(processResult.error), {
      status: processResult.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(processResult.ack), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
