import { expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertWorkspaceOutputRoot, digest, publishModule, safePath } from '../../apps/fazenda/shell/scripts/artifact-publisher';

const root = resolve(import.meta.dir, '../../.qa/tmp', `immutable-publisher-${randomUUID()}`);
async function stage(moduleId: string, content: string) {
  const path = resolve(root, moduleId, '.staging', randomUUID());
  await mkdir(path, { recursive: true });
  await writeFile(resolve(path, 'index.html'), '<script src="module.js"></script>');
  await writeFile(resolve(path, 'module.js'), content);
  return path;
}
test('independent immutable releases preserve N-1 and unchanged profiles; failed publish preserves selector', async () => {
  const gerente = await publishModule({ artifactRoot: root, moduleId: 'gerente', version: '0.1.0', staging: await stage('gerente', 'gerente') });
  const old = await publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('capataz', 'N-1') });
  const selectorPath = resolve(root, 'capataz/current/module.json');
  const previous = await readFile(selectorPath, 'utf8');
  await expect(publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('capataz', 'failed'), beforeSelect: async () => { throw new Error('simulated publisher interruption'); } })).rejects.toThrow('interruption');
  expect(await readFile(selectorPath, 'utf8')).toBe(previous);
  const next = await publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('capataz', 'N') });
  expect(next.generation).not.toBe(old.generation);
  expect(await readFile(resolve(old.release, 'module.js'), 'utf8')).toBe('N-1');
  expect(await readFile(resolve(gerente.release, 'module.js'), 'utf8')).toBe('gerente');
  expect(JSON.parse(await readFile(resolve(root, 'gerente/current/module.json'), 'utf8')).generation).toBe(gerente.generation);
  expect(digest(await readFile(resolve(next.release, 'module.json')))).toBe(next.generation);
  const repeat = await publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('capataz', 'N') });
  expect(repeat.generation).toBe(next.generation);
  await writeFile(resolve(next.release, 'module.js'), 'corruption');
  await expect(publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('capataz', 'N') })).rejects.toThrow('integrity');
});
test('publisher rejects traversal, foreign module stage, missing entry and foreign workspace roots', async () => {
  for (const path of ['../gerente/module.js', '/module.js', 'a/../../x', 'a\\x', 'http://x', '%2e%2e/x', 'C:foreign']) expect(() => safePath(root, path)).toThrow();
  await expect(assertWorkspaceOutputRoot(resolve(root, '../../../../../../outside'))).rejects.toThrow();
  await expect(publishModule({ artifactRoot: root, moduleId: '../gerente', version: '0.1.0', staging: root })).rejects.toThrow('Unknown');
  await expect(publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: await stage('gerente', 'foreign') })).rejects.toThrow('Foreign');
  const missing = resolve(root, 'capataz/.staging', randomUUID());
  await mkdir(missing, { recursive: true });
  await writeFile(resolve(missing, 'module.js'), 'no entry');
  await expect(publishModule({ artifactRoot: root, moduleId: 'capataz', version: '0.1.0', staging: missing })).rejects.toThrow('entry');
});
test('output validation rejects directory junctions before any publication', async () => {
  const target = resolve(root, 'junction-target');
  const junction = resolve(root, 'junction-output');
  await mkdir(target, { recursive: true });
  await symlink(target, junction, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(assertWorkspaceOutputRoot(junction)).rejects.toThrow('symlink');
});
