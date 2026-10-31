import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { decideDeployment } from '../deploy/release-gate.mjs';

function git(cwd, ...args) {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
const baseMarkers = ['consubov-app','consubov-site','relatto-app','relatto-site'];
function repoFixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'f23-release-'));
  const write = (p, content) => {
    fs.mkdirSync(path.dirname(path.join(cwd, p)), { recursive: true });
    fs.writeFileSync(path.join(cwd, p), content);
  };
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.name', 'F23 QA');
  git(cwd, 'config', 'user.email', 'qa@example.test');
  for (const target of baseMarkers) write('releases/' + target + '.json', JSON.stringify({
    target, revision: 0, ...(target === 'consubov-app' ? { appVersion: '2.0.0' } : {}),
  }));
  write('apps/web/src/lib/appVersion.ts', 'export const APP_VERSION = "2.0.0";\n');
  write('apps/web/src/pages/RelattoLandingPage.tsx','original\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'baseline');
  const first = git(cwd, 'rev-parse', 'HEAD');
  const commit = () => { git(cwd, 'add', '.'); git(cwd, 'commit', '-qm', 'update'); return git(cwd, 'rev-parse', 'HEAD'); };
  return { cwd, write, first, commit, cleanup: () => fs.rmSync(cwd, { recursive: true, force: true }) };
}
function env(overrides = {}) {
  return { VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'main', ...overrides };
}
function withFixture(fn) {
  const f = repoFixture();
  try { return fn(f); } finally { f.cleanup(); }
}
function updateMarker(f, target, revision, appVersion) {
  f.write('releases/' + target + '.json', JSON.stringify({target, revision, ...(appVersion ? {appVersion} : {})}));
}

test('Consubov-only source change never publishes Relatto without release intent', () => withFixture(f => {
  f.write('apps/web/src/hooks/useGerenteData.ts', 'const value = 1;\n'); f.commit();
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).build, false);
  assert.equal(decideDeployment('relatto-site', env(), f.cwd).build, false);
  assert.equal(decideDeployment('consubov-app', env(), f.cwd).build, false);
}));

test('Relatto App release does not publish Relatto Site or Consubov', () => withFixture(f => {
  updateMarker(f, 'relatto-app', 1); f.commit();
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).build, true);
  assert.equal(decideDeployment('relatto-site', env(), f.cwd).build, false);
  assert.equal(decideDeployment('consubov-app', env(), f.cwd).build, false);
  assert.equal(decideDeployment('consubov-site', env(), f.cwd).build, false);
}));

test('Consubov App version increase and marker must agree to release', () => withFixture(f => {
  updateMarker(f, 'consubov-app', 1, '2.0.1');
  f.write('apps/web/src/lib/appVersion.ts', 'export const APP_VERSION = "2.0.1";\n'); f.commit();
  assert.deepEqual(decideDeployment('consubov-app', env(), f.cwd), { build:true, reason:'explicit-product-release' });
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).build, false);
}));

test('Consubov App release with unchanged code version must skip', () => withFixture(f => {
  updateMarker(f, 'consubov-app', 1, '2.0.1'); f.commit();
  assert.equal(decideDeployment('consubov-app', env(), f.cwd).reason, 'app-version-mismatch');
}));

test('Consubov App downgrade is blocked', () => withFixture(f => {
  updateMarker(f, 'consubov-app', 1, '1.155.0');
  f.write('apps/web/src/lib/appVersion.ts', 'export const APP_VERSION = "1.155.0";\n'); f.commit();
  assert.equal(decideDeployment('consubov-app', env(), f.cwd).build, false);
}));

test('An unrelated change to a release marker does not count if revision unchanged', () => withFixture(f => {
  f.write('releases/relatto-site.json', JSON.stringify({target:'relatto-site',revision:0,description:'docs'})); f.commit();
  assert.equal(decideDeployment('relatto-site', env(), f.cwd).build, false);
}));

test('Invalid revision jump blocks all automatic releases', () => withFixture(f => {
  updateMarker(f, 'relatto-app', 3); f.commit();
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).reason,'release-revision-jump');
}));

test('Missing or corrupt manifest is fail-closed', () => withFixture(f => {
  f.write('releases/relatto-app.json','invalid'); f.commit();
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).build, false);
}));

test('No baseline marker causes no new production deployment', () => withFixture(f => {
  fs.rmSync(path.join(f.cwd,'releases/relatto-app.json'));
  git(f.cwd, 'add','-A'); git(f.cwd, 'commit','-qm','remove original');
  updateMarker(f, 'relatto-app', 1); f.commit();
  assert.equal(decideDeployment('relatto-app', env(), f.cwd).reason, 'no-trusted-release-baseline');
}));

test('Preview builds continue unchanged for recognized project', () => withFixture(f => {
  assert.equal(decideDeployment('relatto-app', env({VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feature'}), f.cwd).build, true);
}));

test('Unknown project and unexpected production branch never deploy', () => withFixture(f => {
  assert.equal(decideDeployment('unknown', env(), f.cwd).build, false);
  assert.equal(decideDeployment('relatto-app', env({VERCEL_GIT_COMMIT_REF:'other'}), f.cwd).build, false);
}));

test('Works inside apps/web cwd and compares against available previous deployment SHA', () => withFixture(f => {
  updateMarker(f, 'relatto-app', 1); f.commit();
  f.write('apps/web/src/pages/RelattoLandingPage.tsx','changed after release mark\n'); f.commit();
  assert.equal(decideDeployment('relatto-app', env({VERCEL_GIT_PREVIOUS_SHA:f.first}), path.join(f.cwd,'apps/web')).build, true);
}));

test('Previous successful SHA without release markers falls back to parent baseline', () => withFixture(f => {
  fs.rmSync(path.join(f.cwd, 'releases/relatto-app.json'));
  const oldProduction = f.commit();
  updateMarker(f, 'relatto-app', 0); f.commit();
  updateMarker(f, 'relatto-app', 1); f.commit();
  assert.equal(decideDeployment('relatto-app', env({VERCEL_GIT_PREVIOUS_SHA:oldProduction}), f.cwd).build, true);
}));
