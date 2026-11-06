import { createHash, randomUUID } from 'node:crypto';
import { assertWorkspaceOutputRoot, moduleIds, publishModule, safePath } from './artifact-publisher';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { build } from 'vite';

const repoRoot = resolve(import.meta.dir, '../../../..');
const artifactRoot = resolve(process.env.CONSUBOV_MODULE_OUTPUT_ROOT ?? resolve(repoRoot, '.module-artifacts/modules'));
await assertWorkspaceOutputRoot(artifactRoot);
const allProfiles = moduleIds;
const requestedProfile = process.argv[2];
if (requestedProfile && !(allProfiles as readonly string[]).includes(requestedProfile)) throw new Error('Unknown module requested.');
const profiles = requestedProfile ? allProfiles.filter(profile => profile === requestedProfile) : allProfiles;
const aliases = {
  '@consubov/contracts': resolve(repoRoot, 'packages/contracts/src/index.ts'),
  '@consubov/domain-projection/capataz': resolve(repoRoot, 'packages/domain-projection/src/capataz.ts'),
  '@consubov/domain-projection/gerente': resolve(repoRoot, 'packages/domain-projection/src/gerente.ts'),
  '@consubov/domain-projection/escritorio': resolve(repoRoot, 'packages/domain-projection/src/escritorio.ts'),
  '@consubov/domain-projection/fabrica': resolve(repoRoot, 'packages/domain-projection/src/fabrica.ts'),
  '@consubov/domain-projection': resolve(repoRoot, 'packages/domain-projection/src/index.ts'),
  '@consubov/ui': resolve(repoRoot, 'packages/ui/src/index.ts'),
  '@consubov/auth-client': resolve(repoRoot, 'packages/auth-client/src/index.ts')
};

for (const moduleId of profiles) {
  const moduleRoot = resolve(repoRoot, `apps/fazenda/${moduleId}`);
  const packageJson = JSON.parse(await readFile(resolve(moduleRoot, 'package.json'), 'utf8')) as { version: string };
  const version = process.env.CONSUBOV_MODULE_VERSION ?? packageJson.version;
  const outDir = safePath(artifactRoot, `${moduleId}/.staging/${randomUUID()}`);
  await mkdir(outDir, { recursive: true });
  await build({
    configFile: false,
    root: moduleRoot,
    base: './',
    plugins: [react()],
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), __CONSUBOV_MODULE_VERSION__: JSON.stringify(version) },
    resolve: { alias: aliases },
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2018',
      sourcemap: false,
      cssCodeSplit: false,
      lib: {
        entry: resolve(moduleRoot, 'src/remote-entry.tsx'),
        name: `Consubov${moduleId[0]!.toUpperCase()}${moduleId.slice(1)}`,
        formats: ['iife'],
        fileName: 'module'
      },
      rollupOptions: { output: { inlineDynamicImports: true } }
    }
  });

  const emitted = await readdir(outDir);
  const script = emitted.find(file => file.endsWith('.js'));
  if (!script) throw new Error(`Build de ${moduleId} não gerou entry JavaScript.`);
  const style = emitted.find(file => file.endsWith('.css'));
  const assetNames = [script, ...(style ? [style] : [])];
  const assets = await Promise.all(assetNames.map(async url => {
    const bytes = await readFile(resolve(outDir, url));
    const digest = createHash('sha256').update(bytes).digest();
    return { url, bytes: bytes.byteLength, sha256: digest.toString('hex'), integrity: `sha256-${digest.toString('base64')}` };
  }));
  const scriptIntegrity = assets.find(asset => asset.url === script)!.integrity;
  const styleAsset = style ? assets.find(asset => asset.url === style) : undefined;
  const links = styleAsset ? `<link rel="stylesheet" href="./${styleAsset.url}" integrity="${styleAsset.integrity}" crossorigin="anonymous">` : '';
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>CONSUBOV ${moduleId}</title>
${links}
</head>
<body>
<main id="root"></main>
<script defer src="./${script}" integrity="${scriptIntegrity}" crossorigin="anonymous"></script>
</body>
</html>
`;
  await writeFile(resolve(outDir, 'index.html'), html, 'utf8');
  const htmlBytes = Buffer.from(html, 'utf8');
  const htmlDigest = createHash('sha256').update(htmlBytes).digest();
  assets.push({ url: 'index.html', bytes: htmlBytes.byteLength, sha256: htmlDigest.toString('hex'), integrity: `sha256-${htmlDigest.toString('base64')}` });

  const published = await publishModule({ artifactRoot, moduleId, staging: outDir, version });
  console.info(`Artefato local de ${moduleId} publicado: ${published.generation} (${published.manifest.assets.length} assets)`);
}
