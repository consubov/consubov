import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPersistentProfilePaths } from './persistent-profile-path.mjs';

const root = resolve(import.meta.dirname, '../..');
const playwrightEntry = resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs');
const { chromium, webkit } = await import(pathToFileURL(playwrightEntry).href);
const profiles = ['capataz', 'gerente', 'escritorio', 'fabrica'];
const credentials = Object.fromEntries(profiles.map(profile => [profile, `${profile}.lab@consubov.local`]));
const origin = `http://127.0.0.1:${process.env.T03_PORT ?? '5187'}`;
const moduleReadyTimeout = Number(process.env.T03_READY_TIMEOUT ?? 45000);
const runId = `t03-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`;
// WebKit appends hashed CacheStorage paths; keep the owned profile path short on Windows.
const runRoot = resolve(root, '.qa/tmp', `c-${process.pid}-${crypto.randomUUID().slice(0, 8)}`);
const reportPath = resolve(root, '.qa/runs', `${runId}.json`);
const results = [];
let profilePaths;

async function ensureMutation(frame, profile) {
  if (profile === 'capataz') {
    const existing = await frame.locator('[data-testid="capataz-cocho-tab"]').textContent();
    const used = new Set([...existing.matchAll(/\b(\d+)\s+sacos?\b/gi)].map(match => Number(match[1])));
    const bags = Array.from({ length: 93 }, (_, index) => index + 7).find(value => !used.has(value));
    if (bags === undefined) throw new Error('No distinct visible bag count available for this QA mutation.');
    await frame.locator('#cocho-input-notes').fill(`T03 offline ${runId}`);
    await frame.locator('#cocho-input-bags').fill(String(bags));
    await frame.locator('[data-testid="capataz-cocho-tab"] form button[type="submit"]').click();
    await frame.getByText(new RegExp(`\\b${bags}\\s+sacos?\\b`, 'i')).waitFor({ state: 'visible', timeout: 12000 });
    return `${bags} sacos`;
  } else if (profile === 'gerente') {
    await frame.getByRole('tab', { name: /Metas e Curvas de GMD/i }).click();
    await frame.getByLabel('GMD Alvo (kg/dia)').fill('1.65');
    await frame.locator('[data-testid="gerente-gmd-tab"] form').first().locator('button[type="submit"]').click();
    await frame.getByRole('tab', { name: /Visão Geral da Produção/i }).click();
    await frame.getByText('1.65', { exact: true }).waitFor({ state: 'visible', timeout: 12000 });
    return '1.65';
  } else if (profile === 'escritorio') {
    await frame.getByRole('tab', { name: /Notas Fiscais/i }).click();
    const invoiceNumber = `T03${Date.now().toString().slice(-6)}`;
    await frame.getByLabel('Número da NF').fill(invoiceNumber);
    await frame.locator('[data-testid="escritorio-notas-tab"] form button[type="submit"]').click();
    await frame.getByText(new RegExp(invoiceNumber)).waitFor({ state: 'visible', timeout: 12000 });
    return invoiceNumber;
  } else {
    await frame.getByRole('tab', { name: /Fórmulas Nutricionais/i }).click();
    const formulaName = `T03 ${Date.now()}`;
    await frame.getByLabel('Nome da Fórmula').fill(formulaName);
    await frame.locator('[data-testid="fabrica-formulas-tab"] form button[type="submit"]').click();
    await frame.getByText(formulaName, { exact: true }).waitFor({ state: 'visible', timeout: 12000 });
    return formulaName;
  }
  const visible = profile === 'capataz'
    ? frame.getByRole('status').filter({ hasText: /salv|registr|saved/i }).first()
    : frame.getByText(/salv|atualizad|registrad/i).first();
  await visible.waitFor({ state: 'visible', timeout: 12000 });
}

async function readRenderedBusinessText(frame) {
  return frame.locator('body').evaluate(element => {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('[role="status"]').forEach(node => node.remove());
    copy.querySelectorAll('p').forEach(node => {
      if (/salva no catálogo|atualizadas com sucesso|registrada com sucesso/i.test(node.textContent ?? '')) node.remove();
    });
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

async function waitForRenderedMutation(frame, profile, expectedValue) {
  const record = profile === 'capataz'
    ? frame.getByText(new RegExp(`\\b${expectedValue.replace(' ', '\\s+')}\\b`, 'i'))
    : profile === 'escritorio'
      ? frame.getByText(new RegExp(expectedValue))
    : frame.getByText(expectedValue, { exact: true });
  await record.waitFor({ state: 'visible', timeout: 15000 });
}

async function selectDataTabAfterReopen(frame, profile) {
  const tabName = {
    capataz: /Ronda de Cocho/i,
    gerente: /Visão Geral da Produção/i,
    escritorio: /Notas Fiscais/i,
    fabrica: /Fórmulas Nutricionais/i
  }[profile];
  await frame.getByRole('tab', { name: tabName }).click();
}

async function readLocalState(page, profile) {
  return await page.evaluate(async profileId => {
    const databases = await indexedDB.databases();
    const names = databases.map(item => item.name).filter(name => name?.startsWith('consubov-local-'));
    const matching = names.filter(name => {
      try {
        const partition = JSON.parse(decodeURIComponent(name.slice('consubov-local-'.length)));
        return partition[0] === 'consubov' && partition[1] === profileId;
      } catch { return false; }
    });
    if (matching.length !== 1) throw new Error(`Expected exactly one IndexedDB partition for ${profileId}; found ${matching.length}.`);
    const name = matching[0];
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise((resolve, reject) => {
      const tx = db.transaction(['snapshots', 'outbox'], 'readonly');
      const pending = {};
      for (const storeName of ['snapshots', 'outbox']) {
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => { pending[storeName] = request.result; if (pending.snapshots && pending.outbox) resolve(pending); };
        request.onerror = () => reject(request.error);
      }
    });
    db.close();
    return { database: name, snapshotCount: values.snapshots.length, outboxCount: values.outbox.length, snapshots: values.snapshots, outbox: values.outbox };
  }, profile);
}

async function readModuleCacheState(page, profile) {
  return page.evaluate(async profileId => {
    const names = await caches.keys();
    const details = [];
    for (const name of names) {
      if (!name.startsWith(`consubov-module-${profileId}-`) && name !== 'consubov-module-pointers-v1') continue;
      const cache = await caches.open(name);
      const requests = await cache.keys();
      details.push({ name, paths: requests.map(request => new URL(request.url).pathname + new URL(request.url).search) });
    }
    return details;
  }, profile);
}

async function readFrameServiceWorkerState(page) {
  const frame = page.frames().find(item => item.url().includes('/modules/') || item.url() === 'about:srcdoc');
  if (!frame) return { frameFound: false };
  try {
    return await frame.evaluate(() => ({
      frameFound: true,
      serviceWorkerAvailable: 'serviceWorker' in navigator,
      controlled: 'serviceWorker' in navigator ? Boolean(navigator.serviceWorker.controller) : false
    }));
  } catch (error) {
    return { frameFound: true, error: String(error) };
  }
}

async function waitForShellController(page) {
  const wait = () => page.evaluate(async () => {
    const registrations = async () => 'serviceWorker' in navigator
      ? (await navigator.serviceWorker.getRegistrations()).map(item => ({ scope: item.scope, active: item.active?.state, waiting: item.waiting?.state, installing: item.installing?.state }))
      : [];
    if (!('serviceWorker' in navigator)) return { supported: false, secureContext: isSecureContext, controlled: false, registrations: [] };
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(registration => ({ registration })),
      new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 10000))
    ]);
    if ('timeout' in ready) return { supported: true, secureContext: isSecureContext, controlled: Boolean(navigator.serviceWorker.controller), ready: 'timeout', registrations: await registrations() };
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 5000);
        navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
    return { supported: true, secureContext: isSecureContext, controlled: Boolean(navigator.serviceWorker.controller), ready: 'resolved', registrations: await registrations() };
  });
  let state = await wait();
  if (!state.controlled) {
    await page.reload({ waitUntil: 'networkidle' });
    state = await wait();
  }
  if (!state.controlled) {
    const shellInstallFailures = await page.evaluate(() => window.__t03ShellInstallFailures ?? []);
    const diagnostic = await page.evaluate(async () => {
      const stateHistory = [];
      let registrationAttempt;
      registrationAttempt = await Promise.race([
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
          const worker = registration.installing ?? registration.waiting ?? registration.active;
          if (worker) {
            stateHistory.push(worker.state);
            worker.addEventListener('statechange', () => stateHistory.push(worker.state));
          }
          return { succeeded: true, scope: registration.scope, active: registration.active?.state, installing: registration.installing?.state, waiting: registration.waiting?.state };
        }).catch(error => ({ succeeded: false, name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) })),
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 8000))
      ]);
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(registration => ({ active: registration.active?.state })),
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), 8000))
      ]);
      return {
        registrationAttempt,
        stateHistory,
        ready,
        controller: Boolean(navigator.serviceWorker.controller),
        registrations: (await navigator.serviceWorker.getRegistrations()).map(item => ({ scope: item.scope, active: item.active?.state, waiting: item.waiting?.state, installing: item.installing?.state }))
      };
    });
    throw new Error(`Shell service worker did not control the page: initial=${JSON.stringify(state)} diagnostic=${JSON.stringify(diagnostic)} installFailures=${JSON.stringify(shellInstallFailures)}`);
  }
}

async function exercise(browserType, profile) {
  const userDir = resolve(runRoot, browserType.name(), profile);
  await mkdir(userDir, { recursive: true });
  let context = await browserType.launchPersistentContext(profilePaths.browserPath(userDir), { headless: true, serviceWorkers: 'allow' });
  try {
    let page = context.pages()[0] ?? await context.newPage();
    const consoleErrors = [];
    const localDataWarnings = [];
    const offlineAuthNetworkFallbacks = [];
    const offlineApiFailures = [];
    let offlineMode = false;
    const offlineNetworkConsoleMessages = [];
    const resourceConsoleErrors = [];
    const unexpectedRequestFailures = [];
    const serviceWorkerWarnings = [];
    const serviceWorkerResponses = [];
    await page.addInitScript(() => {
      if (window !== window.top || !('serviceWorker' in navigator)) return;
      window.__t03ShellInstallFailures = [];
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SHELL_INSTALL_FAILED') window.__t03ShellInstallFailures.push(event.data);
      });
    });
    const observeConsole = message => {
      if (message.type() === 'error') {
        if (message.text().startsWith('Failed to load resource:')) resourceConsoleErrors.push({ text: message.text(), url: message.location().url });
        else if (message.text().includes('ERR_INTERNET_DISCONNECTED')) offlineNetworkConsoleMessages.push(message.text());
        else consoleErrors.push(message.text());
      }
      if (message.type() === 'warning' && message.text().startsWith('[MODULE_LOCAL_DATA_FAILURE]')) localDataWarnings.push(message.text());
      if (message.type() === 'warning' && message.text().startsWith('[SW_REGISTRATION_FAILED]')) serviceWorkerWarnings.push(message.text());
    };
    const observeRequestFailure = request => {
      const failure = { url: request.url(), method: request.method(), type: request.resourceType(), error: request.failure()?.errorText ?? 'unknown' };
      let url;
      try { url = new URL(failure.url); } catch { unexpectedRequestFailures.push(failure); return; }
      const expectedApi = (url.pathname === '/api/v1/auth/login' && failure.method === 'POST') ||
        (url.pathname === '/api/v1/commands' && failure.method === 'POST') ||
        (url.pathname === '/api/v1/sync' && failure.method === 'GET') ||
        (/^\/api\/v1\/attachments\/[a-f0-9-]{36}$/i.test(url.pathname) && ['GET', 'PUT'].includes(failure.method));
      if (offlineMode && expectedApi && ['fetch', 'xhr'].includes(failure.type)) {
        offlineApiFailures.push(failure);
        if (url.pathname === '/api/v1/auth/login') offlineAuthNetworkFallbacks.push(failure);
      } else unexpectedRequestFailures.push(failure);
    };
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('console', observeConsole);
    page.on('requestfailed', observeRequestFailure);
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname === '/sw.js' || url.pathname === '/shell-assets.json') {
        serviceWorkerResponses.push({ path: url.pathname, status: response.status(), contentType: response.headers()['content-type'] ?? '' });
      }
    });
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    try { await waitForShellController(page); }
    catch (error) {
      throw new Error(`Initial shell control barrier failed for ${browserType.name()} ${profile}; warnings=${JSON.stringify(serviceWorkerWarnings)} responses=${JSON.stringify(serviceWorkerResponses)} console=${JSON.stringify(consoleErrors)} cause=${String(error)}`);
    }
    // A fresh browser process has no in-memory session. Wait for React hydration;
    // count() immediately after DOMContentLoaded can skip the required login entirely.
    await page.locator('#login-email').waitFor({ state: 'visible', timeout: moduleReadyTimeout });
    await page.locator('#login-email').fill(credentials[profile]);
    await page.locator('#login-password').fill('lab@123456');
    await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
    await page.getByRole('button', { name: /Acessar Este Contexto/i }).click();
    let frameLocator = page.frameLocator('iframe');
    try { await frameLocator.locator('[data-testid]').first().waitFor({ state: 'visible', timeout: moduleReadyTimeout }); }
    catch (error) {
      const alerts = await page.getByRole('alert').allTextContents();
      const frames = page.frames().map(frame => ({ url: frame.url(), name: frame.name() }));
      throw new Error(`${browserType.name()} module did not become ready for ${profile}; alerts=${JSON.stringify(alerts)} frames=${JSON.stringify(frames)} console=${JSON.stringify(consoleErrors)} cause=${String(error)}`);
    }
    offlineMode = true;
    await context.setOffline(true);
    const expectedRenderedValue = await ensureMutation(frameLocator, profile);
    const renderedBefore = await readRenderedBusinessText(frameLocator);
    if (!renderedBefore.toLowerCase().includes(expectedRenderedValue.toLowerCase())) {
      throw new Error(`${browserType.name()} ${profile}: submitted mutation is missing from rendered domain data.`);
    }
    const frameServiceWorker = await readFrameServiceWorkerState(page);
    const before = await readLocalState(page, profile);
    if (!before.database || before.snapshotCount < 1 || before.outboxCount < 1) throw new Error(`${browserType.name()} ${profile}: mutation did not persist snapshot and outbox.`);
    const persistedBefore = JSON.stringify([before.snapshots, before.outbox]);
    await page.evaluate(() => new Promise(resolve => navigator.serviceWorker.ready.then(resolve)));
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    if (!controlled) throw new Error(`${browserType.name()} ${profile}: shell page is not controlled by its service worker`);
    const moduleCacheBefore = await readModuleCacheState(page, profile);

    await context.close();
    context = await browserType.launchPersistentContext(profilePaths.browserPath(userDir), { headless: true, serviceWorkers: 'allow' });
    page = context.pages()[0] ?? await context.newPage();
    const reopenedRequests = [];
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/v1/auth/login') reopenedRequests.push({ method: request.method() }); });
    await page.addInitScript(() => {
      window.__t03SubmitCount = 0;
      document.addEventListener('submit', () => { window.__t03SubmitCount += 1; }, true);
    });
    page.on('pageerror', error => consoleErrors.push(error.message));
    page.on('console', observeConsole);
    page.on('requestfailed', observeRequestFailure);
    await page.context().setOffline(true);
    await page.goto(`${origin}/#/fazenda/${profile}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('load');
    await page.locator('#login-email').waitFor({ state: 'visible', timeout: moduleReadyTimeout });
    await page.locator('#login-email').fill(credentials[profile]);
    await page.locator('#login-password').fill('lab@123456');
    await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
    if (await page.getByRole('button', { name: /Acessar Este Contexto/i }).count()) {
      await page.getByRole('button', { name: /Acessar Este Contexto/i }).click();
    }
    frameLocator = page.frameLocator('iframe');
    try { await frameLocator.locator('[data-testid]').first().waitFor({ state: 'visible', timeout: moduleReadyTimeout }); }
    catch (error) {
      const alerts = await page.getByRole('alert').allTextContents();
      const frames = page.frames().map(frame => ({ url: frame.url(), name: frame.name() }));
      const moduleCacheAfter = await readModuleCacheState(page, profile);
      const loginState = await page.locator('form').evaluateAll(forms => forms.map(form => ({
        submitDisabled: form.querySelector('button[type="submit"]')?.disabled,
        submitText: form.querySelector('button[type="submit"]')?.textContent,
        emailLength: form.querySelector('#login-email')?.value.length,
        passwordLength: form.querySelector('#login-password')?.value.length,
        submits: window.__t03SubmitCount
      })));
      throw new Error(`Offline module did not become ready for ${browserType.name()} ${profile}; loginVisible=${await page.locator('#login-email').count() > 0} loginState=${JSON.stringify(loginState)} requests=${JSON.stringify(reopenedRequests)} authFailures=${JSON.stringify(offlineAuthNetworkFallbacks)} contextButtons=${await page.getByRole('button', { name: /Acessar Este Contexto/i }).count()} alerts=${JSON.stringify(alerts)} frames=${JSON.stringify(frames)} cacheBefore=${JSON.stringify(moduleCacheBefore)} cacheAfter=${JSON.stringify(moduleCacheAfter)} onlineFrameServiceWorker=${JSON.stringify(frameServiceWorker)} console=${JSON.stringify(consoleErrors)} cause=${String(error)}`);
    }
    await selectDataTabAfterReopen(frameLocator, profile);
    try { await waitForRenderedMutation(frameLocator, profile, expectedRenderedValue); }
    catch (error) {
      const alerts = await frameLocator.getByRole('alert').allTextContents().catch(() => []);
      throw new Error(`Offline module reopened but saved record did not render for ${profile}; expected=${JSON.stringify(expectedRenderedValue)} alerts=${JSON.stringify(alerts)} localDataWarnings=${JSON.stringify(localDataWarnings)} cause=${String(error)}`);
    }
    const after = await readLocalState(page, profile);
    const persistedAfter = JSON.stringify([after.snapshots, after.outbox]);
    const renderedAfter = await readRenderedBusinessText(frameLocator);
    const mutationRenderedAfterReopen = renderedAfter.toLowerCase().includes(expectedRenderedValue.toLowerCase());
    if (after.database !== before.database || persistedAfter !== persistedBefore || !mutationRenderedAfterReopen) {
      throw new Error(`${browserType.name()} ${profile}: cold offline reopen mismatch; databaseEqual=${after.database === before.database} persistedEqual=${persistedAfter === persistedBefore} mutationRenderedAfterReopen=${mutationRenderedAfterReopen} snapshots=${before.snapshotCount}->${after.snapshotCount} outbox=${before.outboxCount}->${after.outboxCount}.`);
    }
    const unexplainedResourceErrors = resourceConsoleErrors.filter(message => !offlineApiFailures.some(failure =>
      (!message.url || message.url === failure.url) && message.text === `Failed to load resource: ${failure.error}`
    ));
    if (consoleErrors.length || unexpectedRequestFailures.length || unexplainedResourceErrors.length || (offlineNetworkConsoleMessages.length && !offlineAuthNetworkFallbacks.length)) {
      throw new Error(`${browserType.name()} ${profile}: browser errors console=${JSON.stringify(consoleErrors)} resourceErrors=${JSON.stringify(unexplainedResourceErrors)} unexpectedRequests=${JSON.stringify(unexpectedRequestFailures)} offlineNetworkConsole=${JSON.stringify(offlineNetworkConsoleMessages)} authFallbacks=${JSON.stringify(offlineAuthNetworkFallbacks)}`);
    }
    return { browser: browserType.name(), profile, database: before.database, snapshotCount: before.snapshotCount, outboxCount: before.outboxCount, coldOfflineReload: true, mutationRenderedAfterReopen: true, offlineAuthNetworkFallbackCount: offlineAuthNetworkFallbacks.length, frameServiceWorker };
  } finally {
    await context.close();
  }
}

try {
  profilePaths = await createPersistentProfilePaths(runRoot);
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  const selectedProfiles = process.env.T03_PROFILE ? profiles.filter(profile => profile === process.env.T03_PROFILE) : profiles;
  const selectedBrowsers = process.env.T03_BROWSER === 'chromium' ? [chromium] : process.env.T03_BROWSER === 'webkit' ? [webkit] : [chromium, webkit];
  for (const browserType of selectedBrowsers) {
    for (const profile of selectedProfiles) results.push(await exercise(browserType, profile));
  }
  await writeFile(reportPath, JSON.stringify({ runId, origin, results }, null, 2));
  console.info(`T03 cold offline persistence verified: ${results.length} cases. Report: ${reportPath}`);
} catch (error) {
  await mkdir(resolve(root, '.qa/runs'), { recursive: true });
  await writeFile(reportPath, JSON.stringify({ runId, origin, results, error: String(error) }, null, 2));
  console.error(`T03 E2E failed. Report: ${reportPath}`);
  throw error;
} finally {
  await profilePaths?.dispose();
  // Only this unique runner-owned directory is eligible for cleanup.
  const expectedPrefix = resolve(root, '.qa/tmp');
  const ownedRelativePath = relative(expectedPrefix, runRoot);
  if (ownedRelativePath && ownedRelativePath !== '..' && !ownedRelativePath.startsWith('..\\') && !ownedRelativePath.startsWith('../') && !isAbsolute(ownedRelativePath)) {
    await rm(runRoot, { recursive: true, force: true });
  }
}
