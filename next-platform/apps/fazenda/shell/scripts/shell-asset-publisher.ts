import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { assertWorkspaceOutputRoot, assetRecord, digest, listFiles, safePath } from './artifact-publisher';

/** Snapshot only files belonging to this build; old releases remain immutable. */
export function shellAssetManifest(): Plugin {
  let config: ResolvedConfig;
  let emitted: string[] = [];
  return {
    name: 'consubov-shell-asset-manifest',
    async configResolved(value) {
      config = value;
      if (config.command === 'build' && config.build.write) await assertWorkspaceOutputRoot(resolve(config.root, config.build.outDir));
    },
    writeBundle(_options, bundle) { emitted = Object.keys(bundle).sort(); },
    async closeBundle() {
      if (!config.build.write) return;
      const outDir = resolve(config.root, config.build.outDir);
      const publicNames = config.publicDir ? await listFiles(config.publicDir) : [];
      const names = [...new Set([...emitted, ...publicNames])].filter(name => name !== 'sw.js' && name !== 'shell-assets.json').sort();
      if (!names.includes('index.html') || !names.includes('manifest.webmanifest')) throw new Error('Incomplete shell build.');
      const files = await Promise.all(names.map(async name => ({ name, bytes: await readFile(safePath(outDir, name)) })));
      const template = await readFile(safePath(outDir, 'sw.js'), 'utf8');
      if (template.split('const SHELL_RELEASE = null;').length !== 2) throw new Error('Missing or ambiguous shell release marker.');
      const manifest = { schemaVersion: 1, protocolVersions: [1], apiVersions: ['1'], workerTemplateSha256: digest(template), assets: files.map(file => assetRecord(`/${file.name}`, file.bytes)) };
      const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
      const generation = digest(manifestBytes);
      const resourceBase = `/shell-releases/${generation}/`;
      const snapshot = safePath(outDir, resourceBase.slice(1, -1));
      for (const file of [...files, { name: 'shell-assets.json', bytes: Buffer.from(manifestBytes) }]) {
        const destination = safePath(snapshot, file.name);
        await mkdir(resolve(destination, '..'), { recursive: true });
        try { await writeFile(destination, file.bytes, { flag: 'wx' }); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          if (!(await readFile(destination)).equals(file.bytes)) throw new Error('Immutable shell release collision.');
        }
      }
      await writeFile(safePath(outDir, 'shell-assets.json'), manifestBytes);
      const release = { generation, manifestUrl: `${resourceBase}shell-assets.json`, resourceBase, manifestSha256: generation, protocolVersions: [1], apiVersions: ['1'] };
      await writeFile(safePath(outDir, 'sw.js'), template.replace('const SHELL_RELEASE = null;', `const SHELL_RELEASE = ${JSON.stringify(release)};`));
    }
  };
}
