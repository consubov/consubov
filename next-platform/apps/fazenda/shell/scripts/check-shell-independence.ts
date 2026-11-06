import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { build, type Plugin } from 'vite';

// Override Capataz source at the bundler boundary without editing the shared checkout.
// An accidental static/dynamic profile import must fail even if tree-shaking hides it.
const root = resolve(import.meta.dir, '../../../..');
const shell = resolve(root, 'apps/fazenda/shell');
const profilePath = /\/apps\/fazenda\/(capataz|gerente|escritorio|fabrica)\/src\//;

async function fingerprint(changeCapataz: boolean): Promise<Record<string, string>> {
  const loadedProfiles = new Set<string>();
  const boundary: Plugin = {
    name: 'qa-shell-independent-profile-source',
    enforce: 'pre',
    transform(source, id) {
      const path = id.replaceAll('\\', '/');
      if (profilePath.test(path)) loadedProfiles.add(path);
      if (changeCapataz && path.includes('/apps/fazenda/capataz/src/')) {
        return `${source}\nthrow new Error('QA: modified Capataz source must never enter shell');`;
      }
      return null;
    }
  };
  const result = await build({
    root: shell,
    configFile: resolve(shell, 'vite.config.ts'),
    plugins: [boundary],
    logLevel: 'error',
    build: { write: false }
  });
  if (loadedProfiles.size) throw new Error(`Shell loaded private profile sources: ${[...loadedProfiles].join(', ')}`);
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => {
    if (!('output' in item)) throw new Error('Expected an in-memory production build.');
    return item.output;
  });
  return Object.fromEntries(outputs.map(output => [output.fileName,
    createHash('sha256').update(output.type === 'chunk' ? output.code : output.source).digest('hex')
  ]).sort(([a], [b]) => a!.localeCompare(b!)));
}

const original = await fingerprint(false);
const changedCapataz = await fingerprint(true);
if (JSON.stringify(original) !== JSON.stringify(changedCapataz)) throw new Error('Changing Capataz changed the shell artifact.');
console.log(JSON.stringify({ profileSourceImports: 0, shellArtifactUnchanged: true, artifacts: original }, null, 2));
