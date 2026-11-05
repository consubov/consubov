import { UserProfileId } from '@consubov/contracts';

export const PROFILE_CAPABILITIES: Record<UserProfileId, readonly string[]> = {
  capataz: [
    'offline:cocho',
    'offline:salga',
    'offline:qr',
    'offline:foto',
    'sync:commands'
  ],
  gerente: [
    'analytics:view',
    'meta:edit',
    'gmd:edit',
    'custo:read',
    'sync:commands'
  ],
  escritorio: [
    'compras:edit',
    'notas:edit',
    'lotes:edit',
    'sync:commands'
  ],
  fabrica: [
    'formulas:edit',
    'batidas:run',
    'estoque:adjust',
    'sync:commands'
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
