import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRouter } from '../../api/src/router';
import { InMemoryLedger } from '../../api/src/ledger/in-memory-ledger';

const root = resolve(import.meta.dir, '../..');
const shellRoot = resolve(root, 'apps/fazenda/shell/dist');
const moduleRoot = resolve(root, '.module-artifacts/modules');
const host = '127.0.0.1';
const port = Number(Bun.env.T03_PORT ?? 5187);
const profiles = new Set(['capataz', 'gerente', 'escritorio', 'fabrica']);
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.mjs': 'text/javascript; charset=utf-8'
};

export function safeFile(base: string, relative: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(relative); } catch { return null; }
  if (!/^[a-zA-Z0-9_./@-]+$/.test(decoded) || decoded.startsWith('/') || decoded.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const path = resolve(base, decoded);
  return path.startsWith(`${base}${sep}`) ? path : null;
}

/** Factory permits isolated fixture tests without opening or restarting the QA port. */
export function createProductionHandler(options: { shellRoot?: string; moduleRoot?: string } = {}) {
  const shellBase = resolve(options.shellRoot ?? shellRoot);
  const moduleBase = resolve(options.moduleRoot ?? moduleRoot);
  const apiRouter = createRouter(new InMemoryLedger());
  return async (request: Request): Promise<Response> => {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.startsWith('/api/v1/')) return await apiRouter(request);
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = requestUrl;
  let path: string | null;
  let headers: Record<string, string>;
  let base = shellBase;
  let immutable = false;
  const artifactRoute = url.pathname.startsWith('/modules/') || url.pathname.startsWith('/shell-releases/');
  if (url.pathname.startsWith('/modules/')) {
    const parts = url.pathname.slice('/modules/'.length).split('/');
    const current = parts.length === 3 && parts[1] === 'current' && ['index.html', 'module.json', 'module.iife.js'].includes(parts[2]!);
    immutable = parts.length >= 4 && parts[1] === 'releases' && /^[a-f0-9]{64}$/.test(parts[2]!);
    if (!profiles.has(parts[0]!) || (!current && !immutable)) {
      return new Response('Not found', { status: 404 });
    }
    base = moduleBase;
    path = safeFile(base, parts.join('/'));
    headers = {
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; frame-ancestors 'self'"
    };
  } else {
    if (url.pathname.startsWith('/shell-releases/')) {
      const parts = url.pathname.slice('/shell-releases/'.length).split('/');
      if (parts.length < 2 || !/^[a-f0-9]{64}$/.test(parts[0]!)) return new Response('Not found', { status: 404 });
      immutable = true;
    }
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    path = safeFile(base, relative);
    headers = {
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : url.pathname === '/sw.js' || url.pathname === '/' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      ...(url.pathname === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {})
    };
  }
  if (!path) return new Response('Bad path', { status: 400 });
  try {
    // Lexical checks alone cannot stop a symlink/junction inside a fixture output.
    const [canonicalBase, canonicalFile] = await Promise.all([realpath(base), realpath(path)]);
    if (!canonicalFile.startsWith(`${canonicalBase}${sep}`)) return new Response('Bad path', { status: 400 });
    const info = await stat(path);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    const bytes = new Uint8Array(await readFile(path));
    return new Response(request.method === 'HEAD' ? null : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
      headers: { ...headers, 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }
    });
  } catch {
    // The shell uses hash routes; all unknown paths resolve to its built entry.
    if (artifactRoute) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    try {
      const indexPath = resolve(shellBase, 'index.html');
      if (!(await realpath(indexPath)).startsWith(`${await realpath(shellBase)}${sep}`)) return new Response('Bad path', { status: 400 });
      const bytes = new Uint8Array(await readFile(indexPath));
      return new Response(request.method === 'HEAD' ? null : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
        headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch { return new Response('Build shell and module artifacts first.', { status: 503 }); }
  }
  };
}

if (import.meta.main) {
  const server = Bun.serve({ hostname: host, port, fetch: createProductionHandler() });
  console.info(`T03 production QA server: http://${server.hostname}:${server.port}`);
}
