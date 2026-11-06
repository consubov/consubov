import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../../../packages/ui/src';
import { ModuleFrame } from '../../../apps/fazenda/shell/src/router/ModuleFrame';
import { moduleHelloSchema, moduleReadySchema, moduleRpcRequestSchema } from '../../../packages/contracts/src';
import type { AuthorizedContext, SyntheticUserSession } from '../../../packages/auth-client/src';

type Trace = { value: unknown; runtimeValid: boolean; binary: boolean };
export interface PortableResult { ok: boolean; checks: string[]; error?: string; traces: Trace[] }
declare global { interface Window { portableResult: Promise<PortableResult> } }
window.portableResult = (async () => {
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  const capabilities = new URL(location.href).searchParams.has('readOnly') ? ['local-data.read'] : ['local-data.read', 'local-data.write'];
  const context: AuthorizedContext = { context_id: crypto.randomUUID(), tenant_id: 'portable', tenant_nome: 'QA', product_id: 'consubov', fazenda_id: 'farm', fazenda_nome: 'QA', retiro_id: null, retiro_nome: null, profile_id: 'capataz', capabilities };
  const session: SyntheticUserSession = { session_id: crypto.randomUUID(), user_id: crypto.randomUUID(), user_name: 'QA', user_email: 'portable@qa.invalid', profile_id: 'capataz', memberships: [], active_context: context, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60000).toISOString(), device_id: 'portable-device' };
  const traces: Trace[] = [];
  return new Promise<PortableResult>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Portable actual host timed out.')), 30000);
    const receive = (event: MessageEvent) => {
      const frame = document.querySelector('iframe');
      if (event.source !== frame?.contentWindow || event.origin !== 'null') return;
      const nonce = new DOMParser().parseFromString(frame.srcdoc, 'text/html').querySelector('meta[name="consubov-module-nonce"]')?.getAttribute('content');
      if (event.data?.nonce !== nonce) return;
      if (event.data.kind === 'fixture:control' && event.data.action === 'expire-session') {
        session.expires_at = new Date(0).toISOString();
        frame.contentWindow?.postMessage({ kind: 'fixture:controlled', nonce }, '*');
      }
      if (event.data.kind === 'fixture:trace') {
        const value = event.data.value;
        const schema = value.kind === 'module:hello' ? moduleHelloSchema : value.kind === 'module:ready' ? moduleReadySchema : moduleRpcRequestSchema;
        traces.push({ value, runtimeValid: schema.safeParse(value).success, binary: value.method === 'commitMutation' });
      }
      if (event.data.kind === 'fixture:result') {
        clearTimeout(timeout); window.removeEventListener('message', receive);
        resolve({ ok: event.data.ok, checks: event.data.checks, error: event.data.error, traces });
      }
    };
    window.addEventListener('message', receive);
    const root = createRoot(document.getElementById('root')!);
    root.render(React.createElement(I18nProvider, {}, React.createElement(ModuleFrame, {
      descriptor: { moduleId: 'capataz', profileId: 'capataz', basePath: '/qa', titleKey: 'QA', iconName: 'QA', entryUrl: `${location.origin}/modules/capataz/current/index.html`, expectedOrigin: location.origin, capabilities }, session, context, isContextCurrent: () => true
    })));
  });
})();
