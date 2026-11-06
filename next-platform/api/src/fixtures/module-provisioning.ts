import { moduleProvisioningPayloadSchema } from '@consubov/contracts';
import type { SyntheticUserSession } from '@consubov/auth-client';
import { INITIAL_MODULE_STATES } from './initial-module-states';

export function initialModuleData(session: SyntheticUserSession) {
  const context = session.active_context;
  if (!context || !INITIAL_MODULE_STATES[context.profile_id]) return undefined;
  const state = structuredClone(INITIAL_MODULE_STATES[context.profile_id]!);
  // Existing synthetic lot references are scoped to the authorized farm returned by the API.
  if (Array.isArray(state.lotes)) for (const lote of state.lotes) {
    if (lote && typeof lote === 'object' && 'fazenda_id' in lote) lote.fazenda_id = context.fazenda_id;
  }
  return moduleProvisioningPayloadSchema.parse({
    protocolVersion: 1,
    context: {
      userId: session.user_id, tenantId: context.tenant_id, farmId: context.fazenda_id,
      retreatId: context.retiro_id, moduleId: context.profile_id, profileId: context.profile_id,
      deviceId: session.device_id, productId: context.product_id
    },
    snapshot: {
      aggregateType: 'module-state', aggregateId: 'bootstrap', version: 0,
      data: context.profile_id === 'escritorio' ? { schema: 'escritorio-state-v1', revision: 0, state } : state,
      modifiedAt: session.issued_at
    }
  });
}
