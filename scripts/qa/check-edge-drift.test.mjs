import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareEdgeSource, checkEdgeDrift } from './check-edge-drift.mjs';

const cli = fileURLToPath(new URL('./check-edge-drift.mjs', import.meta.url));

test('identical sources have identical fingerprints', () => {
  const r = compareEdgeSource('Deno.serve(() => new Response("ok"));', 'Deno.serve(() => new Response("ok"));');
  assert.equal(r.identical, true);
  assert.match(r.candidateSha256, /^[0-9a-f]{64}$/);
});

test('every changed byte is drift, including newlines', () => {
  assert.equal(compareEdgeSource('abc\n', 'abc').identical, false);
});

test('different versions require reconciliation', () => {
  const r = compareEdgeSource('function a() {}', 'function a() { return 1; }');
  assert.equal(r.identical, false);
  assert.notEqual(r.publishedSha256, r.candidateSha256);
});

test('empty or missing source is a hard error', () => {
  assert.throws(() => compareEdgeSource('valid', '  '), /nonempty/);
  assert.throws(() => compareEdgeSource('', 'valid'), /nonempty/);
});

test('missing path fails closed without a production call', async () => {
  await assert.rejects(() => checkEdgeDrift('', 'foo'), /Supply/);
});

test('missing files fail closed', async () => {
  await assert.rejects(() => checkEdgeDrift('/tmp/not-real-31911', '/tmp/not-real-31912'));
});

test('CLI rejects drift, reports digests only, and never source values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'edge-preflight-'));
  try {
    const published = join(dir, 'published.ts');
    const candidate = join(dir, 'candidate.ts');
    await writeFile(published, 'secret=do-not-log\n');
    await writeFile(candidate, 'secret=changed\n');
    const r = spawnSync(process.execPath, [cli, published, candidate], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    const data = JSON.parse(r.stdout.trim());
    assert.equal(data.status, 'DRIFT_NO_GO');
    assert.equal(r.stdout.includes('do-not-log'), false);
    assert.equal(r.stdout.includes('changed'), false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI only accepts matching sources as identical, not approved QA', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'edge-preflight-'));
  try {
    const p = join(dir, 'p.ts');
    const c = join(dir, 'c.ts');
    await writeFile(p, 'Deno.serve(() => new Response("ok"));\n');
    await writeFile(c, 'Deno.serve(() => new Response("ok"));\n');
    const r = spawnSync(process.execPath, [cli, p, c], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout.trim()).status, 'IDENTICAL_ONLY_NOT_QA_APPROVED');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
