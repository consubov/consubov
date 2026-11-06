import { describe, expect, it } from 'vitest';
import { createUserErrorMessage } from './edgeFunctionUserError';

function httpError(status: number, body: unknown): unknown {
  return { context: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) };
}

describe('manager user provisioning errors', () => {
  it('identifies existing email without generic Edge error', async () => {
    expect(await createUserErrorMessage(httpError(400, { error: 'Este e-mail já está cadastrado' })))
      .toContain('e-mail exclusivo');
  });
  it.each([[401, 'sessão expirou'], [403, 'não tem permissão'], [409, 'já existente'], [429, 'Muitas tentativas']])(
    'safely handles HTTP %i', async (status, part) => {
      expect(await createUserErrorMessage(httpError(status as number, {}))).toContain(part);
    },
  );
  it('explains that an email is linked to an existing profile', async () => {
    expect(await createUserErrorMessage(httpError(400, { error: 'Este e-mail já está vinculado a outro perfil' })))
      .toContain('vinculado a outro perfil');
  });

  it('does not expose raw server messages', async () => {
    const msg = await createUserErrorMessage(httpError(500, { error: 'internal sensitive detail' }));
    expect(msg).not.toContain('sensitive detail');
  });
  it('does not echo network error messages', async () => {
    expect(await createUserErrorMessage(new Error('private url'))).not.toContain('private url');
  });
});
