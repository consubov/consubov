import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const artifactRoot = resolve(import.meta.dir, '../../.module-artifacts');
const shellOrigin = Bun.env.MODULE_SHELL_ORIGIN ?? 'http://127.0.0.1:5173';
const serverHost = '127.0.0.1';
const serverPort = Number(Bun.env.MODULE_ARTIFACT_PORT ?? 5190);
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
};

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(Bun.env.MODULE_ARTIFACT_PORT ?? 5190),
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS' } });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    if (!url.pathname.startsWith('/modules/')) return new Response('Not found', { status: 404 });
    let relativePath: string;
    try { relativePath = decodeURIComponent(url.pathname.slice('/modules/'.length)); }
    catch { return new Response('Bad path', { status: 400 }); }
    const modulesRoot = resolve(artifactRoot, 'modules');
    const path = resolve(modulesRoot, relativePath);
    if (!path.startsWith(`${modulesRoot}${sep}`)) return new Response('Bad path', { status: 400 });
    let body: Uint8Array;
    try { body = new Uint8Array(await readFile(path)); }
    catch { return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } }); }
    const artifactOrigin = `http://${serverHost}:${serverPort}`;
    const bodyBuffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    return new Response(request.method === 'HEAD' ? null : bodyBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': `default-src 'none'; script-src 'self' ${artifactOrigin}; style-src 'self' ${artifactOrigin} 'unsafe-inline'; img-src 'self' ${artifactOrigin} data: blob:; font-src 'self' ${artifactOrigin} data:; connect-src 'none'; frame-ancestors ${shellOrigin}`
      }
    });
  }
});

console.info(`Artefatos de módulo servidos em http://${server.hostname}:${server.port}/modules`);

