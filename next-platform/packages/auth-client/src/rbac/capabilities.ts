import { UserProfileId } from '@consubov/contracts';

export const PROFILE_CAPABILITIES: Record<UserProfileId, readonly string[]> = {
  capataz: [
    'offline:cocho',
    'offline:salga',
    'offline:qr',
    'offline:foto',
    'sync:commands',
    'local-data.read',
    'local-data.write',
    'sync.pull',
    'sync.push'
  ],
  gerente: [
    'analytics:view',
    'meta:edit',
    'gmd:edit',
    'custo:read',
    'sync:commands',
    'local-data.read',
    'local-data.write',
    'sync.pull',
    'sync.push'
  ],
  escritorio: [
    'compras:edit',
    'notas:edit',
    'lotes:edit',
    'sync:commands',
    'local-data.read',
    'local-data.write',
    'sync.pull',
    'sync.push'
  ],
  fabrica: [
    'formulas:edit',
    'batidas:run',
    'estoque:adjust',
    'sync:commands',
    'local-data.read',
    'local-data.write',
    'sync.pull',
    'sync.push'
  ],
  administrador: [
    'tenants:manage',
    'licenses:manage',
    'audit:view',
    'admin:all'
  ]
} as const;

export function getCapabilitiesForProfile(profile: UserProfileId): readonly string[] {
  return PROFILE_CAPABILITIES[profile] ?? [];
}
