import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider, ModuleRuntimeProvider } from '@consubov/ui';
import { moduleHealthSchema, moduleRuntimeFailureSchema, createModuleLocalDataAPI, createModuleRpcClient, moduleHelloSchema, moduleReadySchema, normalizeLanguage, shellLanguageChangeSchema, shellModuleInitSchema, type ModuleExecutionContext, type ModuleLocalDataAPI, type ModuleRpcClient, type SupportedLanguage } from '@consubov/contracts';
import ModuleView from './EscritorioView';

declare const __CONSUBOV_MODULE_VERSION__: string;

import { globalQuiescenceRegistry, installModuleQuiescenceBridge } from '@consubov/module-release';
const moduleId = 'escritorio';
const nonce = document.querySelector<HTMLMetaElement>('meta[name=consubov-module-nonce]')?.content ?? new URL(window.location.href).searchParams.get('nonce');
let root: Root | null = null;
let port: MessagePort | null = null;
let localData: ModuleLocalDataAPI | null = null;
let rpcClient: ModuleRpcClient | null = null;
let language: SupportedLanguage = 'pt-BR';
let executionContext: ModuleExecutionContext | null = null;
let disposeBridge: (() => void) | null = null;
let healthReported = false;
function reportHealthy(): void {
  if (!port || !nonce || healthReported) return;
  healthReported = true;
  port.postMessage(moduleHealthSchema.parse({ kind: 'module:healthy', protocolVersion: 1, moduleId, profileId: moduleId, nonce, version: __CONSUBOV_MODULE_VERSION__ }));
}
function reportRuntimeFailure(): void {
  if (!port || !nonce) return;
  port.postMessage(moduleRuntimeFailureSchema.parse({ kind: 'module:runtime-failure', protocolVersion: 1, moduleId, profileId: moduleId, nonce, version: __CONSUBOV_MODULE_VERSION__ }));
}
window.addEventListener('error', reportRuntimeFailure);
window.addEventListener('unhandledrejection', reportRuntimeFailure);

function renderModule(): void {
  if (!root) return;
  if (!localData || !executionContext) return;
  root.render(<I18nProvider language={language}><ModuleRuntimeProvider localData={localData} onHealthy={reportHealthy}><ModuleView context={executionContext} /></ModuleRuntimeProvider></I18nProvider>);
}

if (nonce && window.parent !== window) {
  const hello = moduleHelloSchema.parse({ kind: 'module:hello', protocolVersion: 1, moduleId, profileId: moduleId, version: __CONSUBOV_MODULE_VERSION__, nonce });
  window.parent.postMessage(hello, '*');
}

window.addEventListener('message', event => {
  if (event.source !== window.parent || !nonce || event.ports.length !== 1 || port) return;
  const init = shellModuleInitSchema.safeParse(event.data);
  if (!init.success || init.data.nonce !== nonce || init.data.moduleId !== moduleId || init.data.profileId !== moduleId) return;

  port = event.ports[0] ?? null;
  if (!port) return;
  disposeBridge = installModuleQuiescenceBridge(port, { moduleId, nonce });
  rpcClient = createModuleRpcClient(port, { moduleId, nonce }, { onMutationStart: () => globalQuiescenceRegistry.acquireLock('module-db-' + crypto.randomUUID(), 'LOCAL_DB_TRANSACTION') });
  localData = createModuleLocalDataAPI(rpcClient);
  executionContext = init.data.context;
  language = init.data.language;
  port.onmessage = message => {
    const languageChange = shellLanguageChangeSchema.safeParse(message.data);
    if (!languageChange.success) return;
    language = normalizeLanguage(languageChange.data.language);
    renderModule();
  };
  port.start();
  const target = document.getElementById('root');
  if (!target) return;
  root = createRoot(target);
  renderModule();
  port.postMessage(moduleReadySchema.parse({ kind: 'module:ready', protocolVersion: 1, moduleId, profileId: moduleId, nonce }));
});

window.addEventListener('pagehide', () => { disposeBridge?.(); disposeBridge = null; rpcClient?.close('Módulo encerrado.'); rpcClient = null; port = null; localData = null; executionContext = null; });
