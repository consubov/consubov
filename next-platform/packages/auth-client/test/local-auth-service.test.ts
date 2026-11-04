import { describe, it, expect } from 'bun:test';
import { LocalAuthService } from '../src/service/local-auth-service';
import { InMemorySessionStorage } from '../src/storage/session-storage';
import { verifySyntheticJwt } from '../src/jwt/synthetic-jwt';

describe('Suíte Unitária: LocalAuthService (Ciclo de Vida Offgrid)', () => {
  it('deve realizar login de gerente e exigir seleção explícita de contexto (ISO-004)', async () => {
    const storage = new InMemorySessionStorage();
    const service = new LocalAuthService({ storage });

    const result = await service.login({ email: 'gerente.lab@consubov.local' });
    expect(result.success).toBe(true);
    expect(result.requires_context_selection).toBe(true);
    expect(result.session?.active_context).toBeNull();
    expect(result.available_memberships?.length).toBe(1);

    // Seleção de contexto consciente
    const selectResult = await service.selectContext(result.available_memberships![0].membership_id);
    expect(selectResult.success).toBe(true);
    expect(selectResult.requires_context_selection).toBe(false);
    expect(selectResult.session?.active_context?.profile_id).toBe('gerente');
    expect(selectResult.tokens).toBeDefined();

    // Validar token emitido
    const verifyResult = await verifySyntheticJwt(selectResult.tokens!.access_token);
    expect(verifyResult.valid).toBe(true);
    if (verifyResult.valid) {
      expect(verifyResult.payload.profile_id).toBe('gerente');
      expect(verifyResult.payload.user_id).toBe(result.session!.user_id);
    }
  });

  it('deve rejeitar credenciais inexistentes', async () => {
    const service = new LocalAuthService();
    const result = await service.login({ email: 'usuario.inexistente@consubov.local' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('não localizado');
  });

  it('deve rejeitar senha incorreta', async () => {
    const service = new LocalAuthService();
    const result = await service.login({
      email: 'gerente.lab@consubov.local',
      password: 'senha-errada-123'
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('senha incorreta');
  });

  it('deve rejeitar usuário inativo com 403', async () => {
    const service = new LocalAuthService();
    const result = await service.login({ email: 'inativo.lab@consubov.local' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ACESSO_NEGADO_403');
  });

  it('deve permitir switch de contexto para usuário multi-papel', async () => {
    const service = new LocalAuthService();
    const loginResult = await service.login({ email: 'multirole.lab@consubov.local' });
    expect(loginResult.success).toBe(true);
    expect(loginResult.available_memberships?.length).toBe(2);

    // Seleciona Gerente
    const ctx1 = await service.selectContext('mem-multi-01-gerente');
    expect(ctx1.session?.active_context?.profile_id).toBe('gerente');

    // Troca para Capataz
    const ctx2 = await service.switchContext('mem-multi-02-capataz');
    expect(ctx2.session?.active_context?.profile_id).toBe('capataz');
    expect(ctx2.tokens?.access_token).not.toBe(ctx1.tokens?.access_token);
  });

  it('deve renovar sessão offgrid via refreshSession', async () => {
    const service = new LocalAuthService();
    await service.login({ email: 'capataz.lab@consubov.local' });
    await service.selectContext('mem-capataz-01');

    const refreshResult = await service.refreshSession();
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.tokens).toBeDefined();
  });

  it('deve limpar sessão no logout', async () => {
    const service = new LocalAuthService();
    await service.login({ email: 'gerente.lab@consubov.local' });
    await service.selectContext('mem-gerente-01');

    expect(service.getSessionManager().getSession()).not.toBeNull();
    service.logout();
    expect(service.getSessionManager().getSession()).toBeNull();
    expect(service.getSessionManager().getPartitionKey()).toBe('unauthenticated');
  });
});
