import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  root: '.',
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@consubov/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@consubov/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@consubov/auth-client': path.resolve(__dirname, '../../packages/auth-client/src/index.ts')
    }
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'consubov-core': ['@consubov/contracts', '@consubov/ui', '@consubov/auth-client']
        }
      }
    }
  },
  plugins: [react()]
});
