import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../../packages/ui/src';
import { ModuleFrame } from '../../apps/fazenda/shell/src/router/ModuleFrame';
import { prepareWindowActivation } from '../../apps/fazenda/shell/src/pwa/activationBarrier';
import type { AuthorizedContext, SyntheticUserSession } from '../../packages/auth-client/src';

declare global {
  interface Window {
    legacyHealthHost: { ready: boolean; mount(): void; activationBlocked(): Promise<boolean> };
  }
}
const context: AuthorizedContext = { context_id: crypto.randomUUID(), tenant_id: 'health-qa', tenant_nome: 'QA', product_id: 'consubov', fazenda_id: 'farm', fazenda_nome: 'QA', retiro_id: null, retiro_nome: null, profile_id: 'capataz', capabilities: ['local-data.read'] };
const session: SyntheticUserSession = { session_id: crypto.randomUUID(), user_id: crypto.randomUUID(), user_name: 'QA', user_email: 'health@qa.invalid', profile_id: 'capataz', memberships: [], active_context: context, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 180000).toISOString(), device_id: 'health-qa' };
const root = createRoot(document.getElementById('root')!);
window.legacyHealthHost = {
  ready: false,
  mount() {
    root.render(React.createElement(I18nProvider, {}, React.createElement(ModuleFrame, {
      descriptor: { moduleId: 'capataz', profileId: 'capataz', basePath: '/qa', titleKey: 'QA', iconName: 'QA', entryUrl: `${location.origin}/modules/capataz/current/index.html`, expectedOrigin: location.origin, capabilities: context.capabilities }, session, context, isContextCurrent: () => true
    })));
  },
  async activationBlocked() {
    const lease = await prepareWindowActivation();
    lease?.release();
    return lease === null;
  }
};
await navigator.serviceWorker.register('/sw.js');
await navigator.serviceWorker.ready;
if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
window.legacyHealthHost.ready = true;
if (location.search.includes('mount')) window.legacyHealthHost.mount();
