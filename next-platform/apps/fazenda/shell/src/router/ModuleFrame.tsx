import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from '@consubov/ui';
import {
  moduleExecutionContextSchema,
  moduleHelloSchema,
  moduleReadySchema,
  moduleHealthSchema,
  moduleRuntimeFailureSchema,
  moduleRpcRequestSchema,
  moduleRpcResponseSchema,
  shellLanguageChangeSchema,
  shellModuleInitSchema,
  shellDataChangedSchema,
  type ModuleExecutionContext,
  type LocalMutation
} from '@consubov/contracts';
import { QuiescentLocalData } from '../pwa/QuiescentLocalData';
import { createModuleQuiescenceHost } from '../pwa/moduleQuiescenceHost';
import { prepareWindowActivation, registerModuleActivationParticipant } from '../pwa/activationBarrier';
import { globalQuiescenceRegistry } from '@consubov/module-release';
import { provisionModuleArtifact, confirmModuleArtifact, rollbackModuleArtifact } from '../pwa/moduleArtifactProvisioning';
import type { PinnedModuleGeneration } from '@consubov/module-release';
import { createIsolatedModuleDocument } from '../pwa/isolatedModuleDocument';
import type { SyntheticUserSession, AuthorizedContext } from '@consubov/auth-client';
import type { FazendaModuleDescriptor } from './moduleRegistry';

interface ModuleFrameProps {
  descriptor: FazendaModuleDescriptor;
  session: SyntheticUserSession;
  context: AuthorizedContext;
  isContextCurrent: () => boolean;
}

type FrameState = 'loading' | 'ready' | 'failed';
const HANDSHAKE_TIMEOUT_MS = 15000;
const RPC_CAPABILITY: Record<string, string> = {
  readSnapshot: 'local-data.read', listSnapshots: 'local-data.read', readAttachment: 'local-data.read', listPendingCommands: 'local-data.read', listOperationIssues: 'local-data.read',
  getCursor: 'local-data.read', getSchemaVersion: 'local-data.read', commitMutation: 'local-data.write'
};

export const ModuleFrame: React.FC<ModuleFrameProps> = ({ descriptor, session, context, isContextCurrent }) => {
  const currentContext = useRef(isContextCurrent);
  currentContext.current = isContextCurrent;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef<MessagePort | null>(null);
  const [state, setState] = useState<FrameState>('loading');
  const [artifactReady, setArtifactReady] = useState(false);
  const [artifactDocument, setArtifactDocument] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const pinned = useRef<PinnedModuleGeneration | null>(null);
  const nextPinned = useRef<PinnedModuleGeneration | null>(null);
  const healthy = useRef(false);
  const recovering = useRef(false);
  const switching = useRef(false);
  const pendingSwitch = useRef<PinnedModuleGeneration | null>(null);
  const host = useRef<ReturnType<typeof createModuleQuiescenceHost> | null>(null);
  const [runtimeError, setRuntimeError] = useState(false);
  const failedGenerations = useRef(new Set<string>());
  const { language, t } = useTranslation();
  const languageRef = useRef(language);
  languageRef.current = language;
  const generationKey = JSON.stringify([
    session.session_id, session.user_id, session.device_id,
    context.context_id, context.tenant_id, context.product_id, context.fazenda_id,
    context.retiro_id, context.profile_id, [...context.capabilities].sort()
  ]);
  const loadIdentity = `${generationKey}:${attempt}`;
  const currentLoad = useRef(loadIdentity);
  currentLoad.current = loadIdentity;
  const switchSafely = async (candidate: PinnedModuleGeneration, stillCurrent: () => boolean) => {
    if (switching.current || !stillCurrent() || candidate.moduleId !== descriptor.moduleId) return;
    switching.current = true;
    try {
      // A frame without a channel has never exposed interactive module UI. The
      // loading sentinel still blocks shell updates; only this local retry can proceed.
      if (!host.current) {
        const lease = globalQuiescenceRegistry.prepareActivation();
        if (!lease) return;
        try {
          if (!stillCurrent()) return;
          pendingSwitch.current = null;
          nextPinned.current = candidate;
          flushSync(() => setAttempt(value => value + 1));
        } finally { globalQuiescenceRegistry.releaseActivation(lease.leaseId); }
        return;
      }
      const lease = await prepareWindowActivation();
      if (!lease) return;
      try {
        if (!await lease.verify() || !stillCurrent()) return;
        pendingSwitch.current = null;
        nextPinned.current = candidate;
        // Remove the old document while its inputs and real host transactions
        // are frozen, before releasing the lease to new user actions.
        flushSync(() => { setArtifactReady(false); setAttempt(value => value + 1); });
      } finally { lease.release(); }
    } finally { switching.current = false; }
  };
  const recover = async (artifact: PinnedModuleGeneration, stillCurrent: () => boolean, reason: 'runtime' | 'handshake' | 'integrity' | 'compatibility' = 'runtime') => {
    if (recovering.current || !stillCurrent()) return;
    recovering.current = true;
    if (host.current) setRuntimeError(true);
    failedGenerations.current.add(artifact.generation);
    try {
      const fallback = await rollbackModuleArtifact(artifact, stillCurrent, reason);
      if (!stillCurrent() || failedGenerations.current.has(fallback.generation)) throw new Error('No healthy fallback.');
      pendingSwitch.current = fallback;
      await switchSafely(fallback, stillCurrent);
    } catch { if (stillCurrent()) { setRuntimeError(true); if (!host.current) setState('failed'); } }
    finally { recovering.current = false; }
  };
  useLayoutEffect(() => {
    failedGenerations.current.clear(); nextPinned.current = null; pendingSwitch.current = null;
  }, [generationKey]);
  useLayoutEffect(() => registerModuleActivationParticipant({ isVerifiedQuiet: () => false, prepare: async () => null }), [loadIdentity]);
  const nonce = useMemo(() => crypto.randomUUID(), [descriptor.moduleId, generationKey, attempt]);
  const executionContext = useMemo(() => moduleExecutionContextSchema.parse({
    userId: session.user_id,
    tenantId: context.tenant_id,
    farmId: context.fazenda_id,
    retreatId: context.retiro_id,
    moduleId: descriptor.moduleId,
    profileId: context.profile_id,
    deviceId: session.device_id,
    productId: 'consubov'
  }) satisfies ModuleExecutionContext, [session, context, descriptor.moduleId]);
  const entryOriginMatches = new URL(descriptor.entryUrl, window.location.href).origin === descriptor.expectedOrigin;
  useEffect(() => {
    const notify = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const changedContext = moduleExecutionContextSchema.safeParse(detail?.context);
      if (!changedContext.success || detail.sessionId !== session.session_id || detail.contextId !== context.context_id ||
          !(Date.parse(session.expires_at) > Date.now()) ||
          (Object.keys(executionContext) as Array<keyof ModuleExecutionContext>).some(key => changedContext.data[key] !== executionContext[key])) return;
      channelRef.current?.postMessage(shellDataChangedSchema.parse({ kind: 'shell:data-changed', protocolVersion: 1,
        moduleId: descriptor.moduleId, nonce }));
    };
    window.addEventListener('consubov:local-data-changed', notify);
    return () => window.removeEventListener('consubov:local-data-changed', notify);
  }, [session.session_id, session.expires_at, context.context_id, executionContext, descriptor.moduleId, nonce]);
  const entryUrl = useMemo(() => {
    const url = new URL(descriptor.entryUrl, window.location.href);
    url.searchParams.set('nonce', nonce);
    return url.toString();
  }, [descriptor.entryUrl, nonce]);

  useEffect(() => {
    let active = true;
    setArtifactReady(false);
    setArtifactDocument(undefined);
    setState('loading');
    setRuntimeError(false);
    healthy.current = false;
    pinned.current = null;
    if (!entryOriginMatches || !session.session_id || !context.context_id || !currentContext.current()) { setState('failed'); return; }
    const isCurrent = () => active && currentContext.current() && currentLoad.current === loadIdentity;
    const selected = nextPinned.current;
    nextPinned.current = null;
    void (selected ? Promise.resolve(selected) : provisionModuleArtifact(descriptor.moduleId, descriptor.entryUrl, isCurrent)).then(async provisioned => {
      if (!provisioned || provisioned.moduleId !== descriptor.moduleId || !isCurrent()) throw new Error('Module unavailable.');
      pinned.current = provisioned;
      const document = await createIsolatedModuleDocument(provisioned, nonce);
      // Recheck the authorized generation after provisioning's asynchronous boundary.
      if (!active || !currentContext.current()) return;
      if (provisioned) { setArtifactDocument(document); setArtifactReady(true); }
      else setState('failed');
    }).catch(() => {
      if (!isCurrent()) return;
      if (pinned.current) void recover(pinned.current, isCurrent, 'integrity');
      else setState('failed');
    });
    return () => { active = false; };
  }, [descriptor.moduleId, descriptor.entryUrl, entryOriginMatches, generationKey, session.session_id, context.context_id, context.capabilities, attempt, nonce]);

  useLayoutEffect(() => {
    channelRef.current?.close();
    channelRef.current = null;
    if (!entryOriginMatches || !artifactReady) {
      if (!entryOriginMatches) {
      setState('failed');
      }
      return;
    }
    setState('loading');
    const frame = frameRef.current;
    if (!frame) return;
    let generationActive = true;
    const artifact = pinned.current;
    const isCurrent = () => generationActive && currentContext.current() && currentLoad.current === loadIdentity;
    const timeout = window.setTimeout(() => {
      if (!healthy.current && artifact) void recover(artifact, isCurrent, 'handshake');
    }, HANDSHAKE_TIMEOUT_MS);
    let localData: QuiescentLocalData | null = null;
    let unregisterHost: (() => void) | undefined;
    let disposeHost: (() => void) | undefined;
    const seenRequests = new Set<string>();

    const onHello = (event: MessageEvent) => {
      // sandbox="allow-scripts" gives the frame an opaque origin; source, nonce and registry identity bind bootstrap.
      if (event.source !== frame.contentWindow || event.origin !== 'null') return;
      const helloResult = moduleHelloSchema.safeParse(event.data);
      if (!helloResult.success || helloResult.data.nonce !== nonce || helloResult.data.moduleId !== descriptor.moduleId ||
          helloResult.data.profileId !== descriptor.profileId || channelRef.current) return;
      if (!artifact || helloResult.data.version !== artifact.manifest.version) {
        if (artifact) void recover(artifact, isCurrent, 'compatibility');
        return;
      }

      const allowedCapabilities = descriptor.capabilities.filter(capability => context.capabilities.includes(capability));
      const init = shellModuleInitSchema.parse({
        kind: 'shell:init', protocolVersion: 1,
        moduleId: descriptor.moduleId, profileId: descriptor.profileId,
        version: helloResult.data.version, nonce, context: executionContext,
        capabilities: allowedCapabilities, language: languageRef.current
      });
      const channel = new MessageChannel();
      localData = new QuiescentLocalData(executionContext, () => isCurrent() && !globalQuiescenceRegistry.isFrozen() && Date.parse(session.expires_at) > Date.now());
      channelRef.current = channel.port1;
      const participant = createModuleQuiescenceHost(channel.port1, { moduleId: descriptor.moduleId, nonce, isCurrent });
      host.current = participant;
      disposeHost = () => { participant.dispose(); if (host.current === participant) host.current = null; };
      unregisterHost = registerModuleActivationParticipant(participant);
      channel.port1.onmessage = async message => {
        const health = moduleHealthSchema.safeParse(message.data);
        if (health.success && artifact && health.data.nonce === nonce && health.data.moduleId === descriptor.moduleId &&
            health.data.profileId === descriptor.profileId && health.data.version === artifact.manifest.version && isCurrent()) {
          if (!healthy.current) {
            // UI health belongs to this immutable document. A newer staged
            // candidate may legitimately prevent its durable pointer promotion.
            healthy.current = true;
            try { const confirmed = await confirmModuleArtifact(artifact, isCurrent); if (isCurrent()) pinned.current = confirmed; }
            catch { /* Keep the verified running document; never resurrect a superseded candidate. */ }
          }
          return;
        }
        const failure = moduleRuntimeFailureSchema.safeParse(message.data);
        if (failure.success && artifact && failure.data.nonce === nonce && failure.data.moduleId === descriptor.moduleId &&
            failure.data.profileId === descriptor.profileId && failure.data.version === artifact.manifest.version) {
          void recover(artifact, isCurrent); return;
        }
        const ready = moduleReadySchema.safeParse(message.data);
        if (ready.success && ready.data.nonce === nonce && ready.data.moduleId === descriptor.moduleId &&
            ready.data.profileId === descriptor.profileId && isCurrent()) {
          // Installed v1 documents predate module:healthy. Their verified healthy
          // pointer plus this bound handshake preserves availability, without
          // promoting candidates or asserting an absent quiescence bridge.
          if (artifact?.legacy === true && artifact.health === 'healthy') healthy.current = true;
          setState('ready'); return;
        }
        const request = moduleRpcRequestSchema.safeParse(message.data);
        if (!request.success || !generationActive || request.data.moduleId !== descriptor.moduleId || request.data.nonce !== nonce) {
          if (message.data?.kind === 'request' && typeof message.data?.requestId === 'string') {
            const unsupported = message.data?.protocolVersion !== 1;
            channel.port1.postMessage(moduleRpcResponseSchema.parse({ protocolVersion: 1, kind: 'response', moduleId: descriptor.moduleId, nonce, requestId: message.data.requestId, ok: false, error: { code: unsupported ? 'UNSUPPORTED_PROTOCOL' : 'INVALID_MESSAGE', message: unsupported ? 'Versão do protocolo local não suportada.' : 'Solicitação local inválida.' } }));
          }
          return;
        }
        const rpc = request.data;
        const fail = (code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_MESSAGE' | 'MODULE_FAILURE' | 'ATTACHMENTS_UNAVAILABLE' | 'STORAGE_QUOTA', text: string) => {
          if (generationActive) channel.port1.postMessage(moduleRpcResponseSchema.parse({ protocolVersion: 1, kind: 'response', moduleId: descriptor.moduleId, nonce, requestId: rpc.requestId, ok: false, error: { code, message: text } }));
        };
        if (seenRequests.has(rpc.requestId)) return;
        if (seenRequests.size >= 4096) { fail('INVALID_MESSAGE', 'Limite da sessão local atingido; reabra o módulo.'); return; }
        seenRequests.add(rpc.requestId);
        const requiredCapability = RPC_CAPABILITY[rpc.method];
        if (!session.session_id || !context.context_id || !localData || !currentContext.current() || !(Date.parse(session.expires_at) > Date.now())) { fail('UNAUTHORIZED', 'Sessão local não autorizada.'); return; }
        if (!requiredCapability || !allowedCapabilities.includes(requiredCapability)) { fail('FORBIDDEN', 'Operação local não autorizada.'); return; }
        try {
          const payload = rpc.payload as Record<string, any>;
          let result: unknown;
          switch (rpc.method) {
            case 'readSnapshot': result = await localData.readSnapshot(executionContext, payload.aggregateType, payload.aggregateId); break;
            case 'listSnapshots': result = await localData.listSnapshots(executionContext, payload.aggregateType); break;
            case 'commitMutation': result = await localData.commitMutation(executionContext, payload as unknown as LocalMutation); break;
            case 'readAttachment': result = await localData.readAttachment(executionContext, payload.attachmentId); break;
            case 'listPendingCommands': result = await localData.listPendingCommands(executionContext, payload.limit); break;
            case 'listOperationIssues': result = await localData.listOperationIssues(executionContext, payload.limit); break;
            case 'getCursor': result = await localData.getCursor(executionContext); break;
            case 'getSchemaVersion': result = await localData.getSchemaVersion(executionContext); break;
          }
          if (!generationActive) return;
          channel.port1.postMessage(moduleRpcResponseSchema.parse({ protocolVersion: 1, kind: 'response', moduleId: descriptor.moduleId, nonce, requestId: rpc.requestId, ok: true, result }));
        } catch (error) {
          const exceptionName = error instanceof Error && /^[A-Za-z]{1,40}$/.test(error.name) ? error.name : 'UnknownError';
          console.warn('[MODULE_LOCAL_DATA_FAILURE]', rpc.method, exceptionName);
          const errorName = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
          if (errorName === 'StaleModuleStateError') fail('MODULE_FAILURE', 'Estado local desatualizado. Revise os dados e tente salvar novamente.');
          else if (errorName === 'QuotaExceededError' || errorName === 'StorageQuotaExceededError') fail('STORAGE_QUOTA', 'O armazenamento local está cheio. Libere espaço no dispositivo e tente novamente.');
          else fail('MODULE_FAILURE', 'A operação local falhou; nenhuma confirmação foi retornada.');
        }
      };
      channel.port1.start();
      frame.contentWindow?.postMessage(init, '*', [channel.port2]);
    };

    window.addEventListener('message', onHello);
    return () => {
      window.clearTimeout(timeout);
      generationActive = false;
      unregisterHost?.();
      disposeHost?.();
      seenRequests.clear();
      localData = null;
      window.removeEventListener('message', onHello);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [nonce, generationKey, descriptor, context, executionContext, entryOriginMatches, artifactReady, attempt]);

  useEffect(() => {
    let active = true;
    let checking = false;
    const isCurrent = () => active && currentLoad.current === loadIdentity && currentContext.current();
    const check = async () => {
      if (checking || !isCurrent() || document.visibilityState === 'hidden') return;
      checking = true;
      try {
        if (pendingSwitch.current) { await switchSafely(pendingSwitch.current, isCurrent); return; }
        if (!healthy.current || recovering.current || !pinned.current) return;
        const candidate = await provisionModuleArtifact(descriptor.moduleId, descriptor.entryUrl, isCurrent);
        if (!isCurrent() || candidate.generation === pinned.current?.generation || failedGenerations.current.has(candidate.generation)) return;
        pendingSwitch.current = candidate;
        await switchSafely(candidate, isCurrent);
      } catch { /* Cached working UI remains available when checking a release fails. */ }
      finally { checking = false; }
    };
    const notify = () => { void check(); };
    const timer = window.setInterval(notify, 30000);
    window.addEventListener('focus', notify); window.addEventListener('online', notify); document.addEventListener('visibilitychange', notify);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', notify); window.removeEventListener('online', notify); document.removeEventListener('visibilitychange', notify); };
  }, [loadIdentity, descriptor.moduleId, descriptor.entryUrl]);

  useEffect(() => {
    const change = shellLanguageChangeSchema.parse({ kind: 'shell:language-changed', protocolVersion: 1, language });
    channelRef.current?.postMessage(change);
  }, [language]);

  return (
    <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} aria-busy={entryOriginMatches && state === 'loading'}>
      {runtimeError && state === 'ready' && <div role="alert">{t('error.moduleOperation', 'O módulo encontrou uma falha. Preserve seu trabalho e reabra quando terminar.')}</div>}
      {entryOriginMatches && state === 'loading' && <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0 }}>{t('state.loading', 'Carregando módulo…')}</div>}
      {state === 'failed' && <div role="alert" style={{ padding: 24 }}>
        {t('error.moduleLoad', 'Não foi possível abrir este módulo. Tente novamente.')}
        <button type="button" onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>{t('common.retry', 'Tentar novamente')}</button>
      </div>}
      {entryOriginMatches && artifactReady && <iframe
        key={`${descriptor.moduleId}:${generationKey}:${attempt}`}
        ref={frameRef}
        title={descriptor.titleKey}
        src={artifactDocument ? undefined : entryUrl}
        srcDoc={artifactDocument}
        sandbox="allow-scripts allow-forms allow-downloads"
        referrerPolicy="no-referrer"
        onError={() => { const artifact = pinned.current; if (artifact) void recover(artifact, () => currentLoad.current === loadIdentity && currentContext.current(), 'runtime'); else setState('failed'); }}
        style={{ display: state === 'ready' ? 'block' : 'none', flex: 1, width: '100%', minHeight: 0, border: 0 }}
      />}
    </section>
  );
};
