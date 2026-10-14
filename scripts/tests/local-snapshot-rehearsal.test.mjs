import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, symlinkSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reconcileSnapshots, restoreFixture } from '../qa/local-snapshot-rehearsal.mjs';

const script = fileURLToPath(new URL('../qa/local-snapshot-rehearsal.mjs', import.meta.url));
const snapshot = () => ({ format: 'consubov-local-fixture-v1', fixture: true, tenantId: 'tenant-a', rows: [
  { tenantId: 'tenant-a', entity: 'sample', id: 'a', payload: { name: 'private-fixture-value', version: 1 } },
  { tenantId: 'tenant-a', entity: 'sample', id: 'b', payload: { bytes: 'AAEC/w==', pending: true } },
] });
const files = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'consubov-rehearsal-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { source: join(dir, 'source.json'), target: join(dir, 'target.json') };
};
const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', timeout: 10000 });

test('reconciliation compares scoped IDs and payloads independent of object/row order', () => {
  const source = snapshot(); const target = snapshot();
  target.rows.reverse(); target.rows[1].payload = { version: 1, name: 'private-fixture-value' };
  const report = reconcileSnapshots(source, target);
  assert.equal(report.status, 'PASS'); assert.equal(report.sourceDigest, report.targetDigest);
  assert.equal(report.productionReady, false); assert.equal(report.fixture, true);
  assert.equal(report.sourceCount, 2); assert.equal(report.changed, 0);
  assert.equal(JSON.stringify(report).includes('private-fixture-value'), false);
});

test('same count does not hide a replaced identity', () => {
  const target = snapshot(); target.rows[0].id = 'replacement';
  const report = reconcileSnapshots(snapshot(), target);
  assert.equal(report.status, 'FAIL'); assert.equal(report.missing, 1); assert.equal(report.unexpected, 1);
});

test('changed binary representation or operational payload fails reconciliation', () => {
  const target = snapshot(); target.rows[1].payload.bytes = 'AAEC';
  const report = reconcileSnapshots(snapshot(), target);
  assert.equal(report.status, 'FAIL'); assert.equal(report.changed, 1);
});

for (const [name, change] of [
  ['duplicate identity', x => x.rows.push(structuredClone(x.rows[0]))],
  ['foreign tenant row', x => { x.rows[0].tenantId = 'tenant-b'; }],
  ['missing tenant', x => { delete x.tenantId; }],
  ['untrimmed identity', x => { x.rows[0].id = ' a'; }],
  ['nonfixture data', x => { x.fixture = false; }],
  ['unknown format', x => { x.format = 'production'; }],
  ['empty evidence', x => { x.rows = []; }],
  ['missing payload', x => { delete x.rows[0].payload; }],
  ['nonfinite payload', x => { x.rows[0].payload = NaN; }],
  ['non-JSON object', x => { x.rows[0].payload = new Date(); }],
  ['circular payload', x => { x.rows[0].payload.self = x.rows[0].payload; }],
]) test('rejects ' + name, () => {
  const value = snapshot(); change(value);
  assert.throws(() => reconcileSnapshots(snapshot(), value));
});

test('different snapshot tenant is rejected, not silently remapped', () => {
  const target = snapshot(); target.tenantId = 'tenant-b'; target.rows.forEach(x => { x.tenantId = 'tenant-b'; });
  assert.throws(() => reconcileSnapshots(snapshot(), target), /tenant/);
});

test('different entity can use the same ID without collision', () => {
  const value = snapshot(); value.rows[1].id = 'a'; value.rows[1].entity = 'other';
  assert.equal(reconcileSnapshots(value, value).status, 'PASS');
});

test('restore writes and verifies actual bytes, without modifying source', t => {
  const { source, target } = files(t); const bytes = JSON.stringify(snapshot(), null, 2);
  writeFileSync(source, bytes); const report = restoreFixture(source, target);
  assert.equal(report.status, 'PASS'); assert.equal(report.sourceFileDigest, report.restoredFileDigest);
  assert.equal(readFileSync(source, 'utf8'), bytes); assert.equal(readFileSync(target, 'utf8'), bytes);
});

test('existing destination remains intact and source is preserved', t => {
  const { source, target } = files(t); const bytes = JSON.stringify(snapshot());
  writeFileSync(source, bytes); writeFileSync(target, 'keep-me');
  assert.throws(() => restoreFixture(source, target), /EEXIST/);
  assert.equal(readFileSync(target, 'utf8'), 'keep-me'); assert.equal(readFileSync(source, 'utf8'), bytes);
});

test('invalid source never creates a destination', t => {
  const { source, target } = files(t); writeFileSync(source, '{}');
  assert.throws(() => restoreFixture(source, target)); assert.equal(existsSync(target), false);
});

test('symbolic source is rejected and symbolic destination cannot overwrite source', t => {
  const { source, target } = files(t); const bytes = JSON.stringify(snapshot()); writeFileSync(source, bytes);
  // Junctions exercise a real Windows symbolic endpoint without changing OS privileges.
  // POSIX retains its file symlink case; both must reject before copying and preserve source bytes.
  symlinkSync(process.platform === 'win32' ? dirname(source) : source, target,
    process.platform === 'win32' ? 'junction' : 'file');
  assert.equal(lstatSync(target).isSymbolicLink(), true);
  assert.throws(() => restoreFixture(target, target + '.new'));
  assert.equal(existsSync(target + '.new'), false);
  assert.throws(() => restoreFixture(source, target), /EEXIST/);
  assert.equal(readFileSync(source, 'utf8'), bytes);
});

test('CLI returns nonzero for divergence and emits no payload or identity', t => {
  const { source, target } = files(t); writeFileSync(source, JSON.stringify(snapshot()));
  const changed = snapshot(); changed.rows.pop(); writeFileSync(target, JSON.stringify(changed));
  const result = cli('reconcile', source, target); assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).missing, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /private-fixture-value|tenant-a/);
});

test('CLI returns input error for URL and malformed JSON without copying', t => {
  const { source, target } = files(t); writeFileSync(source, '{');
  assert.equal(cli('restore', source, target).status, 2); assert.equal(existsSync(target), false);
  assert.equal(cli('restore', 'https://example.invalid/data', target).status, 2);
  assert.equal(existsSync(target), false);
});

test('CLI restore succeeds only after verified local copy', t => {
  const { source, target } = files(t); writeFileSync(source, JSON.stringify(snapshot()));
  const result = cli('restore', source, target); assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).productionReady, false);
  assert.deepEqual(readFileSync(source), readFileSync(target));
});

for (const level of ['snapshot', 'row']) test('unmodeled ' + level + ' fields cannot disappear from comparison', () => {
  const target = snapshot();
  if (level === 'row') target.rows[0].userId = 'unmodeled-owner'; else target.deleted = true;
  assert.throws(() => reconcileSnapshots(snapshot(), target), /field/);
});

test('invalid UTF-8 is rejected rather than silently normalized before restore', t => {
  const { source, target } = files(t);
  const value = JSON.stringify(snapshot()).replace('private-fixture-value', 'PLACEHOLDER');
  writeFileSync(source, Buffer.concat(value.split('PLACEHOLDER').flatMap((part, index) =>
    index === 0 ? [Buffer.from(part), Buffer.from([0xff])] : [Buffer.from(part)])));
  assert.throws(() => restoreFixture(source, target)); assert.equal(existsSync(target), false);
});
