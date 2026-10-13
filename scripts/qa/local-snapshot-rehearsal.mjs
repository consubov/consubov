#!/usr/bin/env node
// Local JSON fixtures only. This is not a database adapter or production migration.
import { createHash } from 'node:crypto';
import { constants, openSync, closeSync, lstatSync, fstatSync, readFileSync, writeFileSync, fsyncSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORMAT = 'consubov-local-fixture-v1';
const MAX_BYTES = 8 * 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 256 &&
  value === value.trim() && !/[\u0000-\u001f\u007f]/u.test(value);

function canonical(value, seen = new Set(), depth = 0) {
  if (depth > 64) throw new Error('fixture payload is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object' || seen.has(value)) throw new Error('fixture payload must be acyclic JSON');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error('non-JSON object');
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(d => d.get || d.set)) throw new Error('fixture accessors are forbidden');
  let result;
  if (Array.isArray(value)) {
    const parts = [];
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) throw new Error('sparse fixture array');
      parts.push(canonical(value[i], seen, depth + 1));
    }
    result = '[' + parts.join(',') + ']';
  } else {
    result = '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonical(value[key], seen, depth + 1)).join(',') + '}';
  }
  seen.delete(value);
  return result;
}

function fields(value, allowed) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('unmodeled fixture field');
}

function inspect(snapshot) {
  if (!snapshot || snapshot.format !== FORMAT || snapshot.fixture !== true || !identity(snapshot.tenantId) ||
      !Array.isArray(snapshot.rows) || snapshot.rows.length === 0 || snapshot.rows.length > 100000) {
    throw new Error('nonempty, explicitly scoped local fixture required');
  }
  fields(snapshot, ['format', 'fixture', 'tenantId', 'rows']);
  const rows = new Map();
  for (const row of snapshot.rows) {
    if (!row || row.tenantId !== snapshot.tenantId || !identity(row.entity) || !identity(row.id) ||
        !Object.hasOwn(row, 'payload')) throw new Error('invalid fixture row or tenant');
    fields(row, ['tenantId', 'entity', 'id', 'payload']);
    const key = JSON.stringify([row.tenantId, row.entity, row.id]);
    if (rows.has(key)) throw new Error('duplicate scoped fixture identity');
    rows.set(key, hash(canonical(row.payload)));
  }
  const ordered = [...rows].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return { rows, digest: hash(JSON.stringify(ordered)) };
}

export function reconcileSnapshots(source, target) {
  const a = inspect(source); const b = inspect(target);
  if (source.tenantId !== target.tenantId) throw new Error('snapshot tenant mismatch');
  let missing = 0; let unexpected = 0; let changed = 0;
  for (const [key, digest] of a.rows) {
    if (!b.rows.has(key)) missing++;
    else if (b.rows.get(key) !== digest) changed++;
  }
  for (const key of b.rows.keys()) if (!a.rows.has(key)) unexpected++;
  // Reports contain counts and hashes, never payloads, record IDs or tenant IDs.
  return { kind: 'local-fixture-reconciliation', fixture: true, productionReady: false,
    status: missing + unexpected + changed === 0 ? 'PASS' : 'FAIL',
    sourceCount: a.rows.size, targetCount: b.rows.size, missing, unexpected, changed,
    sourceDigest: a.digest, targetDigest: b.digest };
}

function localPath(path) {
  if (typeof path !== 'string' || !path || /^[\\/]{2}/.test(path) ||
      (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path))) {
    throw new Error('local file path required; URLs and network shares are forbidden');
  }
  return resolve(path);
}

function readFixture(path) {
  const file = localPath(path); const before = lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('regular fixture file required');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size > MAX_BYTES) {
      throw new Error('fixture file changed or exceeds size limit');
    }
    const bytes = readFileSync(fd);
    if (bytes.length > MAX_BYTES) throw new Error('fixture exceeds size limit');
    const snapshot = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    inspect(snapshot);
    return { bytes, snapshot };
  } finally { closeSync(fd); }
}

export function restoreFixture(sourcePath, destinationPath) {
  const source = readFixture(sourcePath);
  const destination = localPath(destinationPath);
  // Exclusive creation prevents overwriting an existing file or symlink.
  const fd = openSync(destination, 'wx', 0o600);
  try { writeFileSync(fd, source.bytes); fsyncSync(fd); }
  finally { closeSync(fd); }
  // Failed copies remain for inspection; never erase or repair source data.
  const restored = readFixture(destination);
  const report = reconcileSnapshots(source.snapshot, restored.snapshot);
  const sourceFileDigest = hash(source.bytes); const restoredFileDigest = hash(restored.bytes);
  return { ...report, kind: 'local-fixture-restore', sourceFileDigest, restoredFileDigest,
    status: report.status === 'PASS' && sourceFileDigest === restoredFileDigest ? 'PASS' : 'FAIL' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [operation, source, target, ...extra] = process.argv.slice(2);
    if (!source || !target || extra.length || !['reconcile', 'restore'].includes(operation)) {
      throw new Error('usage');
    }
    const report = operation === 'restore' ? restoreFixture(source, target) :
      reconcileSnapshots(readFixture(source).snapshot, readFixture(target).snapshot);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'PASS' ? 0 : 1;
  } catch {
    console.error('[local-rehearsal] invalid input or local I/O failure; no release approval');
    process.exitCode = 2;
  }
}
