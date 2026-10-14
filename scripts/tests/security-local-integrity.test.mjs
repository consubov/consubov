import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const project = path.resolve(import.meta.dirname, '../..');
const toolName = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
const realScanner = path.join(project, '.qa/tools/gitleaks-8.30.1', toolName);
const timeout = 45_000;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'security fixture espaço-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts/qa'), { recursive: true });
  for (const file of ['run-security-local.mjs', 'source-state.mjs', 'classify-security-signals.mjs', 'gitleaks-local.toml', 'gitleaks-metadata.tmpl']) {
    const from = path.join(project, 'scripts/qa', file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(root, 'scripts/qa', file));
  }
  for (const app of ['api', 'web']) {
    fs.mkdirSync(path.join(root, 'apps', app, 'src'), { recursive: true });
    fs.symlinkSync(path.join(project, 'apps', app, 'node_modules'), path.join(root, 'apps', app, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.writeFileSync(path.join(root, 'apps', app, 'package.json'), '{"type":"module"}\n');
    fs.writeFileSync(path.join(root, 'apps', app, 'src/clean.ts'), 'export function safe(value: string) { return value.length; }\n');
  }
  fs.copyFileSync(path.join(project, 'apps/api/eslint.config.js'), path.join(root, 'apps/api/eslint.config.js'));
  fs.symlinkSync(path.join(project, 'node_modules'), path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  fs.writeFileSync(path.join(root, '.gitignore'), '.qa/\nnode_modules/\n.env*\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}\n');
  const scanner = path.join(root, '.qa/tools/gitleaks-8.30.1', toolName);
  fs.mkdirSync(path.dirname(scanner), { recursive: true });
  fs.copyFileSync(realScanner, scanner);
  if (process.platform !== 'win32') fs.chmodSync(scanner, 0o755);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] });
  git('init', '-q'); git('config', 'core.autocrlf', 'false'); git('config', 'user.name', 'Security Fixture'); git('config', 'user.email', 'qa@example.invalid');
  git('add', '.'); git('commit', '-qm', 'Baseline');
  function run() {
    const result = spawnSync(process.execPath, ['scripts/qa/run-security-local.mjs'], { cwd: root, encoding: 'utf8', timeout, env: process.env });
    const filename = result.stdout?.match(/SECURITY_REPORT=(.+)/)?.[1]?.trim();
    const report = filename && fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : null;
    return { result, report, output: (result.stdout || '') + (result.stderr || '') };
  }
  return { root, git, scanner, run };
}
function inertToken() {
  return ['gh', 'p_'].join('') + createHash('sha256').update('deterministic inert fixture with no provider account').digest('hex').slice(0, 36);
}

test('real locked tools approve a clean disposable API Web current source and history', t => {
  const { result, report } = fixture(t).run();
  assert.equal(result.status, 0, 'Clean fixture gate must pass: ' + JSON.stringify(report));
  assert.equal(report.status, 'PASS');
  assert.equal(report.selectedSourceUnchanged, true);
  assert.deepEqual(Object.values(report.stages).map(stage => stage.status), ['PASS', 'PASS', 'PASS', 'PASS']);
});
test('nonignored untracked Web code is actually scanned by approved SAST rules', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, 'apps/web/src/new.ts'), 'export function unsafe(value: string) { return eval(value); }\n');
  const { result, report } = f.run();
  assert.notEqual(result.status, 0);
  assert.ok(report?.stages.web.findings.some(finding => finding.category === 'security/detect-eval-with-expression' && finding.path === 'apps/web/src/new.ts'));
});

function assertPrivateOutput(run, token = '') {
  const serialized = JSON.stringify(run.report);
  if (token) { assert.equal(run.output.includes(token), false, 'Raw canary escaped scanner boundary'); assert.equal(serialized.includes(token), false, 'Raw canary escaped report boundary'); }
  for (const key of ['Match', 'Secret', 'Line', 'Author', 'Email', 'Message']) assert.equal(serialized.includes('"' + key + '"'), false, 'Forbidden report field');
}
test('untracked inert token fails current-source scan without exposing raw finding data', t => {
  const f = fixture(t), token = inertToken();
  fs.writeFileSync(path.join(f.root, 'scripts/new-code.mjs'), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.source.status, 'FAIL');
  assert.ok(run.report.stages.source.findings.some(item => item.path === 'scripts/new-code.mjs'));
  assert.equal(run.report.source.untrackedCount, 1);
  assertPrivateOutput(run, token);
});
test('removed committed token is detected across available history while current files are clean', t => {
  const f = fixture(t), token = inertToken();
  fs.writeFileSync(path.join(f.root, 'apps/web/src/removed.ts'), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('add', '.'); f.git('commit', '-qm', 'Fixture token');
  fs.unlinkSync(path.join(f.root, 'apps/web/src/removed.ts'));
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'PASS');
  assert.equal(run.report.stages.history.status, 'FAIL');
  assert.ok(run.report.stages.history.findings.some(item => item.path === 'apps/web/src/removed.ts'));
  assertPrivateOutput(run, token);
});
test('feature-ref-only history is scanned even when current HEAD is clean', t => {
  const f = fixture(t), token = inertToken(), branch = f.git('branch', '--show-current').trim();
  f.git('checkout', '-qb', 'fixture-feature');
  fs.writeFileSync(path.join(f.root, 'scripts/feature.mjs'), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('add', '.'); f.git('commit', '-qm', 'Feature fixture'); f.git('checkout', '-q', branch);
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'PASS');
  assert.equal(run.report.stages.history.status, 'FAIL');
  assertPrivateOutput(run, token);
});
test('stash-only historical content is scanned without dropping or reapplying stash', t => {
  const f = fixture(t), token = inertToken();
  fs.appendFileSync(path.join(f.root, 'apps/web/src/clean.ts'), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('stash', 'push', '-qm', 'Inert fixture stash');
  const before = f.git('rev-parse', 'refs/stash').trim();
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'PASS');
  assert.equal(run.report.stages.history.status, 'FAIL');
  assert.equal(f.git('rev-parse', 'refs/stash').trim(), before);
  assertPrivateOutput(run, token);
});
for (const [name, code, category] of [
  ['filesystem', 'import fs from "node:fs"; export function unsafe(file: string) { return fs.readFileSync(file); }', 'security/detect-non-literal-fs-filename'],
  ['timing', 'export function unsafe(password: string, candidate: string) { if (password === candidate) return true; return false; }', 'security/detect-possible-timing-attacks'],
  ['inline-disable', '/* eslint-disable security/detect-eval-with-expression */ export function unsafe(value: string) { return eval(value); }', 'security/detect-eval-with-expression'],
]) test('real approved Web rule blocks ' + name, t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, 'apps/web/src/new.ts'), code);
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.ok(run.report.stages.web.findings.some(item => item.category === category));
  assertPrivateOutput(run);
});
test('existing API security warnings fail as max-warnings=0 while Web test exclusions remain', t => {
  const f = fixture(t);
  const code = 'export function unsafe(value: string) { return eval(value); }\n';
  fs.writeFileSync(path.join(f.root, 'apps/api/src/unsafe.test.ts'), code);
  fs.writeFileSync(path.join(f.root, 'apps/web/src/unsafe.test.ts'), code);
  const run = f.run();
  assert.equal(run.report.stages.api.status, 'FAIL');
  assert.equal(run.report.stages.web.status, 'PASS');
  assert.ok(run.report.stages.api.findings.some(item => item.category === 'security/detect-eval-with-expression'));
});
test('missing scanner fails closed after real SAST and never fabricates secret scan PASS', t => {
  const f = fixture(t); fs.unlinkSync(f.scanner);
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.api.status, 'PASS');
  assert.equal(run.report.stages.source.reason, 'scanner-missing');
  assert.equal(run.report.stages.history.status, 'ERROR');
});
test('tampered scanner provenance fails closed before executable is invoked', t => {
  const f = fixture(t); fs.writeFileSync(f.scanner, 'not an executable or approved binary');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.source.reason, 'scanner-digest-mismatch');
});
test('missing installed workspace tool fails without package downloads or version fallback', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.root, 'apps/web/node_modules'));
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.web.status, 'ERROR');
  assert.equal(run.report.stages.source.status, 'PASS');
});
test('symlink or junction source cannot follow private target data', t => {
  const f = fixture(t), target = path.join(f.root, '.qa/private-target');
  fs.mkdirSync(target, { recursive: true }); fs.writeFileSync(path.join(target, 'data.ts'), 'inert private target\n');
  fs.symlinkSync(target, path.join(f.root, 'apps/web/src/alias'), process.platform === 'win32' ? 'junction' : 'dir');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.selectedSourceUnchanged, false);
  assert.equal(run.report.stages.source.status, 'ERROR');
});
test('shallow available history is rejected rather than accepted as complete', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root, '.git/shallow'), f.git('rev-parse', 'HEAD').trim() + '\n');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.history.reason, 'shallow-history');
});
test('missing available Git object cannot approve incomplete history', t => {
  const f = fixture(t), object = f.git('rev-parse', 'HEAD:apps/api/src/clean.ts').trim();
  fs.unlinkSync(path.join(f.root, '.git/objects', object.slice(0, 2), object.slice(2)));
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.history.status, 'ERROR');
});
test('unknown domain/data classification fails before source scanner access', t => {
  const f = fixture(t); fs.mkdirSync(path.join(f.root, 'unknown-domain')); fs.writeFileSync(path.join(f.root, 'unknown-domain/customer.json'), '{}');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.source.reason, 'unknown-source-classification');
});
test('private unignored env bytes are never read by selected-source fingerprint or projection policy', async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, '.gitignore'), '.qa/\nnode_modules/\n');
  const denied = path.join(f.root, 'apps/web/src/.env.private'); fs.writeFileSync(denied, 'inert private byte sentinel');
  const { selectedSource } = await import('../qa/run-security-local.mjs');
  const original = fs.readFileSync; let reads = 0;
  fs.readFileSync = (filename, ...args) => { if (path.resolve(String(filename)) === denied) { reads++; throw new Error('Forbidden private read'); } return original(filename, ...args); };
  try { const state = selectedSource(f.root); assert.ok(state.exclusions.paths.includes('apps/web/src/.env.private')); assert.equal(reads, 0); }
  finally { fs.readFileSync = original; }
});
test('raw scanner stdout and stderr are discarded at the actual subprocess boundary', async t => {
  const f = fixture(t), token = inertToken();
  const { invokeScanner } = await import('../qa/run-security-local.mjs');
  const exit = invokeScanner(process.execPath, ['-e', `console.log(${JSON.stringify(token)});console.error('Author and Email must not escape');process.exit(29);`], f.root);
  assert.equal(exit, 29);
});
test('metadata parser rejects extra fields and contradictory successful findings without exposing raw values', async t => {
  const f = fixture(t), filename = path.join(f.root, '.qa/report.json'), token = inertToken();
  const { scannerMetadata } = await import('../qa/run-security-local.mjs');
  const allowed = new Set(['scripts/example.mjs', 'scripts/quote"日本.mjs']);
  fs.writeFileSync(filename, JSON.stringify([{ category: 'fixture', path: 'scripts/example.mjs', Secret: token, Match: 'source text', Author: 'inert', Email: 'inert' }]));
  assert.throws(() => scannerMetadata(filename, 0), error => error.reason === 'invalid-metadata-report');
  fs.writeFileSync(filename, JSON.stringify([{ category: 'fixture', path: 'scripts/example.mjs' }]));
  assert.equal(scannerMetadata(filename, 0, '', allowed).status, 'FAIL');
  fs.writeFileSync(filename, JSON.stringify([{ category: 'fixture', path: 'scripts/quote"日本.mjs' }]));
  assert.equal(scannerMetadata(filename, 1, '', allowed).findings[0].path, 'scripts/quote"日本.mjs');
  fs.writeFileSync(filename, '[]'); assert.throws(() => scannerMetadata(filename, 29), error => error.reason === 'scanner-execution-failed');
  fs.writeFileSync(filename, 'null'); assert.throws(() => scannerMetadata(filename, 0), error => error.reason === 'invalid-metadata-report');
  fs.unlinkSync(filename); assert.throws(() => scannerMetadata(filename, 0));
});

async function duringProjection(f, mutate) {
  const child = spawn(process.execPath, ['scripts/qa/run-security-local.mjs'], { cwd: f.root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
  const finished = new Promise((resolve, reject) => { child.on('close', status => resolve(status)); child.on('error', reject); });
  const timer = setTimeout(() => child.kill(), timeout);
  try {
    const started = Date.now(); let ready = false;
    while (Date.now() - started < 10_000) {
      const directory = path.join(f.root, '.qa/security');
      const runs = fs.existsSync(directory) ? fs.readdirSync(directory) : [];
      if (runs.some(run => fs.existsSync(path.join(directory, run, 'source/apps/web/src/clean.ts')))) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(ready, true, 'Immutable projection was not reached within fixture timeout');
    mutate(); const status = await finished;
    const filename = output.match(/SECURITY_REPORT=(.+)/)?.[1]?.trim();
    return { result: { status }, output, report: filename ? JSON.parse(fs.readFileSync(filename, 'utf8')) : null };
  } finally { clearTimeout(timer); if (child.exitCode === null) child.kill(); }
}
test('real security run rejects source drift after immutable projection without silently rescanning changed bytes', async t => {
  const f = fixture(t);
  const run = await duringProjection(f, () => fs.writeFileSync(path.join(f.root, 'apps/web/src/clean.ts'), 'export function safe(value: string) { return value.length + 1; }\n'));
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.selectedSourceUnchanged, false);
  assert.notEqual(run.report.selectedSourceFingerprint, run.report.finalSelectedSourceFingerprint);
});
test('HEAD and available-history drift invalidate an otherwise clean scanner result', async t => {
  const f = fixture(t);
  const run = await duringProjection(f, () => f.git('commit', '--allow-empty', '-qm', 'Fixture head move'));
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.historyUnchanged, false);
  assert.notEqual(run.report.commit, run.report.finalCommit);
});
test('Unicode and space source path produces properly escaped metadata and no token contents', t => {
  const f = fixture(t), token = inertToken(), name = 'scripts/espaço 日本.mjs';
  fs.writeFileSync(path.join(f.root, name), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'FAIL');
  assert.ok(run.report.stages.source.findings.some(item => item.path === name));
  assertPrivateOutput(run, token);
});
test('uppercase private key extension is excluded from current bytes and selected history content', t => {
  const f = fixture(t), name = 'scripts/inert.PEM', token = inertToken();
  fs.writeFileSync(path.join(f.root, name), token); f.git('add', '.'); f.git('commit', '-qm', 'Excluded inert private fixture');
  const run = f.run();
  assert.equal(run.result.status, 0, 'Private content policy must be applied consistently');
  assert.ok(run.report.source.exclusions.paths.includes(name));
  assert.ok(run.report.history.exclusions.paths.includes(name));
  assertPrivateOutput(run, token);
});
test('empty expected Web SAST coverage fails rather than passing a zero-file analysis', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.root, 'apps/web/src/clean.ts'));
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.web.reason, 'sast-empty-source');
});
test('unknown root data and case variant env/dependency paths are denied before reads', async () => {
  const { classifySource } = await import('../qa/run-security-local.mjs');
  assert.equal(classifySource('customer.json'), 'unknown');
  assert.equal(classifySource('apps/web/src/.ENV.private'), 'excluded');
  assert.equal(classifySource('apps/web/Node_Modules/module.js'), 'excluded');
});
test('evidence directory link cannot redirect writes outside the owned security run', t => {
  const f = fixture(t), target = path.join(f.root, '.qa/private-output-target');
  fs.mkdirSync(target); fs.symlinkSync(target, path.join(f.root, '.qa/security'), process.platform === 'win32' ? 'junction' : 'dir');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.deepEqual(fs.readdirSync(target), [], 'Evidence was written through a directory link');
});
test('bounded scanner timeout and unavailable executable fail at the real subprocess boundary', async t => {
  const f = fixture(t), { invokeScanner } = await import('../qa/run-security-local.mjs');
  assert.throws(() => invokeScanner(path.join(f.root, '.qa/no-scanner'), [], f.root, 100), error => error.reason === 'scanner-execution-failed');
  assert.throws(() => invokeScanner(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], f.root, 100), error => error.reason === 'scanner-execution-failed');
});

test('untrusted SAST config exception fields cannot smuggle canary contents into metadata', t => {
  const f = fixture(t), token = inertToken();
  fs.writeFileSync(path.join(f.root, 'apps/api/eslint.config.js'), `throw Object.assign(new Error('untrusted config'), { reason: ${JSON.stringify(token)}, code: ${JSON.stringify(token)} });\n`);
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.api.status, 'ERROR');
  assertPrivateOutput(run, token);
});
test('actual phase5 shell propagates security gate failure before audit or build', t => {
  const f = fixture(t), bin = path.join(f.root, '.qa/bin'), marker = path.join(f.root, '.qa/bun-calls');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'bun'), '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$QA_SECURITY_FIXTURE_MARKER"\nif [[ "$1" == "install" ]]; then exit 0; fi\nexit 95\n', { mode: 0o755 });
  fs.copyFileSync(path.join(project, 'scripts/run-phase5-local.sh'), path.join(f.root, 'scripts/run-phase5-local.sh'));
  fs.copyFileSync(path.join(project, 'scripts/qa/run-lighthouse-local.mjs'), path.join(f.root, 'scripts/qa/run-lighthouse-local.mjs'));
  fs.writeFileSync(path.join(f.root, 'scripts/qa/run-security-local.mjs'), 'process.exit(29);\n');
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const prefix = process.platform === 'win32' ? 'PATH="$(cygpath -u "$QA_SECURITY_FIXTURE_BIN"):$PATH"; export PATH; exec bash scripts/run-phase5-local.sh' : 'PATH="$QA_SECURITY_FIXTURE_BIN:$PATH"; export PATH; exec bash scripts/run-phase5-local.sh';
  const result = spawnSync(bash, ['-c', prefix], { cwd: f.root, encoding: 'utf8', timeout, env: { ...process.env, QA_SECURITY_FIXTURE_BIN: bin, QA_SECURITY_FIXTURE_MARKER: marker, VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'inert-fixture' } });
  assert.equal(result.status, 29);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'install --frozen-lockfile\n');
});

for (const name of ['scripts/private-signing-key-helper.ts', 'scripts/session-signing-material-helper.ts']) test('removed privacy-pattern helper is either detected or explicitly excluded: ' + name, t => {
  const f = fixture(t), token = inertToken();
  fs.writeFileSync(path.join(f.root, name), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('add', '.'); f.git('commit', '-qm', 'Inert policy parity fixture'); fs.unlinkSync(path.join(f.root, name));
  const run = f.run();
  const explicitDenial = run.report.source.exclusions.paths.includes(name) && run.report.history.exclusions.paths.includes(name) && !run.report.history.selectedPaths.includes(name);
  const detected = run.report.stages.history.status === 'FAIL' && run.report.stages.history.findings.some(item => item.path === name);
  assert.equal(explicitDenial || detected, true, 'Selected historical content was silently excluded from scanning');
  assertPrivateOutput(run, token);
});
for (const suffix of ['test', 'spec']) test('API production coverage cannot be satisfied by only .' + suffix + ' source', t => {
  const f = fixture(t); fs.unlinkSync(path.join(f.root, 'apps/api/src/clean.ts'));
  fs.writeFileSync(path.join(f.root, 'apps/api/src/only.' + suffix + '.ts'), 'export function testFixture(value: string) { return value.length; }\n');
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.api.reason, 'sast-empty-source');
});
test('dangling tracked source link is denied before genuine-deletion classification', t => {
  const f = fixture(t), target = path.join(f.root, '.qa/dangling-target'), alias = path.join(f.root, 'scripts/dangling.mjs');
  let tracked;
  if (process.platform === 'win32') {
    fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'entry.mjs'), 'export const marker = 1;\n');
    fs.symlinkSync(target, alias, 'junction'); tracked = 'scripts/dangling.mjs/entry.mjs';
    f.git('add', '-f', tracked); f.git('commit', '-qm', 'Tracked junction descendant fixture'); fs.rmSync(target, { recursive: true });
  } else {
    fs.writeFileSync(target, 'export const marker = 1;\n'); fs.symlinkSync(target, alias, 'file'); tracked = 'scripts/dangling.mjs';
    f.git('add', tracked); f.git('commit', '-qm', 'Tracked file link fixture'); fs.unlinkSync(target);
  }
  assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
  assert.equal(fs.existsSync(alias), false);
  assert.ok(f.git('ls-files', '-z').split('\0').includes(tracked));
  const run = f.run();
  assert.notEqual(run.result.status, 0);
  assert.equal(run.report.stages.source.reason, 'source-link-denied');
});

test('private env directory descendants are never presented to history detector', t => {
  const f = fixture(t), name = 'scripts/.env-fixture-dir/nested.ts', token = inertToken();
  fs.mkdirSync(path.dirname(path.join(f.root, name)), { recursive: true });
  fs.writeFileSync(path.join(f.root, name), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('add', '-f', name); f.git('commit', '-qm', 'Inert env directory privacy fixture');
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'PASS');
  assert.ok(run.report.source.exclusions.paths.includes(name));
  assert.ok(run.report.history.exclusions.paths.includes(name));
  assert.equal(run.report.stages.history.status, 'PASS', 'Excluded env directory child reached the history detector');
  assertPrivateOutput(run, token);
});
test('extension-named directory does not silently remove selected historical source coverage', t => {
  const f = fixture(t), name = 'scripts/tooling.pem/nested.ts', token = inertToken();
  fs.mkdirSync(path.dirname(path.join(f.root, name)), { recursive: true });
  fs.writeFileSync(path.join(f.root, name), `export const fixtureToken = ${JSON.stringify(token)};\n`);
  f.git('add', name); f.git('commit', '-qm', 'Inert extension directory fixture'); fs.unlinkSync(path.join(f.root, name));
  const run = f.run();
  const explicitDenial = run.report.source.exclusions.paths.includes(name) && run.report.history.exclusions.paths.includes(name);
  const detected = run.report.stages.history.status === 'FAIL' && run.report.stages.history.findings.some(item => item.path === name);
  assert.equal(explicitDenial || detected, true, 'Extension pathspec silently removed selected history');
  assertPrivateOutput(run, token);
});

test('bounded legacy metadata policy keeps exact source roots and private exclusions distinct', async () => {
  const { classifySource } = await import('../qa/run-security-local.mjs');
  const selected = ['src/legacy.ts', 'public/sw.js', 'packages/contracts/package.json', 'qa/doctor.sh', 'qa/setup-and-test.bat', 'apps/web/src/test/pages/PastoDetailPage.test.tsx`', 'index.html', 'package-lock.json', 'playwright.config.ts', 'tailwind.config.ts', 'tsconfig.app.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'components.json', 'eslint.config.js', 'playwright-fixture.ts', 'postcss.config.js', 'tsconfig.node.json', 'scripts/quality-final.txt'];
  const excluded = ['.dsh/skills/example.md', '.lovable/memory/features/example', '.work-go-task/kit/script.sh', 'apps/web/test-results/artifact.webm', '.npmrc', 'scripts/.root.env.test', 'bun.lockb', 'quality-final.txt', 'quality-final.txt/nested.ts', 'quality-fase.txt', 'quality-output.txt', 'superpowers', 'superpowers/nested.ts'];
  assert.equal(selected.every(name => classifySource(name) === 'selected'), true, 'Exact approved legacy source metadata not selected');
  assert.equal(excluded.every(name => classifySource(name) === 'excluded'), true, 'Exact approved private metadata not excluded');
  assert.equal(classifySource('customer.json'), 'unknown');
  assert.equal(classifySource('qa/unknown.bat'), 'unknown');
  assert.equal(classifySource('apps/web/src/test/pages/Other.test.tsx`'), 'unknown');
});

test('removed legacy code and nonroot log-shaped source remain detected in real history', t => {
  const f = fixture(t), token = inertToken();
  const names = ['src/legacy.ts', 'public/sw.js', 'packages/contracts/legacy.ts', 'qa/legacy.sh', 'qa/setup-and-test.bat', 'apps/web/src/test/pages/PastoDetailPage.test.tsx`', 'scripts/quality-final.txt'];
  for (const name of names) {
    fs.mkdirSync(path.dirname(path.join(f.root, name)), { recursive: true });
    fs.writeFileSync(path.join(f.root, name), `fixtureToken = ${JSON.stringify(token)}\n`);
  }
  f.git('add', ...names); f.git('commit', '-qm', 'Inert selected legacy source fixture');
  for (const name of names) fs.unlinkSync(path.join(f.root, name));
  const run = f.run();
  assert.equal(run.report.stages.source.status, 'PASS');
  assert.equal(run.report.stages.history.status, 'FAIL');
  assert.equal(names.every(name => run.report.stages.history.findings.some(item => item.path === name)), true, 'A selected legacy or nonroot log-shaped source was omitted');
  assertPrivateOutput(run, token);
});

test('explicit private history leaf and directory paths stay outside the real detector', t => {
  const f = fixture(t), token = inertToken();
  const names = ['.dsh', '.lovable/nested.ts', '.work-go-task/kit/nested.ts', 'apps/web/test-results/nested.ts', '.npmrc', 'scripts/.root.env.test/nested.ts', 'bun.lockb', 'quality-final.txt', 'coverage-output.txt/nested.ts', 'superpowers/nested.ts', 'quality-fase.txt', 'quality-output.txt'];
  for (const name of names) {
    fs.mkdirSync(path.dirname(path.join(f.root, name)), { recursive: true });
    fs.writeFileSync(path.join(f.root, name), `fixtureToken = ${JSON.stringify(token)}\n`);
  }
  f.git('add', '-f', ...names); f.git('commit', '-qm', 'Inert denied history metadata fixture');
  const run = f.run();
  assert.equal(run.report.status, 'PASS', 'Denied private leaf or directory reached the detector: ' + JSON.stringify(Object.fromEntries(Object.entries(run.report.stages).map(([name,stage]) => [name,{status:stage.status,reason:stage.reason,count:stage.count}]))));
  assert.equal(names.every(name => run.report.source.exclusions.paths.includes(name) && run.report.history.exclusions.paths.includes(name)), true);
  assert.deepEqual(run.report.stages.history.findings, []);
  assertPrivateOutput(run, token);
});
