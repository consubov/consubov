/** Validate the built PWA shell for offline readiness without remote services. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = process.env.PWA_BUILD_DIR || path.join(root, 'apps/web/dist');
function fail(message) { console.error('[pwa:build] FAIL', message); process.exitCode = 1; }
function read(name) { try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch { fail('Missing file: ' + name); return null; } }
function json(name) { const s=read(name); if(!s)return null; try{return JSON.parse(s)}catch {fail('Invalid JSON: '+name);return null;} }
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
  if (version && !sw.includes('v-' + version.version)) {
    if (!sw.includes("'" + version.version + "'")) fail('SW version differs from version.json');
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
