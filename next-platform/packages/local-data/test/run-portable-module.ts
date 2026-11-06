import { chromium, webkit } from '@playwright/test';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { publishModule, assetRecord, safePath } from '../../../apps/fazenda/shell/scripts/artifact-publisher';
// @ts-ignore JavaScript utility owns Windows short-profile-path validation.
import { createPersistentProfilePaths } from '../../../qa/scripts/persistent-profile-path.mjs';
import type { PortableResult } from '../../../qa/fixtures/protocol-v1-rust/host';

const root = resolve(import.meta.dir, '../../..');
const fixture = resolve(root, 'qa/fixtures/protocol-v1-rust');
const runRoot = resolve(root, '.qa/tmp', `portable-contract-${crypto.randomUUID()}`);
await mkdir(runRoot, { recursive: true });
const paths = await createPersistentProfilePaths(runRoot);
const results: unknown[] = [];
let server: ReturnType<typeof Bun.serve> | undefined;
try {
  const wasmPath = resolve(runRoot, 'module.wasm');
  const rust = spawnSync('rustc', ['--edition', '2021', '--target', 'wasm32-unknown-unknown', '--crate-type', 'cdylib', '-C', 'opt-level=z', '-C', 'panic=abort', resolve(fixture, 'module.rs'), '-o', wasmPath], { encoding: 'utf8', windowsHide: true });
  if (rust.status !== 0) throw new Error(`Rust fixture build failed: ${rust.stderr}`);
  const wasm = await readFile(wasmPath);
  const adapter = (await readFile(resolve(fixture, 'adapter.js'), 'utf8')).replace('export async function', 'async function');
  const script = `${adapter}\nstartPortableModule({wasmBytes:new Uint8Array(${JSON.stringify([...wasm])}),parentWindow:parent,nonce:document.querySelector('meta[name="consubov-module-nonce"]').content,moduleId:'capataz',onResult:result=>parent.postMessage({kind:'fixture:result',nonce:document.querySelector('meta[name="consubov-module-nonce"]').content,...result},'*')});`;
  const artifactRoot = resolve(runRoot, 'modules');
  const staging = resolve(artifactRoot, 'capataz/.staging/portable');
  await mkdir(staging, { recursive: true });
  await writeFile(resolve(staging, 'module.js'), script);
  await writeFile(resolve(staging, 'index.html'), '<!doctype html><body><script defer src="./module.js"></script>');
  const published = await publishModule({ artifactRoot, moduleId: 'capataz', staging, version: '0.1.0' });
  const build = await Bun.build({ entrypoints: [resolve(fixture, 'host.ts')], target: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' } });
  if (!build.success) throw new AggregateError(build.logs, 'Portable host build failed.');
  const source = await build.outputs[0]!.text();
  const staticAssets = new Map<string, { body: string; type: string }>([
    ['/index.html', { body: '<!doctype html><body><div id="root"></div><script defer src="/host.js"></script>', type: 'text/html' }],
    ['/host.js', { body: source, type: 'text/javascript' }],
    ['/manifest.webmanifest', { body: '{"name":"Portable contract QA","start_url":"/"}', type: 'application/manifest+json' }],
    ['/sw.js', { body: await readFile(resolve(root, 'apps/fazenda/shell/public/sw.js'), 'utf8'), type: 'text/javascript' }]
  ]);
  const shellManifest = JSON.stringify({ assets: [...staticAssets].filter(([name]) => name !== '/sw.js').map(([name, { body }]) => assetRecord(name, new TextEncoder().encode(body))) });
  server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: async request => {
    const path = new URL(request.url).pathname;
    if (path === '/shell-assets.json') return new Response(shellManifest, { headers: { 'content-type': 'application/json' } });
    if (path.startsWith('/modules/')) {
      const file = Bun.file(safePath(artifactRoot, path.slice('/modules/'.length)));
      return await file.exists() ? new Response(file) : new Response('Not found', { status: 404 });
    }
    const asset = staticAssets.get(path === '/' ? '/index.html' : path);
    return asset ? new Response(asset.body, { headers: { 'content-type': asset.type } }) : new Response('Not found', { status: 404 });
  } });
  for (const type of [chromium, webkit]) for (const readOnly of [false, true]) {
    const profile = paths.browserPath(resolve(runRoot, `${type.name()}-${readOnly ? 'read' : 'write'}`));
    const browser = await type.launchPersistentContext(profile);
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.port}/${readOnly ? '?readOnly=1' : ''}`);
      const result = await page.evaluate(() => window.portableResult) as PortableResult;
      if (!result.ok || errors.length) throw new Error(`${type.name()} readOnly=${readOnly}: ${JSON.stringify({ ...result, traces: undefined, errors })}`);
      const binary = result.traces.filter(trace => trace.binary);
      if (!binary.length || binary.some(trace => !trace.runtimeValid)) throw new Error('Actual browser Blob request failed runtime schema validation.');
      await validatePublicParity(result.traces.filter(trace => !trace.binary));
      results.push({ browser: type.name(), readOnly, artifactGeneration: published.generation, checks: result.checks, jsonParityFixtures: result.traces.filter(trace => !trace.binary).length, binaryRuntimeFixtures: binary.length, status: 'PASS' });
      console.log(`${type.name()} ${readOnly ? 'read-only' : 'read/write'}: ${result.checks.length} checks PASS; unchanged ModuleFrame + verified artifact + IndexedDB`);
    } finally { await browser.close(); }
  }
  await writeFile(resolve(root, '.qa', 'portable-contract-result.json'), JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  server?.stop(true);
  await paths.dispose();
  const owned = relative(resolve(root, '.qa/tmp'), runRoot);
  if (!owned || isAbsolute(owned) || owned === '..' || owned.startsWith(`..${sep}`)) throw new Error('Refusing to remove foreign QA path.');
  await rm(runRoot, { recursive: true, force: true });
}

async function validatePublicParity(traces: PortableResult['traces']) {
  const script = `
import json,sys
from jsonschema import Draft202012Validator,FormatChecker
from referencing import Registry,Resource
from referencing.jsonschema import DRAFT202012
data=json.load(sys.stdin)
registry=Registry().with_resources((doc['$id'],Resource.from_contents(doc,default_specification=DRAFT202012)) for doc in data['documents'])
validator=Draft202012Validator({'$ref':data['documents'][0]['$id']},registry=registry,format_checker=FormatChecker())
results=[validator.is_valid(trace['value']) == trace['runtimeValid'] for trace in data['traces']]
json.dump(results,sys.stdout)
`;
  const documents = await Promise.all(['module-protocol.schema.json', 'atomic-command.schema.json'].map(async name => JSON.parse(await Bun.file(resolve(root, 'packages/contracts/public/v1', name)).text())));
  const python = spawnSync('python', ['-c', script], { input: JSON.stringify({ documents, traces }), encoding: 'utf8', timeout: 30000, windowsHide: true });
  if (python.status !== 0) throw new Error(python.stderr);
  const parity = JSON.parse(python.stdout) as boolean[];
  if (parity.length !== traces.length || parity.some(valid => !valid)) throw new Error('Independent Python/public JSON schema parity failed.');
}

