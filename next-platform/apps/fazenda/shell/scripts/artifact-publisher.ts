import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const moduleIds = ['capataz', 'gerente', 'escritorio', 'fabrica'] as const;
const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
export async function assertWorkspaceOutputRoot(root: string): Promise<void> {
  const suffix = relative(workspace, resolve(root));
  if (!suffix || suffix.startsWith('..') || isAbsolute(suffix)) throw new Error('Artifact output must be inside next-platform.');
  const canonicalWorkspace = await realpath(workspace);
  let current = workspace;
  for (const part of suffix.split(sep)) {
    current = resolve(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !(await realpath(current)).startsWith(canonicalWorkspace + sep)) throw new Error('Artifact output symlink/escape.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
export function digest(bytes: Uint8Array | string): string { return createHash('sha256').update(bytes).digest('hex'); }
export function assetRecord(url: string, bytes: Uint8Array) {
  return { url, bytes: bytes.byteLength, sha256: digest(bytes), integrity: `sha256-${createHash('sha256').update(bytes).digest('base64')}` };
}
export function safePath(root: string, name: string): string {
  if (!name || !/^[a-zA-Z0-9_./@-]+$/.test(name) || isAbsolute(name) || name.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe artifact path.');
  const result = resolve(root, name);
  if (relative(resolve(root), result).startsWith(`..${sep}`)) throw new Error('Artifact escapes root.');
  return result;
}
export async function listFiles(root: string, prefix = ''): Promise<string[]> {
  const names: string[] = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw new Error('Artifact symlinks are forbidden.');
    if (item.isDirectory()) names.push(...await listFiles(safePath(root, item.name), name));
    else if (item.isFile()) names.push(name);
    else throw new Error('Unsupported artifact file.');
  }
  return names.sort();
}
export async function validateAssets(root: string, assets: ReturnType<typeof assetRecord>[], entry: string): Promise<void> {
  if (!assets.some(asset => asset.url === entry) || new Set(assets.map(asset => asset.url)).size !== assets.length) throw new Error('Invalid artifact entry/assets.');
  for (const asset of assets) {
    const file = safePath(root, asset.url);
    if (!(await lstat(file)).isFile()) throw new Error('Asset is not a file.');
    const actual = assetRecord(asset.url, await readFile(file));
    if (JSON.stringify(actual) !== JSON.stringify(asset)) throw new Error('Artifact integrity mismatch.');
  }
  const actualFiles = (await listFiles(root)).filter(name => name !== 'module.json');
  if (JSON.stringify(actualFiles) !== JSON.stringify(assets.map(asset => asset.url).sort())) throw new Error('Unlisted artifact file.');
}
export async function publishModule(options: { artifactRoot: string; moduleId: string; staging: string; version: string; beforeSelect?: () => Promise<void> }) {
  const { artifactRoot, moduleId, staging, version } = options;
  await assertWorkspaceOutputRoot(artifactRoot);
  await assertWorkspaceOutputRoot(staging);
  if (!(moduleIds as readonly string[]).includes(moduleId)) throw new Error('Unknown module.');
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid module version.');
  const moduleRoot = safePath(artifactRoot, moduleId);
  // Staging is owned by this publisher and must remain under this module's root.
  const stagedRelative = relative(moduleRoot, resolve(staging));
  if (!stagedRelative.startsWith(`.staging${sep}`) || stagedRelative.includes(`..${sep}`)) throw new Error('Foreign module staging path.');
  const files = await listFiles(staging);
  const assets = await Promise.all(files.map(async name => assetRecord(name, await readFile(safePath(staging, name)))));
  const manifest = { moduleId, profileId: moduleId, version, protocolVersion: 1, apiVersions: ['1'], localDataSchemaVersion: 2, capabilities: ['local-data.read', 'local-data.write'], dependencies: [], entry: 'index.html', assets };
  await validateAssets(staging, assets, manifest.entry);
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  const generation = digest(manifestBytes);
  await writeFile(safePath(staging, 'module.json'), manifestBytes);
  const releases = safePath(moduleRoot, 'releases');
  await assertWorkspaceOutputRoot(releases);
  await mkdir(releases, { recursive: true });
  const release = safePath(releases, generation);
  await assertWorkspaceOutputRoot(release);
  try { await rename(staging, release); }
  catch (error) {
    if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    if (await readFile(safePath(release, 'module.json'), 'utf8') !== manifestBytes) throw new Error('Immutable release collision.');
    await validateAssets(release, assets, manifest.entry);
  }
  await validateAssets(release, assets, manifest.entry);
  await options.beforeSelect?.();
  const current = safePath(moduleRoot, 'current');
  await assertWorkspaceOutputRoot(current);
  await mkdir(current, { recursive: true });
  const selector = { schemaVersion: 2, moduleId, generation, releaseUrl: `/modules/${moduleId}/releases/${generation}/module.json` };
  const temporary = safePath(current, `module.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(selector, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, safePath(current, 'module.json'));
  return { generation, release, manifest, selector };
}
