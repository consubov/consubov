import { describe, it, expect } from 'bun:test';
import {
  resolveActiveContext,
  ContextSelectionRequiredError,
  UnauthorizedContextError
} from '../src/selector/anti-first-match';
import { SyntheticUserSession } from '../src/identity/context';
import { SYNTHETIC_USERS } from '../src/fixtures/synthetic-users';

describe('Suíte Unitária: Resolução Anti-First-Match (ISO-004)', () => {
  const multiRoleUser = SYNTHETIC_USERS['multirole.lab@consubov.local'];

  const baseSession: SyntheticUserSession = {
    session_id: 'session-multi-01',
    user_id: multiRoleUser.user_id,
    user_name: multiRoleUser.name,
    user_email: multiRoleUser.email,
    memberships: multiRoleUser.memberships,
    active_context: null,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    device_id: multiRoleUser.device_id
  };

  it('deve lançar ContextSelectionRequiredError quando usuário multi-vínculo não informa contexto explícito', () => {
    expect(() => {
      resolveActiveContext(baseSession);
    }).toThrow(ContextSelectionRequiredError);

    try {
      resolveActiveContext(baseSession);
    } catch (err: any) {
      expect(err).toBeInstanceOf(ContextSelectionRequiredError);
      expect(err.availableMemberships.length).toBe(2);
    }
  });

  it('deve resolver contexto autorizado com sucesso quando membership_id válido for selecionado', () => {
    const context = resolveActiveContext(baseSession, 'mem-multi-01-gerente');

    expect(context).not.toBeNull();
    expect(context.profile_id).toBe('gerente');
    expect(context.context_id).toBe(`${multiRoleUser.memberships[0].tenant_id}:${multiRoleUser.memberships[0].fazenda_id}:gerente`);
    expect(context.capabilities).toContain('analytics:view');
    expect(context.capabilities).toContain('meta:edit');
  });

  it('deve resolver outro vínculo quando escolhido explicitamente', () => {
    const context = resolveActiveContext(baseSession, 'mem-multi-02-capataz');

    expect(context).not.toBeNull();
    expect(context.profile_id).toBe('capataz');
    expect(context.fazenda_nome).toBe('Fazenda Pantanal Secundária');
    expect(context.capabilities).toContain('offline:cocho');
    expect(context.capabilities).toContain('offline:salga');
  });

  it('deve rejeitar com UnauthorizedContextError quando membership_id for desconhecido', () => {
    expect(() => {
      resolveActiveContext(baseSession, 'mem-inexistente-ou-alheio');
    }).toThrow(UnauthorizedContextError);
  });

  it('deve rejeitar com UnauthorizedContextError quando usuário não possui vínculos ativos', () => {
    const inactiveUser = SYNTHETIC_USERS['inativo.lab@consubov.local'];
    const sessionInactive: SyntheticUserSession = {
      ...baseSession,
      user_id: inactiveUser.user_id,
      memberships: inactiveUser.memberships
    };

    expect(() => {
      resolveActiveContext(sessionInactive, 'mem-inativo-01');
    }).toThrow(UnauthorizedContextError);
  });
});
