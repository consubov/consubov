import { afterEach, beforeEach, expect, test } from 'bun:test';
import { QuiescenceRegistry } from '@consubov/module-release';
import { UpdateCoordinator } from '../../apps/fazenda/shell/src/pwa/UpdateCoordinator';
import { createWindowActivationBarrier } from '../../apps/fazenda/shell/src/pwa/activationBarrier';

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const restore = new Map<string, PropertyDescriptor | undefined>();
const coordinators: UpdateCoordinator[] = [];
let reloads = 0;
let lifecycle: EventTarget;
beforeEach(() => {
  for (const name of ['location', 'window', 'navigator']) restore.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  reloads = 0;
  lifecycle = new EventTarget();
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://app.test/') });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { reload: () => reloads++ } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: lifecycle } });
});
afterEach(() => {
  coordinators.splice(0).forEach(coordinator => coordinator.destroy());
  for (const [name, descriptor] of restore) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function fixture(options: { active?: boolean; pending?: boolean; allowed?: boolean; ttlMs?: number } = {}) {
  const events = new EventTarget();
  const messages: any[] = [];
  let verification = { type: 'WAITING_WORKER_VERIFIED', version: 'generation-2', scriptURL: 'https://app.test/sw.js', pending: options.pending ?? true, compatible: true, canActivate: options.allowed ?? true };
  let consent: ((port: MessagePort, message: any) => void) | undefined;
  let verifyHook: (() => void) | undefined;
  const worker = {
    state: options.active ? 'activated' : 'installed', scriptURL: 'https://app.test/sw.js',
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    postMessage(message: any, ports: MessagePort[]) {
      const port = ports[0];
      if (!port) throw new Error('Worker request requires a response port');
      messages.push(message);
      if (message.type === 'VERIFY_WAITING_WORKER') { verifyHook?.(); port.postMessage(verification); }
      else if (consent) consent(port, message);
      else { activate(); port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: message.version }); }
    }
  };
  const registration = { waiting: options.active ? null : worker, active: options.active ? worker : null, installing: null, onupdatefound: null, update: async () => {} };
  function activate() {
    worker.state = 'activated'; registration.waiting = null; registration.active = worker;
    lifecycle.dispatchEvent(new Event('controllerchange')); events.dispatchEvent(new Event('statechange'));
  }
  const registry = new QuiescenceRegistry();
  const barrier = createWindowActivationBarrier({ registry, ttlMs: options.ttlMs });
  let notifications = 0;
  const coordinator = new UpdateCoordinator({ quiescenceRegistry: registry, checkIntervalMs: 0,
    prepareWindowActivation: barrier.prepareWindowActivation, onUpdateAvailable: () => notifications++ });
  coordinators.push(coordinator);
  coordinator.initialize(registration as unknown as ServiceWorkerRegistration);
  return { coordinator, registry, messages, worker, registration, activate, barrier,
    get notifications() { return notifications; }, setVerification: (value: Partial<typeof verification>) => { verification = { ...verification, ...value }; },
    onConsent: (callback: typeof consent) => { consent = callback; }, onVerify: (callback: () => void) => { verifyHook = callback; } };
}

test('verified waiting candidate is announced, never auto activated; explicit acceptance freezes and reloads', async () => {
  const f = fixture();
  await tick();
  expect(f.notifications).toBe(1);
  expect(f.coordinator.isPending()).toBe(true);
  expect(f.messages.map(m => m.type)).toEqual(['VERIFY_WAITING_WORKER']);
  f.onConsent((port, message) => {
    expect(f.registry.isFrozen()).toBe(true);
    expect(message.version).toBe('generation-2');
    expect(message.clientDeadline).toBeGreaterThan(Date.now());
    expect(() => f.registry.acquireLock('late work', 'FORM_DIRTY')).toThrow();
    f.activate();
    expect(reloads).toBe(0);
    port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: message.version });
  });
  expect(await f.coordinator.activateWaitingWorker()).toBe(true);
  expect(reloads).toBe(1);
  expect(f.registry.isFrozen()).toBe(false);
});

test('cold already active worker still requires explicit consent for its pending shell', async () => {
  const f = fixture({ active: true });
  await tick();
  lifecycle.dispatchEvent(new Event('controllerchange'));
  await tick();
  expect(f.coordinator.isPending()).toBe(true);
  expect(reloads).toBe(0);
  expect(f.messages.every(m => m.type === 'VERIFY_WAITING_WORKER')).toBe(true);
  expect(await f.coordinator.activateWaitingWorker()).toBe(true);
  expect(reloads).toBe(1);
});

test('already current shell has no update prompt or consent request', async () => {
  const f = fixture({ active: true, pending: false });
  await tick();
  expect(f.notifications).toBe(0);
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  expect(f.messages.some(m => m.type === 'ACTIVATE_WITH_CONSENT')).toBe(false);
});

for (const lock of ['FORM_DIRTY', 'CAMERA_ACTIVE', 'WEIGHING_ACTIVE', 'OUTBOX_SYNCING', 'QR_SCANNING', 'LOCAL_DB_TRANSACTION'] as const) {
  test(`critical work ${lock} blocks without interruption or implicit consent on release`, async () => {
    const f = fixture();
    const release = f.registry.acquireLock('real operation', lock);
    await tick();
    expect(f.coordinator.isHoldingForQuiescence()).toBe(true);
    expect(await f.coordinator.activateWaitingWorker()).toBe(false);
    release(); await tick();
    expect(f.messages.some(m => m.type === 'ACTIVATE_WITH_CONSENT')).toBe(false);
    expect(await f.coordinator.activateWaitingWorker()).toBe(true);
  });
}

test('work arriving during worker verification prevents lease preparation', async () => {
  const f = fixture(); await tick();
  let release: (() => void) | undefined;
  f.onVerify(() => { release = f.registry.acquireLock('late operation', 'FORM_DIRTY'); });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  expect(f.messages.some(m => m.type === 'ACTIVATE_WITH_CONSENT')).toBe(false);
  release?.();
});

test('unknown module status and extra windows block activation', async () => {
  const f = fixture(); await tick();
  f.barrier.registerModuleActivationParticipant({ isVerifiedQuiet: () => false, prepare: async () => null });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  const g = fixture({ allowed: false }); await tick();
  expect(await g.coordinator.activateWaitingWorker()).toBe(false);
  expect(g.messages.some(m => m.type === 'ACTIVATE_WITH_CONSENT')).toBe(false);
});

test('controller change before rejected acknowledgement never reloads and releases lease', async () => {
  const f = fixture(); await tick();
  f.onConsent(port => { f.activate(); port.postMessage({ type: 'SHELL_ACTIVATION_BLOCKED', accepted: false, reason: 'OTHER_CLIENTS_OPEN' }); });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  lifecycle.dispatchEvent(new Event('controllerchange')); await tick();
  expect(reloads).toBe(0);
  expect(f.registry.isFrozen()).toBe(false);
});

test('accepted acknowledgement arriving after lease expiration never reloads', async () => {
  const f = fixture({ ttlMs: 30 }); await tick();
  f.onConsent((port, message) => {
    f.activate();
    setTimeout(() => port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: message.version }), 50);
  });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  await tick();
  expect(reloads).toBe(0);
  expect(f.registry.isFrozen()).toBe(false);
});

test('module proof invalidated after accepted acknowledgement blocks reload', async () => {
  const f = fixture(); await tick();
  let valid = true;
  let released = 0;
  f.barrier.registerModuleActivationParticipant({ isVerifiedQuiet: () => true,
    prepare: async () => ({ expiresAt: Date.now() + 1000, verify: async () => valid, release: () => released++ }) });
  f.onConsent((port, message) => { f.activate(); valid = false; port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: message.version }); });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  expect(reloads).toBe(0);
  expect(released).toBe(1);
  expect(f.registry.isFrozen()).toBe(false);
});

test('destroy while awaiting acknowledgement cancels operation, releases and prevents late reload', async () => {
  const f = fixture(); await tick();
  let reply: MessagePort | undefined;
  f.onConsent(port => { reply = port; });
  const result = f.coordinator.activateWaitingWorker();
  await tick();
  expect(f.registry.isFrozen()).toBe(true);
  f.coordinator.destroy();
  expect(await result).toBe(false);
  f.activate(); reply?.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: 'generation-2' });
  await tick(); expect(reloads).toBe(0); expect(f.registry.isFrozen()).toBe(false);
});

test('accepted acknowledgement still waits for verified worker activation before reload', async () => {
  const f = fixture(); await tick();
  f.onConsent((port, message) => port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: message.version }));
  const result = f.coordinator.activateWaitingWorker();
  await tick();
  expect(reloads).toBe(0);
  expect(f.registry.isFrozen()).toBe(true);
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  f.activate();
  expect(await result).toBe(true);
  expect(reloads).toBe(1);
});

test('foreign worker identity and incompatible generation cannot receive consent', async () => {
  const f = fixture(); await tick();
  f.setVerification({ scriptURL: 'https://foreign.test/sw.js' });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  f.setVerification({ scriptURL: f.worker.scriptURL, compatible: false });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  expect(f.messages.some(m => m.type === 'ACTIVATE_WITH_CONSENT')).toBe(false);
});

test('acknowledgement for another generation is rejected even after controller change', async () => {
  const f = fixture(); await tick();
  f.onConsent(port => { f.activate(); port.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: 'other-generation' }); });
  expect(await f.coordinator.activateWaitingWorker()).toBe(false);
  expect(reloads).toBe(0);
  expect(f.registry.isFrozen()).toBe(false);
});
