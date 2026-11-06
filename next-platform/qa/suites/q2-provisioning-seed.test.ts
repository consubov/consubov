import { describe, expect, it } from 'bun:test';
import { SYNTHETIC_USERS } from '@consubov/auth-client';
import { moduleProvisioningPayloadSchema } from '@consubov/contracts';
import { handleAuthRequest } from '../../api/src/handlers/auth';

describe('authorized laboratory initial data', () => {
  for (const profile of ['capataz', 'gerente', 'escritorio', 'fabrica'] as const) {
    it(`returns only the selected ${profile} account/context seed`, async () => {
      const user = Object.values(SYNTHETIC_USERS).find(user => user.primary_profile === profile)!;
      const membership = user.memberships.find(membership => membership.is_active)!;
      const login = async (membershipId?: string) => handleAuthRequest(new Request('http://127.0.0.1/api/v1/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password_hash, device_id: 'seed-test-device', membership_id: membershipId })
      }));
      const initial = await (await login()).json();
      expect(initial).not.toHaveProperty('initial_data');
      const selected = await (await login(membership.membership_id)).json();
      const seed = moduleProvisioningPayloadSchema.parse(selected.initial_data);
      expect(seed.context).toEqual({
        userId: user.user_id, tenantId: membership.tenant_id, farmId: membership.fazenda_id,
        retreatId: membership.retiro_id, profileId: profile, moduleId: profile,
        deviceId: 'seed-test-device', productId: 'consubov'
      });
      const state = profile === 'escritorio' ? seed.snapshot.data.state as Record<string, unknown> : seed.snapshot.data;
      expect(state.localRevision).toBe(0);
      expect(state.outbox).toEqual([]);
      if (profile === 'escritorio') {
        for (const lot of state.lotes as Array<{ fazenda_id: string }>) expect(lot.fazenda_id).toBe(membership.fazenda_id);
      }
      const unauthorized = await login('membership-of-another-account');
      expect(unauthorized.status).toBe(403);
      expect(await unauthorized.json()).not.toHaveProperty('initial_data');
    });
  }
});
