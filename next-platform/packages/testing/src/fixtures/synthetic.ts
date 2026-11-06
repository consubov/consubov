import { AtomicCommandEnvelope } from '@consubov/contracts';

export const SYNTHETIC_FIXTURES = {
  tenant: {
    id: 'tenant-lab-001',
    nome: 'Agropecuária Vale Verde Sintética',
    cnpj: '00.000.000/0001-91',
    plano: 'enterprise' as const,
    status: 'ativo' as const,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1
  },
  fazenda: {
    id: 'fazenda-guarani-01',
    tenant_id: 'tenant-lab-001',
    nome: 'Fazenda Guarani Lab',
    municipio: 'Campo Grande',
    uf: 'MS',
    area_total_ha: 1500,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1
  },
  retiro: {
    id: 'retiro-sede-01',
    fazenda_id: 'fazenda-guarani-01',
    nome: 'Retiro Sede',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    version: 1
  },
  users: {
    gerente: {
      id: 'user-gerente-teste',
      email: 'gerente.lab@consubov.local',
      nome: 'Gerente Sintético'
    },
    capataz: {
      id: 'user-capataz-teste',
      email: 'capataz.lab@consubov.local',
      nome: 'Capataz Sintético'
    }
  }
};

export function createSyntheticCommandEnvelope(
  overrides?: Partial<AtomicCommandEnvelope>
): AtomicCommandEnvelope {
  return {
    command_id: 'c1f7b8a2-3d4e-4f5a-8b6c-7d8e9f0a1b2c',
    idempotency_key: 'urn:consubov:tenant-lab-001:pasto-01:salga:20261104:001',
    correlation_id: 'corr-001-uuid-v4',
    tenant_id: SYNTHETIC_FIXTURES.tenant.id,
    user_id: SYNTHETIC_FIXTURES.users.capataz.id,
    device_id: 'device-tablet-01',
    fazenda_id: SYNTHETIC_FIXTURES.fazenda.id,
    retiro_id: SYNTHETIC_FIXTURES.retiro.id,
    profile_id: 'capataz',
    product_id: 'consubov',
    command_type: 'capataz.cocho.registrar_escore',
    aggregate_type: 'cocho',
    aggregate_id: 'pasto-piquete-01',
    base_version: 0,
    schema_version: 1,
    payload: {
      pasto_id: 'pasto-piquete-01',
      produto_id: 'sal-proteinado-verao',
      sacos_fornecidos: 4,
      escore_cocho: 2,
      observacao: 'Cocho limpo, sem umidade'
    },
    attachment_refs: [],
    occurred_at_local: '2026-11-04T10:30:00.000Z',
    status: 'PENDENTE',
    attempts: 0,
    last_attempt_at: null,
    error_message: null,
    ...overrides
  };
}
