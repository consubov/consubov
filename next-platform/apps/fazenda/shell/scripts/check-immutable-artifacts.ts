import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';
import { digest, listFiles, safePath } from './artifact-publisher';

const workspace = resolve(import.meta.dir, '../../../..');
const runRoot = resolve(workspace, '.qa/tmp', `t05-artifacts-${new Date().toISOString().replaceAll(':', '-')}-${process.pid}`);
await mkdir(runRoot, { recursive: true });
const modules = resolve(runRoot, 'modules');
const logs: string[] = [];
async function gitRead(args: string[]) {
  const child = Bun.spawn(['git', ...args], { cwd: workspace, stdout: 'pipe', stderr: 'pipe' });
  const [value, error, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (exit) throw new Error(error);
  return value.trim();
}
const initialCommit = await gitRead(['rev-parse', 'HEAD']);
const initialDirty = Boolean(await gitRead(['status', '--porcelain']));
async function moduleBuild(profile?: string, version?: string) {
  const child = Bun.spawn([process.execPath, 'run', 'apps/fazenda/shell/scripts/build-module-artifacts.ts', ...(profile ? [profile] : [])], {
    cwd: workspace, env: { ...process.env, CONSUBOV_MODULE_OUTPUT_ROOT: modules, ...(version ? { CONSUBOV_MODULE_VERSION: version } : {}) }, stdout: 'pipe', stderr: 'pipe'
  });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  logs.push(stdout, stderr);
  if (exit) throw new Error(`Module build failed (${exit}): ${stderr}`);
}
async function fingerprint(root: string) {
  return Object.fromEntries(await Promise.all((await listFiles(root)).map(async name => [name, digest(await readFile(safePath(root, name)))])));
}
await moduleBuild();
const unaffected = Object.fromEntries(await Promise.all(['gerente', 'escritorio', 'fabrica'].map(async id => [id, await fingerprint(resolve(modules, id))])));
const capatazBefore = JSON.parse(await readFile(resolve(modules, 'capataz/current/module.json'), 'utf8'));
await moduleBuild('capataz', '0.1.1-qa');
for (const id of Object.keys(unaffected)) {
  if (JSON.stringify(await fingerprint(resolve(modules, id))) !== JSON.stringify(unaffected[id])) throw new Error(`Foreign profile changed: ${id}`);
}
const capatazAfter = JSON.parse(await readFile(resolve(modules, 'capataz/current/module.json'), 'utf8'));
if (capatazBefore.generation === capatazAfter.generation) throw new Error('Version injection failed to change module generation.');
const capatazManifest = JSON.parse(await readFile(resolve(modules, 'capataz/releases', capatazAfter.generation, 'module.json'), 'utf8'));
const js = capatazManifest.assets.find((asset: { url: string }) => asset.url.endsWith('.js'));
if (!(await readFile(resolve(modules, 'capataz/releases', capatazAfter.generation, js.url), 'utf8')).includes('0.1.1-qa')) throw new Error('Actual handshake version was not injected.');
const shell = resolve(workspace, 'apps/fazenda/shell');
async function shellBuild(name: string, changeCapataz: boolean, publicDir?: string) {
  const outDir = resolve(runRoot, name);
  await build({ root: shell, configFile: resolve(shell, 'vite.config.ts'), ...(publicDir ? { publicDir } : {}), logLevel: 'error', build: { outDir }, plugins: [{
    name: 'qa-private-profile-boundary', enforce: 'pre', transform(source, id) {
      if (/\/apps\/fazenda\/(capataz|gerente|escritorio|fabrica)\/src\//.test(id.replaceAll('\\', '/'))) throw new Error('Shell imported private profile source.');
      return changeCapataz && id.replaceAll('\\', '/').includes('/capataz/src/') ? `${source}\nthrow new Error('changed Capataz');` : null;
    }
  }] });
  const manifestBytes = await readFile(resolve(outDir, 'shell-assets.json'));
  const manifest = JSON.parse(manifestBytes.toString());
  const generation = digest(manifestBytes);
  if (!manifest.assets.some((asset: { url: string }) => asset.url === '/index.html') || !manifest.assets.some((asset: { url: string }) => asset.url === '/manifest.webmanifest')) throw new Error('Shell critical files absent.');
  for (const asset of manifest.assets) {
    const bytes = await readFile(safePath(outDir, `shell-releases/${generation}${asset.url}`));
    if (digest(bytes) !== asset.sha256 || bytes.byteLength !== asset.bytes) throw new Error('Shell snapshot integrity failed.');
  }
  if (!(await readFile(resolve(outDir, 'sw.js'), 'utf8')).includes(`"generation":"${generation}"`)) throw new Error('SW descriptor missing.');
  return { generation, files: await fingerprint(outDir), count: manifest.assets.length };
}
const originalShell = await shellBuild('shell-a', false);
const changedCapatazShell = await shellBuild('shell-b', true);
if (JSON.stringify(originalShell) !== JSON.stringify(changedCapatazShell)) throw new Error('Capataz changed shell binary.');
const publicDir = resolve(runRoot, 'worker-template-change');
await mkdir(publicDir);
for (const name of await listFiles(resolve(shell, 'public'))) {
  const destination = safePath(publicDir, name);
  await mkdir(resolve(destination, '..'), { recursive: true });
  await writeFile(destination, await readFile(safePath(resolve(shell, 'public'), name)));
}
await writeFile(resolve(publicDir, 'sw.js'), (await readFile(resolve(publicDir, 'sw.js'), 'utf8')) + '\n// QA worker-only binary change\n');
const changedWorker = await shellBuild('shell-worker-change', false, publicDir);
if (changedWorker.generation === originalShell.generation) throw new Error('Worker-only change reused shell cache generation.');
const result = { status: 'PASS', workingTreeDirty: true, runRoot, immutableModuleRelease: capatazAfter.generation, previousModuleRelease: capatazBefore.generation, unaffectedProfiles: Object.keys(unaffected), shellGeneration: originalShell.generation, shellAssetCount: originalShell.count, capatazOnlyShellUnchanged: true, workerOnlyChangeCreatesGeneration: true };
Object.assign(result, { initialCommit, finalCommit: await gitRead(['rev-parse', 'HEAD']), initialDirty, workingTreeDirty: Boolean(await gitRead(['status', '--porcelain'])), evidenceScope: 'targeted publisher/build invariants; concurrent working tree, not phase acceptance' });
await writeFile(resolve(runRoot, 'output.log'), logs.join('\n'));
await writeFile(resolve(runRoot, 'result.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
