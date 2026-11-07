import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

// Runs without third-party deps: node --test apps/web/scripts/qa/check-sw-vite-hashed-assets.mjs
const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const definition = source.match(/^const HASHED_ASSET_PATTERN = (\/.+\/i);$/m);
assert.ok(definition, 'The service worker must declare a hashed asset matcher');
const pattern = runInNewContext(definition[1]);

for (const path of [
  '/assets/index-CWof2W_g.js',
  '/assets/index-DD9CTm96.js',
  '/assets/CapatazDashboard-B6pJUEo8.js',
  '/assets/app-Dei23V_f.css',
  '/assets/index.es-Dk3p2DFS.js',
  '/assets/chunks/bundle.12345678.js',
  '/assets/labels-aB12_CdE.woff2',
]) {
  test('cached Vite asset must match: ' + path, () => {
    assert.equal(pattern.test(path), true);
  });
}

for (const path of [
  '/assets/index.js',
  '/assets/logo.svg',
  '/rest/v1/auth.js',
  '/auth/user',
  'https://external.example/rest/v1/data',
]) {
  test('non-hashed resource must not match: ' + path, () => {
    assert.equal(pattern.test(path), false);
  });
}

test('hashed resources use cache first, with a cross-generation fallback', () => {
  assert.match(source, /url\.origin === self\.location\.origin && isHashedAsset\(url\)/);
  assert.match(source, /event\.respondWith\(cacheFirst\(request\)\)/);
  assert.match(source, /const cached = await cache\.match\(request\) \|\| await safeCacheMatch\(request\)/);
});

test('worker must not force skipWaiting on install', () => {
  const install = source.match(/self\.addEventListener\('install', \(event\) => \{([\s\S]*?)\n\}\);/);
  assert.ok(install);
  assert.doesNotMatch(install[1], /self\.skipWaiting\s*\(/);
});
