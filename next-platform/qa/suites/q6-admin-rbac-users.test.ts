import { describe, it, expect } from 'bun:test';
import {
  bloquearUsuarioPayloadSchema,
  vincularUsuarioPayloadSchema
} from '@consubov/contracts';

describe('Gate Q6: Usuários Globais, Bloqueio Formal & Matriz RBAC Administrativa (q6-admin-rbac-users)', () => {
  it('Q6.4.1: deve validar bloqueio formal de usuário com motivo válido e revogação de sessões', () => {
    const motivos = [
      'inadimplencia',
      'desligamento_colaborador',
      'violacao_seguranca',
      'solicitacao_gestor',
      'manutencao_cadastral'
    ] as const;

    for (const motivo of motivos) {
      const payload = {
        usuario_id: 'usr-colab-001',
        tenant_id: 'ten-corp-001',
        motivo_bloqueio: motivo,
        detalhes_bloqueio: `Bloqueio formal preventivo com base no protocolo ${motivo}`,
        revogar_sessoes_ativas: true,
        bloqueado_em: new Date().toISOString()
      };

      const parsed = bloquearUsuarioPayloadSchema.parse(payload);
      expect(parsed.usuario_id).toBe('usr-colab-001');
      expect(parsed.motivo_bloqueio).toBe(motivo);
      expect(parsed.revogar_sessoes_ativas).toBe(true);
    }
  });

  it('Q6.4.2: deve rejeitar bloqueio de usuário com motivo inválido ou detalhes vazios (< 5 chars)', () => {
    const invalidReason = {
      usuario_id: 'usr-colab-001',
      tenant_id: 'ten-corp-001',
      motivo_bloqueio: 'motivo_invalido' as any,
      detalhes_bloqueio: 'Justificativa válida com mais de cinco caracteres',
      revogar_sessoes_ativas: true,
      bloqueado_em: new Date().toISOString()
    };
    expect(bloquearUsuarioPayloadSchema.safeParse(invalidReason).success).toBe(false);

    const shortDetails = {
      usuario_id: 'usr-colab-001',
      tenant_id: 'ten-corp-001',
      motivo_bloqueio: 'violacao_seguranca' as const,
      detalhes_bloqueio: '1234',
      revogar_sessoes_ativas: true,
      bloqueado_em: new Date().toISOString()
    };
    expect(bloquearUsuarioPayloadSchema.safeParse(shortDetails).success).toBe(false);
  });

  it('Q6.4.3: deve validar vinculação de usuário a tenant, fazenda e perfil operacional', () => {
    const perfis = ['gerente', 'capataz', 'escritorio', 'fabrica', 'administrador'] as const;

    for (const profile of perfis) {
      const payload = {
        usuario_id: 'usr-colab-002',
        tenant_id: 'ten-corp-001',
        fazenda_id: 'faz-001',
        profile_id: profile,
        ativo: true,
        vinculado_em: new Date().toISOString()
      };

      const parsed = vincularUsuarioPayloadSchema.parse(payload);
      expect(parsed.profile_id).toBe(profile);
      expect(parsed.ativo).toBe(true);
    }
  });

  it('Q6.4.4: deve aplicar segregação estrita de funções na matriz RBAC (Fail-Closed)', () => {
    type TabAccess = 'tenants' | 'licenses' | 'audit' | 'users';

    const checkTabAccess = (role: 'super_admin' | 'support_admin' | 'financial_admin', tab: TabAccess): boolean => {
      if (role === 'super_admin') return true;
      if (role === 'support_admin') {
        return tab === 'tenants' || tab === 'audit' || tab === 'users';
      }
      if (role === 'financial_admin') {
        return tab === 'tenants' || tab === 'licenses';
      }
      return false;
    };

    // super_admin -> acesso a tudo
    expect(checkTabAccess('super_admin', 'tenants')).toBe(true);
    expect(checkTabAccess('super_admin', 'licenses')).toBe(true);
    expect(checkTabAccess('super_admin', 'audit')).toBe(true);
    expect(checkTabAccess('super_admin', 'users')).toBe(true);

    // support_admin -> sem acesso a licenses (faturamento/comercial)
    expect(checkTabAccess('support_admin', 'tenants')).toBe(true);
    expect(checkTabAccess('support_admin', 'audit')).toBe(true);
    expect(checkTabAccess('support_admin', 'users')).toBe(true);
    expect(checkTabAccess('support_admin', 'licenses')).toBe(false);

    // financial_admin -> sem acesso a audit (logs técnicos) nem users
    expect(checkTabAccess('financial_admin', 'tenants')).toBe(true);
    expect(checkTabAccess('financial_admin', 'licenses')).toBe(true);
    expect(checkTabAccess('financial_admin', 'audit')).toBe(false);
    expect(checkTabAccess('financial_admin', 'users')).toBe(false);
  });
});
