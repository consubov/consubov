// F23 compatibility runtime: v2.0.61 source remains immutable in
// production-baseline/web; all network writes are blocked in this preview.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { createReadOnlyTransport, localReadOnlyOrigin, READ_ONLY_SDK_URL } from './readonlyTransport';
import { createStagingTransport } from './stagingTransport';
import { createSharedLiveTransport, trustedSharedOrigin } from './sharedLiveTransport';

// Never use VITE_SUPABASE_URL in the isolated copy: no direct production DB.
const localBridgeOrigin=localReadOnlyOrigin(import.meta.env.VITE_CONSUBOV_READ_ONLY_BRIDGE_ORIGIN);
const bridgeOrigin=import.meta.env.VITE_CONSUBOV_SHARED_LIVE_READONLY_ENABLED==='true'
  ? trustedSharedOrigin(import.meta.env.VITE_CONSUBOV_READ_ONLY_BRIDGE_ORIGIN)
  : localBridgeOrigin;
const stagingEnabled = import.meta.env.VITE_CONSUBOV_STAGING_COMPAT_ENABLED === 'true' && !!localBridgeOrigin;
const sharedLiveEnabled = import.meta.env.VITE_CONSUBOV_SHARED_LIVE_READONLY_ENABLED === 'true' && !!bridgeOrigin && !stagingEnabled;
const disabledFetch: typeof fetch = async () => {
  throw new Error('Backend de leitura nao configurado neste laboratorio.');
};

export const supabase = createClient<Database>(
  sharedLiveEnabled ? bridgeOrigin! : stagingEnabled ? bridgeOrigin! : bridgeOrigin ? READ_ONLY_SDK_URL : 'https://preview.consubov.invalid',
  'local-read-only-preview-no-db-privileges',
  {
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: stagingEnabled || sharedLiveEnabled,
      autoRefreshToken: stagingEnabled || sharedLiveEnabled,
      detectSessionInUrl: stagingEnabled,
      storageKey: sharedLiveEnabled ? 'consubov-f23-shared-production-readonly' : 'consubov-f23-staging-compat-auth',
    },
    global: { fetch: sharedLiveEnabled ? createSharedLiveTransport(bridgeOrigin!) : stagingEnabled ? createStagingTransport(bridgeOrigin!) : bridgeOrigin ? createReadOnlyTransport(bridgeOrigin) : disabledFetch },
  },
);
