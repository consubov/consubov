import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const moduleURL = new URL('../qa/run-a11y-local.mjs', import.meta.url);
const html = (bad = false) => `<!doctype html><html lang="en"><head><title>Local audit fixture</title></head><body><main><h1>Local audit fixture</h1><button>${bad ? '' : 'Continue'}</button></main></body></html>`;
test('local Axe runner scans real Chromium, rejects violations and empty pages, and keeps all reports', async (t) => {
  assert.ok(existsSync(moduleURL), 'phase5 needs its locked Playwright accessibility runner');
  const { auditLocalAccessibility } = await import(moduleURL);
  let mode = 'good';
  const server = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end(mode === 'empty' ? '<!doctype html><html><body></body></html>' : html(mode === 'bad' && req.url === '/login')); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const dir = await mkdtemp(join(tmpdir(), 'consubov-a11y-'));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); });
  const options = { baseURL: `http://127.0.0.1:${server.address().port}`, outputDir: dir, timeout: 1500 };
  const good = await auditLocalAccessibility(options);
  assert.equal(good.pages.length, 3);
  assert.equal(good.status, 'PASS');
  mode = 'bad';
  await assert.rejects(auditLocalAccessibility(options), /accessibility audit failed/i);
  const bad = JSON.parse(await readFile(join(dir, 'axe.json'), 'utf8'));
  assert.equal(bad.pages.length, 3);
  assert.equal(bad.status, 'FAIL');
  assert.ok(bad.pages.find(p => p.path === '/login').violations.some(v => v.id === 'button-name'));
  mode = 'empty';
  await assert.rejects(auditLocalAccessibility(options), /accessibility audit failed/i);
  const empty = JSON.parse(await readFile(join(dir, 'axe.json'), 'utf8'));
  assert.equal(empty.pages.filter(p => p.error).length, 3);
});
test('rejects remote and credential-bearing audit targets before starting a browser', async () => {
  assert.ok(existsSync(moduleURL), 'local-only guard must exist');
  const { auditLocalAccessibility } = await import(moduleURL);
  for (const baseURL of ['https://example.com', 'http://user:pass@127.0.0.1:4175', 'file:///tmp/index.html']) {
    await assert.rejects(auditLocalAccessibility({ baseURL, outputDir: tmpdir() }), /local HTTP origin/i);
  }
});
