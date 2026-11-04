import {
  atomicCommandEnvelopeSchema,
  isAllowedCommand,
  AtomicCommandEnvelope
} from '@consubov/contracts';
import { InMemoryLedger } from '../ledger/in-memory-ledger';

export async function handleCommandsRequest(
  req: Request,
  ledger: InMemoryLedger
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

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

  // 1. Checagem prévia da allowlist se o campo command_type existir
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

  // 2. Validação Zod do Envelope
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

  // 3. Processamento no Ledger em Memória (Idempotência e OCC)
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
