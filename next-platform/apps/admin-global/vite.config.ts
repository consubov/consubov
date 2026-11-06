import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { adminAssetPublisher } from './scripts/admin-asset-publisher';

export default defineConfig(({ mode }) => {
  if (!['production', 'development', 'candidate', 'lab'].includes(mode)) throw new Error('Unknown ADM build mode.');
  const releaseMode = mode === 'lab' ? 'lab' : 'candidate';
  const origin = process.env.CONSUBOV_ADM_ORIGIN ?? `http://127.0.0.1:${releaseMode === 'lab' ? 5175 : 5174}`;
  const url = new URL(origin);
  if (url.origin !== origin || url.hostname !== '127.0.0.1' || url.protocol !== 'http:') throw new Error('ADM laboratory requires an exact loopback origin.');
  const version = process.env.CONSUBOV_ADM_VERSION ?? (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,79}$/.test(version)) throw new Error('Invalid ADM release version.');
  return {
    root: path.resolve(__dirname),
    server: { host: '127.0.0.1', port: Number(url.port), strictPort: true, proxy: { '/api/v1': { target: 'http://127.0.0.1:3333', changeOrigin: true } } },
    preview: { host: '127.0.0.1', port: Number(url.port), strictPort: true },
    define: {
      __ADM_RELEASE_MODE__: JSON.stringify(releaseMode), __ADM_VERSION__: JSON.stringify(version),
      __ADM_ORIGIN__: JSON.stringify(origin), __ADM_RELEASE_SELECTOR__: JSON.stringify('/admin-release.json')
    },
    resolve: { alias: {
      '@admin-entry': path.resolve(__dirname, releaseMode === 'lab' ? 'scripts/lab-entry.tsx' : 'src/secure/AdminRuntime.tsx'),
      '@consubov/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@consubov/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@consubov/auth-client': path.resolve(__dirname, '../../packages/auth-client/src/index.ts')
    } },
    build: { outDir: `dist-${releaseMode}`, emptyOutDir: false, target: 'esnext', sourcemap: false },
    plugins: [react(), adminAssetPublisher({ mode: releaseMode, origin, version })]
  };
});
