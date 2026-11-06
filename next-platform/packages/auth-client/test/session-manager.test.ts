import { describe, it, expect } from 'bun:test';
import { SessionManager } from '../src/session/session-manager';
import { InMemorySessionStorage } from '../src/storage/session-storage';
import { buildPartitionKey, parsePartitionKey } from '../src/storage/partition';
import { SyntheticUserSession, AuthorizedContext } from '../src/identity/context';

describe('Suíte Unitária: SessionManager e Chave de Partição Única', () => {
  const fakeContext: AuthorizedContext = {
    context_id: 'tenant-1:fazenda-1:gerente',
    tenant_id: 'tenant-1',
    tenant_nome: 'Fazenda Lab',
    product_id: 'consubov',
    fazenda_id: 'fazenda-1',
    fazenda_nome: 'Sede',
    retiro_id: 'retiro-1',
    retiro_nome: 'Retiro 1',
    profile_id: 'gerente',
    capabilities: ['analytics:view']
  };

  const fakeSession: SyntheticUserSession = {
    session_id: 'sess-123',
    user_id: 'user-456',
    user_name: 'Usuário Teste',
    user_email: 'user@consubov.local',
    profile_id: 'gerente',
    memberships: [],
    active_context: fakeContext,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    device_id: 'dev-789'
  };

  it('deve calcular chave de partição canônica no formato tenant:user:fazenda:profile', () => {
    const key = buildPartitionKey('tenant-1', 'user-456', 'fazenda-1', 'gerente');
    expect(key).toBe('tenant-1:user-456:fazenda-1:gerente');

    const parsed = parsePartitionKey(key);
    expect(parsed?.tenantId).toBe('tenant-1');
    expect(parsed?.userId).toBe('user-456');
    expect(parsed?.fazendaId).toBe('fazenda-1');
    expect(parsed?.profileId).toBe('gerente');
  });

  it('deve retornar chave unauthenticated quando não há sessão ou contexto ativo', () => {
    const sm = new SessionManager();
    expect(sm.getPartitionKey()).toBe('unauthenticated');
  });

  it('deve retornar chave de partição calculada para a sessão ativa', () => {
    const sm = new SessionManager({ initialSession: fakeSession });
    expect(sm.getPartitionKey()).toBe('tenant-1:user-456:fazenda-1:gerente');
  });

  it('deve persistir no storage e restaurar sessão com sucesso', () => {
    const storage = new InMemorySessionStorage();
    const sm1 = new SessionManager({ initialSession: fakeSession, storage });
    const partitionKey = sm1.getPartitionKey();

    const sm2 = new SessionManager({ storage });
    const restored = sm2.restoreFromStorage(partitionKey);

    expect(restored).toBe(true);
    expect(sm2.getSession()?.user_id).toBe('user-456');
    expect(sm2.getActiveContext()?.profile_id).toBe('gerente');
  });

  it('recusa sessão expirada ou com datas inválidas sem restaurar tokens', () => {
    for (const expires_at of ['invalid-date', new Date(Date.now() - 1000).toISOString()]) {
      const storage = new InMemorySessionStorage();
      const persisted = new SessionManager({ initialSession: { ...fakeSession, expires_at }, storage });
      const restored = new SessionManager({ storage });
      expect(restored.restoreFromStorage(persisted.getPartitionKey())).toBe(false);
      expect(restored.getSession()).toBeNull();
      expect(restored.getTokens()).toBeNull();
    }
  });

  it('deve notificar listeners ao atualizar sessão', () => {
    const sm = new SessionManager();
    let notifiedSession: SyntheticUserSession | null = null;
    const unsub = sm.subscribe(s => {
      notifiedSession = s;
    });

    sm.setSession(fakeSession);
    expect(notifiedSession).not.toBeNull();
    expect(notifiedSession?.user_id).toBe('user-456');

    sm.clearSession();
    expect(notifiedSession).toBeNull();
    unsub();
  });
});
