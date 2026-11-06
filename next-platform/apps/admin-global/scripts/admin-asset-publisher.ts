import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, ResolvedConfig } from 'vite';

export type AdminMode = 'candidate' | 'lab';
export interface AdminAsset { path: string; url: string; sha256: string; bytes: number }
export interface AdminRelease {
  schemaVersion: 1; generation: string; mode: AdminMode; origin: string; version: string;
  workerTemplateSha256: string; resourceBase: string; assets: AdminAsset[];
}
export const adminDigest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const scriptRoot = dirname(fileURLToPath(import.meta.url));
const workspace = resolve(scriptRoot, '../../..');
const appRoot = resolve(scriptRoot, '..');
const inside = (root: string, target: string) => { const tail = relative(root, target); return tail === '' || (!tail.startsWith(`..${sep}`) && tail !== '..' && !isAbsolute(tail)); };
async function noLinksBelow(root: string): Promise<void> {
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('ADM output symlink/junction forbidden.');
      if (entry.isDirectory()) await noLinksBelow(resolve(root, entry.name));
    }
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

/** Check existing ancestors before Vite or publication can write through a junction. */
export async function assertAdminOutput(target: string, mode: AdminMode) {
  const absolute = resolve(target);
  const allowed = absolute === resolve(appRoot, `dist-${mode}`) || inside(resolve(workspace, '.qa/tmp'), absolute) && absolute !== resolve(workspace, '.qa/tmp');
  if (!allowed) throw new Error('ADM output must use its mode directory or an isolated .qa/tmp directory.');
  let current = workspace;
  for (const component of relative(workspace, absolute).split(sep)) {
    current = resolve(current, component);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('ADM output symlink/junction forbidden.');
      if (!inside(await realpath(workspace), await realpath(current))) throw new Error('ADM output escapes workspace.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  await noLinksBelow(absolute);
}
function assetPath(root: string, name: string) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').some(part => part === '..' || part === '' || part === '.')) throw new Error('Invalid ADM asset path.');
  const target = resolve(root, name);
  if (!inside(root, target)) throw new Error('ADM asset escapes output.');
  return target;
}
async function publicFiles(root: string, prefix = ''): Promise<string[]> {
  const names: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('ADM public symlink forbidden.');
    const name = prefix + entry.name;
    if (entry.isDirectory()) names.push(...await publicFiles(resolve(root, entry.name), `${name}/`));
    else names.push(name);
  }
  return names;
}
async function immutableWrite(path: string, bytes: Uint8Array) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (!(await readFile(path)).equals(Buffer.from(bytes))) throw new Error('ADM immutable release integrity collision.');
  }
}
async function reserveMode(outDir: string, mode: AdminMode) {
  await mkdir(outDir, { recursive: true });
  const marker = resolve(outDir, '.admin-build-mode');
  try { await writeFile(marker, mode, { flag: 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    if (await readFile(marker, 'utf8') !== mode) throw new Error('ADM candidate and lab outputs must be separate.');
  }
}

export async function publishAdmin(options: { outDir: string; mode: AdminMode; origin: string; version: string; names: string[]; beforeSelect?: () => Promise<void> }) {
  const { outDir, mode, origin, version } = options;
  await assertAdminOutput(outDir, mode);
  await reserveMode(outDir, mode);
  const names = [...new Set(options.names)].filter(name => name !== 'sw.js').sort();
  if (!names.includes('index.html') || !names.includes('manifest.webmanifest') || names.some(name => !/^(index\.html|manifest\.webmanifest|assets\/[\w.-]+\.(js|css|woff2?|png|svg)|icons\/adm-(192|512|maskable-512)\.png)$/.test(name))) throw new Error('Incomplete or non-static ADM build.');
  const files = await Promise.all(names.map(async name => ({ name, bytes: await readFile(assetPath(outDir, name)) })));
  const template = await readFile(assetPath(outDir, 'sw.js'), 'utf8');
  if (template.split('const ADM_RELEASE = null;').length !== 2) throw new Error('ADM worker release marker missing.');
  const input = { schemaVersion: 1, mode, origin, version, workerTemplateSha256: adminDigest(template), assets: files.map(file => ({ path: `/${file.name}`, sha256: adminDigest(file.bytes), bytes: file.bytes.length })) };
  const generation = adminDigest(JSON.stringify(input));
  const resourceBase = `/admin-releases/${mode}/${generation}/`;
  const release: AdminRelease = { ...input, schemaVersion: 1, generation, resourceBase, assets: input.assets.map(asset => ({ ...asset, url: resourceBase + asset.path.slice(1) })) };
  const manifestBytes = Buffer.from(JSON.stringify(release, null, 2) + '\n');
  const workerBytes = Buffer.from(template.replace('const ADM_RELEASE = null;', `const ADM_RELEASE = ${JSON.stringify(release)};`));
  for (const file of files) await immutableWrite(assetPath(outDir, resourceBase.slice(1) + file.name), file.bytes);
  await immutableWrite(assetPath(outDir, resourceBase.slice(1) + 'release.json'), manifestBytes);
  await immutableWrite(assetPath(outDir, resourceBase.slice(1) + 'sw.js'), workerBytes);
  // Re-read the entire immutable package before selection. Interrupted publication leaves the old selector untouched.
  for (const asset of release.assets) if (adminDigest(await readFile(assetPath(outDir, asset.url.slice(1)))) !== asset.sha256) throw new Error('ADM snapshot integrity failure.');
  await options.beforeSelect?.();
  await writeFile(assetPath(outDir, 'sw.js'), workerBytes);
  const selector = { generation, mode, origin, version, manifestUrl: `${resourceBase}release.json`, manifestSha256: adminDigest(manifestBytes), resourceBase };
  const temporary = assetPath(outDir, `admin-release-${randomUUID()}.json`);
  await writeFile(temporary, JSON.stringify(selector, null, 2) + '\n');
  await rename(temporary, assetPath(outDir, 'admin-release.json'));
  return release;
}

export function adminAssetPublisher(options: { mode: AdminMode; origin: string; version: string }): Plugin {
  let config: ResolvedConfig;
  let emitted: string[] = [];
  return {
    name: 'consubov-admin-independent-release',
    async configResolved(value) {
      config = value;
      if (config.command === 'build' && config.build.write) {
        const outDir = resolve(config.root, config.build.outDir);
        await assertAdminOutput(outDir, options.mode);
        await reserveMode(outDir, options.mode);
      }
    },
    transformIndexHtml(html) { return options.mode === 'lab' ? html.replace('<title>ADM CONSUBOV</title>', '<title>ADM CONSUBOV — Laboratório</title>') : html; },
    generateBundle() {
      if (options.mode !== 'candidate') return;
      for (const moduleId of this.getModuleIds()) {
        const normalized = moduleId.replaceAll('\\', '/');
        const marker = '/apps/admin-global/src/';
        const local = normalized.split(marker)[1];
        if (normalized.includes('/packages/') || normalized.includes('/scripts/lab-entry.tsx') || local && local !== 'main.tsx' && !local.startsWith('secure/')) throw new Error(`Candidate ADM contains a forbidden legacy/shared module: ${normalized}`);
      }
    },
    writeBundle(_output, bundle) { emitted = Object.keys(bundle); },
    async closeBundle() {
      if (config.command !== 'build' || !config.build.write) return;
      const outDir = resolve(config.root, config.build.outDir);
      if (options.mode === 'lab') {
        const path = assetPath(outDir, 'manifest.webmanifest');
        const manifest = JSON.parse(await readFile(path, 'utf8'));
        manifest.id = '/adm-consubov-lab'; manifest.name = 'ADM CONSUBOV Laboratório'; manifest.short_name = 'ADM Lab';
        await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
      }
      const names = [...emitted, ...await publicFiles(config.publicDir)];
      await publishAdmin({ ...options, outDir, names });
    }
  };
}
