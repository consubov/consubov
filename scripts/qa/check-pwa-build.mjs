/** Validate the built PWA shell for offline readiness without remote services. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = process.env.PWA_BUILD_DIR || path.join(root, 'apps/web/dist');
function fail(message) { console.error('[pwa:build] FAIL', message); process.exitCode = 1; }
function read(name) {
  try {
    const value = fs.readFileSync(path.join(dir, name), 'utf8');
    if (!value.trim()) { fail('Empty file: ' + name); return null; }
    return value;
  } catch { fail('Missing file: ' + name); return null; }
}
function json(name) {
  const source = read(name);
  if (source === null) return null;
  try {
    const value = JSON.parse(source);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      fail('Expected JSON object: ' + name);
      return null;
    }
    return value;
  } catch { fail('Invalid JSON: ' + name); return null; }
}
const sw = read('sw.js');
const index = read('index.html');
const manifest = json('manifest.json');
const version = json('version.json');
if (manifest && !(manifest.id === '/' && manifest.scope === '/' && manifest.start_url === '/' && manifest.display === 'standalone')) {
  fail('PWA identity changed; installed app must be replaced in place');
}
if (version && (typeof version.version !== 'string' || !version.version.trim())) fail('Missing build version');
if (sw) {
  if (sw.includes('__BUILD_TIMESTAMP__') || sw.includes('__PRECACHE_ASSETS__')) fail('SW build placeholders not injected');
  // Match the emitted declaration, not a coincidental string in a comment.
  const declarations = [...sw.matchAll(/^const BUILD_VERSION\s*=\s*(['"])([^'"\r\n]+)\1;/gm)];
  if (declarations.length !== 1 || (version && declarations[0][2] !== version.version)) {
    fail('SW build declaration missing, ambiguous or different from version.json');
  }
  const match = sw.match(/const PRECACHE_ASSETS\s*=\s*(\[[^;]+\]);/);
  if (!match) fail('Missing injected precache manifest');
  else {
    let precache;
    try { precache = JSON.parse(match[1]); } catch { fail('Invalid precache manifest'); }
    if (Array.isArray(precache)) {
      if (!precache.some(item => typeof item === 'string' && item.endsWith('.js'))) fail('Precache missing JS');
      if (new Set(precache).size !== precache.length) fail('Duplicate precache entries');
      const allowed = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|gif|wasm)$/i;
      for (const item of precache) {
        if (typeof item !== 'string' || !item.startsWith('/assets/') || !allowed.test(item) || item.includes('..')) {
          fail('Unsafe precache entry'); continue;
        }
        if (!fs.existsSync(path.join(dir, item.slice(1)))) fail('Missing referenced asset: '+item);
      }
      const listFiles = (folder, rel='') => {
        if (!fs.existsSync(folder)) return [];
        return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry => {
          const next=rel?rel+'/'+entry.name:entry.name;
          return entry.isDirectory()?listFiles(path.join(folder,entry.name),next):(entry.isFile()&&allowed.test(next)?['/assets/'+next]:[]);
        });
      };
      const expected=listFiles(path.join(dir,'assets'));
      for (const asset of expected) if(!precache.includes(asset)) fail('Build asset omitted from offline precache: '+asset);
      if (index && !precache.some(asset => asset.endsWith('.js') && index.includes(asset))) fail('HTML entrypoint not precached');
      console.log('[pwa:build]',JSON.stringify({precacheAssets:precache.length,builtAssets:expected.length}));
    }
  }
}
if (!process.exitCode) console.log('[pwa:build] PASS: static build integrity; browser upgrade and offline migration NOT proven');
