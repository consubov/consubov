import { LabUserRecord } from '../identity/credentials';

export const LAB_DEFAULT_PASSWORD = 'lab@123456';
export const LAB_TENANT_ID = '11111111-1111-4111-8111-111111111111';
export const LAB_TENANT_NAME = 'Fazendas Reunidas Lab S/A';
export const LAB_FAZENDA_ID = '22222222-2222-4222-8222-222222222222';
export const LAB_FAZENDA_NAME = 'Fazenda Modelo Lab';
export const LAB_RETIRO_SEDE_ID = '33333333-3333-4333-8333-333333333333';
export const LAB_RETIRO_SEDE_NAME = 'Retiro Sede';

export const SYNTHETIC_USERS: Record<string, LabUserRecord> = {
  // 1. Gerente de Produção
  'gerente.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000001',
    email: 'gerente.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Carlos Gerente Lab',
    device_id: 'device-gerente-lab-01',
    primary_profile: 'gerente',
    memberships: [
      {
        membership_id: 'mem-gerente-01',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: LAB_RETIRO_SEDE_ID,
        retiro_nome: LAB_RETIRO_SEDE_NAME,
        profile_id: 'gerente',
        is_active: true
      }
    ]
  },

  // 2. Capataz de Campo
  'capataz.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000002',
    email: 'capataz.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Tião Capataz Lab',
    device_id: 'device-capataz-lab-01',
    primary_profile: 'capataz',
    memberships: [
      {
        membership_id: 'mem-capataz-01',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: LAB_RETIRO_SEDE_ID,
        retiro_nome: LAB_RETIRO_SEDE_NAME,
        profile_id: 'capataz',
        is_active: true
      }
    ]
  },

  // 3. Escritório Administrativo
  'escritorio.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000003',
    email: 'escritorio.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Mariana Escritório Lab',
    device_id: 'device-escritorio-lab-01',
    primary_profile: 'escritorio',
    memberships: [
      {
        membership_id: 'mem-escritorio-01',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: null,
        retiro_nome: null,
        profile_id: 'escritorio',
        is_active: true
      }
    ]
  },

  // 4. Fábrica de Ração
  'fabrica.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000004',
    email: 'fabrica.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'João Fábrica Lab',
    device_id: 'device-fabrica-lab-01',
    primary_profile: 'fabrica',
    memberships: [
      {
        membership_id: 'mem-fabrica-01',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: null,
        retiro_nome: null,
        profile_id: 'fabrica',
        is_active: true
      }
    ]
  },

  // 5. Administrador Global SaaS
  'admin.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000005',
    email: 'admin.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Admin Global Lab',
    device_id: 'device-admin-lab-01',
    primary_profile: 'administrador',
    memberships: [
      {
        membership_id: 'mem-admin-global-01',
        tenant_id: '00000000-0000-4000-8000-000000000000',
        tenant_nome: 'CONSUBOV Global Admin Platform',
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        fazenda_nome: 'Ambiente Global SaaS',
        retiro_id: null,
        retiro_nome: null,
        profile_id: 'administrador',
        is_active: true
      }
    ]
  },

  // 6. Usuário com um perfil e múltiplos vínculos operacionais (Gerente)
  'multirole.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000006',
    email: 'multirole.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Renato MultiVínculo Lab',
    device_id: 'device-multirole-lab-01',
    primary_profile: 'gerente',
    memberships: [
      {
        membership_id: 'mem-multi-01-gerente',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: LAB_RETIRO_SEDE_ID,
        retiro_nome: LAB_RETIRO_SEDE_NAME,
        profile_id: 'gerente',
        is_active: true
      },
      {
        membership_id: 'mem-multi-02-gerente',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: '44444444-4444-4444-8444-444444444444',
        fazenda_nome: 'Fazenda Pantanal Secundária',
        retiro_id: '55555555-5555-4555-8555-555555555555',
        retiro_nome: 'Retiro Lagoa',
        profile_id: 'gerente',
        is_active: true
      }
    ]
  },

  // 7. Usuário Inativo / Revogado — Para teste de Fail-Closed 403
  'inativo.lab@consubov.local': {
    user_id: '10000000-0000-4000-8000-000000000007',
    email: 'inativo.lab@consubov.local',
    password_hash: LAB_DEFAULT_PASSWORD,
    name: 'Marcos Inativo Lab',
    device_id: 'device-inativo-lab-01',
    primary_profile: 'capataz',
    memberships: [
      {
        membership_id: 'mem-inativo-01',
        tenant_id: LAB_TENANT_ID,
        tenant_nome: LAB_TENANT_NAME,
        fazenda_id: LAB_FAZENDA_ID,
        fazenda_nome: LAB_FAZENDA_NAME,
        retiro_id: LAB_RETIRO_SEDE_ID,
        retiro_nome: LAB_RETIRO_SEDE_NAME,
        profile_id: 'capataz',
        is_active: false // REVOGADO / SUSPENSO
      }
    ]
  }
};
