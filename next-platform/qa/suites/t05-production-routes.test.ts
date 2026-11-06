import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publishModule } from '../../apps/fazenda/shell/scripts/artifact-publisher';
import { createProductionHandler, safeFile } from '../scripts/serve-production-t03';

const root = resolve(import.meta.dir, '../../.qa/tmp', `production-routes-${randomUUID()}`);
const shellRoot = resolve(root, 'shell');
const moduleRoot = resolve(root, 'modules');
const handler = createProductionHandler({ shellRoot, moduleRoot });
const request = (path: string, method = 'GET') => handler(new Request(`http://127.0.0.1${path}`, { method }));

test('serves actual publisher selector, manifest and nested immutable bytes without SPA fallback', async () => {
  const staging = resolve(moduleRoot, 'capataz/.staging', randomUUID());
  await mkdir(resolve(staging, 'assets'), { recursive: true });
  await writeFile(resolve(staging, 'index.html'), '<script src="assets/module.js"></script>');
  await writeFile(resolve(staging, 'assets/module.js'), 'window.moduleLoaded = true;');
  await writeFile(resolve(staging, 'assets/photo.webp'), new Uint8Array([1, 2, 3]));
  const published = await publishModule({ artifactRoot: moduleRoot, staging, moduleId: 'capataz', version: '1.0.0' });
  await mkdir(shellRoot, { recursive: true });
  await writeFile(resolve(shellRoot, 'index.html'), 'shell entry');
  await writeFile(resolve(shellRoot, 'sw.js'), 'worker');
  const selector = await request('/modules/capataz/current/module.json');
  expect(selector.status).toBe(200);
  expect(selector.headers.get('Cache-Control')).toBe('no-store');
  const release = (await selector.json()).releaseUrl;
  const manifest = await request(release);
  expect(await manifest.text()).toBe(await readFile(resolve(published.release, 'module.json'), 'utf8'));
  expect(manifest.headers.get('Cache-Control')).toContain('immutable');
  const js = await request(release.replace('module.json', 'assets/module.js'));
  expect(js.status).toBe(200);
  expect(await js.text()).toBe('window.moduleLoaded = true;');
  expect(js.headers.get('Content-Type')).toBe('text/javascript; charset=utf-8');
  expect(js.headers.get('Access-Control-Allow-Origin')).toBe('*');
  const photo = await request(release.replace('module.json', 'assets/photo.webp'), 'HEAD');
  expect(photo.status).toBe(200);
  expect(photo.headers.get('Content-Type')).toBe('image/webp');
  expect(await photo.text()).toBe('');
  const missing = await request(release.replace('module.json', 'assets/missing.js'));
  expect(missing.status).toBe(404);
  expect(missing.headers.get('Cache-Control')).toBe('no-store');
  expect(await (await request('/api/v1/health')).json()).toHaveProperty('status');
  expect((await request('/sw.js')).headers.get('Service-Worker-Allowed')).toBe('/');
  expect(await (await request('/existing-shell-route')).text()).toBe('shell entry');
  expect((await request(release, 'POST')).status).toBe(405);
});

test('serves immutable shell snapshots and rejects malformed releases, traversal and junction escapes', async () => {
  const generation = 'a'.repeat(64);
  const release = `/shell-releases/${generation}/`;
  await mkdir(resolve(shellRoot, release.slice(1), 'assets'), { recursive: true });
  await writeFile(resolve(shellRoot, release.slice(1), 'shell-assets.json'), '{"assets":[]}');
  await writeFile(resolve(shellRoot, release.slice(1), 'assets/shell.js'), 'shell snapshot');
  const manifest = await request(release + 'shell-assets.json');
  expect(manifest.status).toBe(200);
  expect(manifest.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  expect(manifest.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  expect(await (await request(release + 'assets/shell.js')).text()).toBe('shell snapshot');
  for (const path of ['/shell-releases/latest/shell-assets.json', release + 'missing.js', '/modules/capataz/releases/latest/module.json', `/modules/unknown/releases/${generation}/index.html`, `/modules/capataz/.staging/a/index.html`]) {
    expect((await request(path)).status, path).toBe(404);
  }
  for (const path of ['../secret', '/secret', 'a/../secret', 'a\\secret', 'a/%2e%2e/secret', '%252e%252e/secret', 'a%00.js', 'C:secret', 'a//secret', 'a/%2fsecret']) expect(safeFile(shellRoot, path), path).toBeNull();
  const outside = resolve(root, 'outside');
  await mkdir(outside, { recursive: true });
  await writeFile(resolve(outside, 'secret.js'), 'secret');
  await symlink(outside, resolve(shellRoot, release.slice(1), 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  expect((await request(release + 'escape/secret.js')).status).toBe(400);
  expect((await request(release + 'assets/%2e%2e%2fsecret.js')).status).toBe(400);
});
