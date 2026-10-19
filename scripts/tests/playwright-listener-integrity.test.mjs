import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = fileURLToPath(new URL('../../', import.meta.url));
const web = join(root, 'apps/web');
const requireWeb = createRequire(join(web, 'package.json'));
const playwrightCLI = join(dirname(requireWeb.resolve('@playwright/test/package.json')), 'cli.js');
const viteCLI = join(dirname(requireWeb.resolve('vite/package.json')), 'bin/vite.js');
const configURL = new URL('../../apps/web/playwright.config.ts', import.meta.url);

async function run(program, args, options = {}) {
  const child = spawn(program, args, { cwd: web, env: { ...process.env, CI: '' }, ...options });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const timer = setTimeout(() => child.kill(), 30_000);
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    return { code, output };
  } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
}

async function fixture(focused = false) {
  const dir = await mkdtemp(join(tmpdir(), 'consubov-listener-'));
  // Retain only tiny test fixtures under OS temporary storage; no app source or customer data.
  const marker = join(dir, 'executed');
  await writeFile(join(dir, 'playwright.config.ts'), `import config from ${JSON.stringify(fileURLToPath(configURL))};\nexport default {...config,testDir:${JSON.stringify(dir)},projects:[{name:'listener-fixture'}],reporter:'line'};\n`);
  await writeFile(join(dir, 'listener.spec.ts'), `import { test } from ${JSON.stringify(requireWeb.resolve('@playwright/test').replace(/index\.js$/, 'index.mjs'))};\nimport { writeFileSync } from 'node:fs';\ntest${focused ? '.only' : ''}('local listener integrity',()=>writeFileSync(${JSON.stringify(marker)},'executed'));\n`);
  return { dir, marker, config: join(dir, 'playwright.config.ts') };
}

test('actual local Playwright rejects focused tests before running a subset', async () => {
  const probe = await fixture(true);
  const result = await run(process.execPath, [playwrightCLI, 'test', '--config', probe.config, '--list']);
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /forbidOnly|test\.only/i);
  assert.equal(existsSync(probe.marker), false);
});

test('actual Playwright refuses an owned existing8080 listener and preserves it', async t => {
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.end('owned stale fixture'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(8080, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const probe = await fixture();
  const result = await run(process.execPath, [playwrightCLI, 'test', '--config', probe.config]);
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /already used|reuseExistingServer/i);
  assert.equal(existsSync(probe.marker), false, 'no test may run against the stale server');
  assert.ok(requests > 0);
  assert.equal(await (await fetch('http://127.0.0.1:8080/login')).text(), 'owned stale fixture');
  assert.equal(server.listening, true);
});

test('installed Vite with real config arguments refuses an occupied port instead of hopping', async t => {
  const server = createServer((_req, res) => res.end('owned occupied fixture'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Node 22 needs type stripping to load the installed TypeScript Playwright config.
  // Inspect the real command in a bounded subprocess; do not weaken Playwright gates.
  const command = execFileSync(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '--eval',
    `const { default: config } = await import(${JSON.stringify(configURL.href)}); process.stdout.write(config.webServer.command)`,
  ], { cwd: web, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  // Execute installed Vite directly so cleanup owns one process, preserving the exact dev flags.
  const words = command.split(/\s+/);
  assert.deepEqual(words.slice(0, 4), ['bun', 'run', 'dev', '--']);
  const args = words.slice(4);
  const portIndex = args.indexOf('--port') + 1;
  assert.ok(portIndex > 0);
  args[portIndex] = String(server.address().port);
  const result = await run(process.execPath, [viteCLI, ...args]);
  assert.notEqual(result.code, 0, result.output);
  assert.match(result.output, /already in use/i);
  assert.doesNotMatch(result.output, /trying another one/i);
  assert.equal(server.listening, true);
  assert.equal(await (await fetch(`http://127.0.0.1:${server.address().port}/`)).text(), 'owned occupied fixture');
});
