import { useState, useEffect, useCallback } from 'react';
import {
  criarTenantPayloadSchema,
  suspenderTenantPayloadSchema,
  gerarLicencaOffgridPayloadSchema,
  atualizarLicencaPayloadSchema,
  bloquearUsuarioPayloadSchema,
  vincularUsuarioPayloadSchema,
  type CriarTenantPayload,
  type SuspenderTenantPayload,
  type GerarLicencaOffgridPayload,
  type AtualizarLicencaPayload,
  type BloquearUsuarioPayload,
  type VincularUsuarioPayload
} from '@consubov/contracts';
import { useAdminAuth } from '../auth/useAdminAuth';

export interface TenantRecord {
  tenant_id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  plano: 'starter' | 'profissional' | 'enterprise' | 'custom';
  limite_fazendas: number;
  limite_cabecas: number;
  status: 'ativo' | 'suspenso' | 'cancelado';
  admin_email: string;
  admin_nome: string;
  criado_em: string;
  motivo_suspensao?: string;
}

export interface OffgridLicenseRecord {
  licenca_id: string;
  tenant_id: string;
  fazenda_id: string;
  dispositivo_id: string;
  dias_validade_offgrid: number;
  modulos_autorizados: ('gerente' | 'capataz' | 'escritorio' | 'fabrica')[];
  chave_assinatura_publica: string;
  status: 'ativa' | 'suspensa' | 'revogada' | 'expirada';
  gerado_em: string;
  expira_em: string;
  token_jwt?: string;
}

export interface GlobalUserRecord {
  usuario_id: string;
  nome: string;
  email: string;
  role: 'super_admin' | 'support_admin' | 'financial_admin';
  tenant_id: string;
  fazenda_id: string | null;
  status: 'ativo' | 'bloqueado';
  profile_id: 'administrador' | 'gerente' | 'capataz' | 'escritorio' | 'fabrica';
  bloqueio_motivo?: string;
  bloqueado_em?: string;
}

export interface AuditLogRecord {
  id: string;
  command_id: string;
  tenant_id: string;
  user_id: string;
  profile_id: string;
  command_type: string;
  status: string;
  timestamp: string;
  envelope: Record<string, unknown>;
}

// Estado em memória inicial compartilhado (Sintético de Laboratório)
const INITIAL_TENANTS: TenantRecord[] = [
  {
    tenant_id: 'ten-lab-001',
    razao_social: 'Agropecuária Modelo S/A',
    nome_fantasia: 'Fazenda Modelo',
    cnpj: '12345678000195',
    plano: 'enterprise',
    limite_fazendas: 10,
    limite_cabecas: 50000,
    status: 'ativo',
    admin_email: 'admin@modelosa.com.br',
    admin_nome: 'Carlos Modelo',
    criado_em: '2026-01-15T10:00:00Z'
  },
  {
    tenant_id: 'ten-lab-002',
    razao_social: 'Pecuária Santa Fé Ltda',
    nome_fantasia: 'Grupo Santa Fé',
    cnpj: '98765432000100',
    plano: 'profissional',
    limite_fazendas: 4,
    limite_cabecas: 15000,
    status: 'ativo',
    admin_email: 'contato@gruposantafe.com.br',
    admin_nome: 'Marcos Santa Fé',
    criado_em: '2026-02-10T14:30:00Z'
  },
  {
    tenant_id: 'ten-lab-003',
    razao_social: 'Fazendas Reunidas Vale Verde',
    nome_fantasia: 'Vale Verde Bovinos',
    cnpj: '11223344000155',
    plano: 'starter',
    limite_fazendas: 1,
    limite_cabecas: 3000,
    status: 'suspenso',
    admin_email: 'financeiro@valeverde.com.br',
    admin_nome: 'Ana Vale',
    criado_em: '2026-03-01T08:00:00Z',
    motivo_suspensao: 'inadimplencia'
  }
];

const INITIAL_USERS: GlobalUserRecord[] = [
  {
    usuario_id: 'usr-admin-super',
    nome: 'Super Administrador Global',
    email: 'admin.lab@consubov.local',
    role: 'super_admin',
    tenant_id: '00000000-0000-4000-8000-000000000000',
    fazenda_id: null,
    status: 'ativo',
    profile_id: 'administrador'
  },
  {
    usuario_id: 'usr-admin-suporte',
    nome: 'Suporte Técnico N3',
    email: 'suporte.lab@consubov.local',
    role: 'support_admin',
    tenant_id: '00000000-0000-4000-8000-000000000000',
    fazenda_id: null,
    status: 'ativo',
    profile_id: 'administrador'
  },
  {
    usuario_id: 'usr-admin-financeiro',
    nome: 'Gestor Financeiro Corporativo',
    email: 'financeiro.lab@consubov.local',
    role: 'financial_admin',
    tenant_id: '00000000-0000-4000-8000-000000000000',
    fazenda_id: null,
    status: 'ativo',
    profile_id: 'administrador'
  }
];

// Singletons mutáveis em memória para a SPA
let memoryTenants: TenantRecord[] = [...INITIAL_TENANTS];
let memoryLicenses: OffgridLicenseRecord[] = [];
let memoryUsers: GlobalUserRecord[] = [...INITIAL_USERS];

export function useAdminStore() {
  const { session } = useAdminAuth();
  const [tenants, setTenants] = useState<TenantRecord[]>(memoryTenants);
  const [licenses, setLicenses] = useState<OffgridLicenseRecord[]>(memoryLicenses);
  const [users, setUsers] = useState<GlobalUserRecord[]>(memoryUsers);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sincroniza estado local com os singletons
  const refreshLocalState = () => {
    setTenants([...memoryTenants]);
    setLicenses([...memoryLicenses]);
    setUsers([...memoryUsers]);
  };

  // 1. Gestão de Tenants
  const criarTenant = useCallback(async (payload: CriarTenantPayload): Promise<TenantRecord> => {
    // Validação estrita via Zod schema
    const valid = criarTenantPayloadSchema.parse(payload);

    const novoTenant: TenantRecord = {
      tenant_id: valid.tenant_id,
      razao_social: valid.razao_social,
      nome_fantasia: valid.nome_fantasia,
      cnpj: valid.cnpj,
      plano: valid.plano,
      limite_fazendas: valid.limite_fazendas,
      limite_cabecas: valid.limite_cabecas,
      status: 'ativo',
      admin_email: valid.admin_email,
      admin_nome: valid.admin_nome,
      criado_em: new Date().toISOString()
    };

    memoryTenants = [novoTenant, ...memoryTenants];
    refreshLocalState();
    return novoTenant;
  }, []);

  const suspenderTenant = useCallback(async (payload: SuspenderTenantPayload): Promise<boolean> => {
    const valid = suspenderTenantPayloadSchema.parse(payload);

    const index = memoryTenants.findIndex(t => t.tenant_id === valid.tenant_id);
    const target = memoryTenants[index];
    if (index === -1 || !target) return false;

    memoryTenants[index] = {
      ...target,
      status: 'suspenso',
      motivo_suspensao: valid.motivo_suspensao
    };

    refreshLocalState();
    return true;
  }, []);

  const reativarTenant = useCallback(async (tenantId: string): Promise<boolean> => {
    const index = memoryTenants.findIndex(t => t.tenant_id === tenantId);
    const target = memoryTenants[index];
    if (index === -1 || !target) return false;

    memoryTenants[index] = {
      ...target,
      status: 'ativo',
      motivo_suspensao: undefined
    };

    refreshLocalState();
    return true;
  }, []);

  // 2. Gestão de Licenças
  const gerarLicencaOffgrid = useCallback(async (payload: GerarLicencaOffgridPayload): Promise<OffgridLicenseRecord> => {
    const valid = gerarLicencaOffgridPayloadSchema.parse(payload);

    const expiraEm = new Date(Date.now() + valid.dias_validade_offgrid * 86400000).toISOString();
    const token = `OFFGRID-${valid.licenca_id}-${valid.dispositivo_id.substring(0, 8)}-${Date.now()}`;

    const novaLicenca: OffgridLicenseRecord = {
      licenca_id: valid.licenca_id,
      tenant_id: valid.tenant_id,
      fazenda_id: valid.fazenda_id,
      dispositivo_id: valid.dispositivo_id,
      dias_validade_offgrid: valid.dias_validade_offgrid,
      modulos_autorizados: valid.modulos_autorizados,
      chave_assinatura_publica: valid.chave_assinatura_publica,
      status: 'ativa',
      gerado_em: valid.gerado_em,
      expira_em: expiraEm,
      token_jwt: token
    };

    memoryLicenses = [novaLicenca, ...memoryLicenses];
    refreshLocalState();
    return novaLicenca;
  }, []);

  const atualizarLicenca = useCallback(async (payload: AtualizarLicencaPayload): Promise<boolean> => {
    const valid = atualizarLicencaPayloadSchema.parse(payload);

    const index = memoryLicenses.findIndex(l => l.licenca_id === valid.licenca_id);
    const target = memoryLicenses[index];
    if (index === -1 || !target) return false;

    memoryLicenses[index] = {
      ...target,
      status: valid.novo_status
    };

    refreshLocalState();
    return true;
  }, []);

  // 3. Usuários Globais
  const bloquearUsuario = useCallback(async (payload: BloquearUsuarioPayload): Promise<boolean> => {
    const valid = bloquearUsuarioPayloadSchema.parse(payload);

    const index = memoryUsers.findIndex(u => u.usuario_id === valid.usuario_id);
    const target = memoryUsers[index];
    if (index === -1 || !target) return false;

    memoryUsers[index] = {
      ...target,
      status: 'bloqueado',
      bloqueio_motivo: valid.motivo_bloqueio,
      bloqueado_em: valid.bloqueado_em
    };

    refreshLocalState();
    return true;
  }, []);

  const vincularUsuario = useCallback(async (payload: VincularUsuarioPayload): Promise<boolean> => {
    const valid = vincularUsuarioPayloadSchema.parse(payload);

    const index = memoryUsers.findIndex(u => u.usuario_id === valid.usuario_id);
    const target = memoryUsers[index];
    if (index === -1 || !target) return false;

    memoryUsers[index] = {
      ...target,
      tenant_id: valid.tenant_id,
      fazenda_id: valid.fazenda_id,
      profile_id: valid.profile_id
    };

    refreshLocalState();
    return true;
  }, []);

  // 4. Auditoria de Comandos (Ledger)
  const fetchAuditLogs = useCallback(async (filterParams?: Record<string, string>): Promise<AuditLogRecord[]> => {
    setIsLoading(true);

    try {
      const query = new URLSearchParams(filterParams || {}).toString();
      const url = `/api/v1/admin/audit${query ? `?${query}` : ''}`;

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.token || ''}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        const mapped: AuditLogRecord[] = (data.logs || []).map((l: any) => ({
          id: l.envelope?.command_id || l.ack?.command_id || Math.random().toString(),
          command_id: l.envelope?.command_id || l.ack?.command_id || '',
          tenant_id: l.envelope?.tenant_id || '',
          user_id: l.envelope?.user_id || '',
          profile_id: l.envelope?.profile_id || '',
          command_type: l.envelope?.command_type || '',
          status: l.ack?.status || 'ACKED',
          timestamp: l.stored_at || l.envelope?.occurred_at_local || new Date().toISOString(),
          envelope: l.envelope || {}
        }));
        setLogs(mapped);
        setIsLoading(false);
        return mapped;
      }
    } catch {
      // Fallback gracioso para ambiente estático/mock
    }

    setIsLoading(false);
    return logs;
  }, [session?.token, logs]);

  return {
    tenants,
    licenses,
    users,
    logs,
    isLoading,
    criarTenant,
    suspenderTenant,
    reativarTenant,
    gerarLicencaOffgrid,
    atualizarLicenca,
    bloquearUsuario,
    vincularUsuario,
    fetchAuditLogs
  };
}
