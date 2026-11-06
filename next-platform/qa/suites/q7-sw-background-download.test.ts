import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Harness, artifact, shell } from '../../packages/module-release/test/worker-generations.test';

describe('Gate Q7.1: verified worker lifecycle and durable generation retention', () => {
  const swPath = resolve(import.meta.dir, '../../apps/fazenda/shell/public/sw.js');
  it('Q7.1.1: worker is present and the publisher receives an explicit build descriptor marker', () => {
    expect(existsSync(swPath)).toBe(true);
    expect(readFileSync(swPath, 'utf8')).toContain('const SHELL_RELEASE = null;');
  });
  it('Q7.1.2: install stages complete bytes without skipWaiting or activation', async () => {
    const release = await shell('candidate'); const h = new Harness(release.descriptor); h.publishShell(release); await h.lifecycle('install');
    expect(h.skipped).toBe(0);
    expect((await h.pointer('/__shell')).active).toBeNull();
    expect((await h.pointer('/__shell')).candidate.generation).toBe(release.descriptor.generation);
  });
  it('Q7.1.3: consent must match the verified build identity and worker URL', async () => {
    const release = await shell('candidate'); const h = new Harness(release.descriptor); h.publishShell(release); await h.lifecycle('install');
    expect((await h.message('ACTIVATE_WITH_CONSENT', { version: 'unknown', scriptURL:'https://app.test/sw.js' })).type).toBe('SHELL_ACTIVATION_BLOCKED');
    await h.message('ACTIVATE_WITH_CONSENT', { version:release.descriptor.generation, scriptURL:'https://foreign.test/sw.js' });
    expect(h.skipped).toBe(0);
    const verified = await h.message('VERIFY_WAITING_WORKER'); expect(verified.compatible).toBe(true); expect(verified.version).toBe(release.descriptor.generation);
    expect((await h.message('ACTIVATE_WITH_CONSENT', { version:verified.version, scriptURL:verified.scriptURL })).type).toBe('SHELL_ACTIVATION_ACCEPTED'); expect(h.skipped).toBe(1);
  });
  it('Q7.1.4: activation retains explicit current and previous shell pointers', async () => {
    const a = await shell('A'); const h = new Harness(a.descriptor); h.publishShell(a); await h.lifecycle('install'); await h.lifecycle('activate');
    const b = await shell('B'); const update = new Harness(b.descriptor, h.storage); update.publishShell(b); await update.lifecycle('install'); await update.message('ACTIVATE_WITH_CONSENT',{version:b.descriptor.generation,scriptURL:'https://app.test/sw.js'}); await update.lifecycle('activate');
    const state = await update.pointer('/__shell'); expect(state.active.generation).toBe(b.descriptor.generation); expect(state.previous.generation).toBe(a.descriptor.generation);
    expect(await (await (await h.storage.open(state.previous.cacheName)).match('/index.html'))?.text()).toContain('A');
  });
  it('Q7.1.5: retains verified generations until safe live-client collection and preserves explicit N/N-1', async () => {
    const h = new Harness(); const other = await artifact('gerente','1.0.0'); h.publish(other); const gerente = await h.prepare('gerente'); await h.healthy(gerente);
    const generations = [];
    for (const version of ['1.0.0','2.0.0','3.0.0']) { h.publish(await artifact('capataz',version)); const d = await h.prepare('capataz'); await h.healthy(d); generations.push(d); }
    const names = await h.storage.keys(); expect(names.includes(generations[0]!.cacheName)).toBe(true); expect(names.includes(generations[1]!.cacheName)).toBe(true); expect(names.includes(generations[2]!.cacheName)).toBe(true); expect(names.includes(gerente.cacheName)).toBe(true);
    expect((await h.pointer('/__modules/capataz')).previousHealthy.cacheName).toBe(generations[1]!.cacheName);
  });
  it('Q7.1.6: failed module download restores a verified prior generation without any unverified fetch fallback', async () => {
    const h = new Harness(); h.publish(await artifact('capataz','1.0.0')); const first = await h.prepare('capataz'); await h.healthy(first);
    const next = await artifact('capataz','2.0.0'); h.publish(next); h.routes.delete(next.root + 'module.js'); expect((await h.prepare('capataz')).cacheName).toBe(first.cacheName);
    expect(readFileSync(swPath,'utf8')).toContain("url.pathname.startsWith('/api/v1/')");
  });
});
