import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../src/lib/pwaBootRepair.inline.js', import.meta.url), 'utf8')
  .replaceAll('__CONSUBOV_BUILD_TIMESTAMP__', '1793370000000')
  .replaceAll('__CONSUBOV_APP_VERSION__', '2.0.0');
const REMOTE = '1793374000000', OLD = '1793370000000';
const ORIGIN = 'https://app.consubov.com.br';

function emitter() {
  const map = new Map();
  return {
    addEventListener(type, fn) { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); },
    removeEventListener(type, fn) { map.get(type)?.delete(fn); },
    fire(type, event = {}) { for (const fn of [...(map.get(type) ?? [])]) fn(event); },
  };
}
function setup(opts = {}) {
  const we = emitter(), de = emitter(), se = emitter(), re = emitter();
  const storage = new Map(opts.storage ?? []);
  const stats = { fetches: 0, registers: 0, reloads: 0, messages: [], timeoutMs: [] };
  const root = { appendChild(node) { node.parentNode=this; this.current=node; }, removeChild(node) { if (this.current===node) this.current=null; } };
  const remote = opts.remoteBuild ?? REMOTE;
  const newer = {
    scriptURL: (opts.wrongOrigin ? 'https://fake.example' : ORIGIN) + '/sw.js?v=' + remote,
    postMessage(msg) { stats.messages.push(msg.type); if (!opts.noActivate) queueMicrotask(() => { sw.controller=newer; reg.waiting=null; se.fire('controllerchange'); }); },
  };
  const old = { scriptURL: ORIGIN + '/sw.js?v=' + OLD };
  const reg = { ...re, waiting:opts.noWaiting ? null : newer, installing:null, active:old, async update(){} };
  const sw = { ...se, controller:old, async register(){ stats.registers++; return reg; } };
  const nav = { onLine:!opts.offline, serviceWorker:sw };
  const loc = { hostname:opts.host??'app.consubov.com.br', origin:ORIGIN, href:ORIGIN+'/app', reload(){ stats.reloads++; } };
  const doc = { ...de, body:root, documentElement:root, visibilityState:'visible', createElement(){ return { style:{}, setAttribute(){}, textContent:'', parentNode:null }; } };
  const pending = new Map(); let timerSeq=0;
  function setTimer(fn, ms) { const key=++timerSeq;pending.set(key,{fn,ms});stats.timeoutMs.push(ms);return key; }
  function clearTimer(key) { pending.delete(key); }
  const sessionStorage = { getItem(k){ if(opts.blockedStorage)throw Error('blocked');return storage.get(k)??null; }, setItem(k,v){if(opts.blockedStorage)throw Error('blocked');storage.set(k,v);} };
  const fetch = async()=>{stats.fetches++;if(opts.networkError)throw Error('offline');return {ok:!opts.badStatus,async json(){return {version:remote,appVersion:opts.appVersion??'2.0.0'};}}};
  const w={...we};
  runInNewContext(source, {window:w,document:doc,navigator:nav,location:loc,sessionStorage,fetch,URL,Promise,Date,console,setTimeout:setTimer,clearTimeout:clearTimer}, {timeout:2000});
  return {api:w.__consubovBootRepair,w,nav,reg,sw,stats,storage,doc,runTimer(ms){ for(const [id,t] of [...pending])if(t.ms===ms){pending.delete(id);t.fn();}},asset(url=ORIGIN+'/assets/index-CWof2W_g.js'){we.fire('error',{target:{tagName:'SCRIPT',src:url}})},async settle(){for(let i=0;i<14;i++)await new Promise(r=>setImmediate(r));}};
}

test('healthy app does not request update or change local data',async()=>{const x=setup();x.api.markStarted();await x.settle();assert.equal(x.stats.fetches,0);assert.equal(x.stats.reloads,0);assert.equal(x.storage.size,0);});
test('entrypoint 404 installs verified SW and reloads once',async()=>{const x=setup();x.asset();await x.settle();assert.equal(x.stats.fetches,1);assert.equal(x.stats.registers,1);assert.deepEqual(x.stats.messages,['SKIP_WAITING']);assert.equal(x.stats.reloads,1);assert.equal(x.storage.get('consubov:pwa-recovery-attempt'),REMOTE);});
test('same published build never loops twice',async()=>{const x=setup({storage:[['consubov:pwa-recovery-attempt',REMOTE]]});x.asset();await x.settle();assert.equal(x.stats.reloads,0);assert.equal(x.stats.messages.length,0);});
test('offline failure retries transparently when connection returns',async()=>{const x=setup({offline:true});x.asset();await x.settle();assert.equal(x.stats.reloads,0);assert.equal(x.stats.registers,0);x.nav.onLine=true;x.w.fire('online');await x.settle();assert.equal(x.stats.reloads,1);});
test('older app version and same build are not applied',async()=>{const a=setup({appVersion:'1.155.0'});a.asset();await a.settle();assert.equal(a.stats.registers,0);const b=setup({remoteBuild:OLD});b.asset();await b.settle();assert.equal(b.stats.registers,0);});
test('rejects SW from another origin',async()=>{const x=setup({wrongOrigin:true});x.asset();await x.settle();assert.equal(x.stats.messages.length,0);assert.equal(x.stats.reloads,0);});
test('critical operation must drain before SW activation',async()=>{const x=setup();let critical=true, drained;x.api.setGuards({isCritical:()=>critical,whenIdle(cb){drained=cb;return()=>{};},whenAuthIdle(cb){cb();}});x.api.recover();await x.settle();assert.equal(x.stats.fetches,0);critical=false;drained();await x.settle();assert.equal(x.stats.reloads,1);});
test('installation failure cannot skipWaiting or reload blindly',async()=>{const x=setup({noWaiting:true});x.asset();await x.settle();assert.equal(x.stats.reloads,0);x.runTimer(18000);await x.settle();assert.equal(x.stats.reloads,0);});
test('failed requests and unavailable sessionStorage keep local state',async()=>{const a=setup({networkError:true});a.asset();await a.settle();assert.equal(a.stats.reloads,0);const b=setup({blockedStorage:true});b.asset();await b.settle();assert.equal(b.stats.reloads,0);assert.doesNotMatch(source,/caches\.delete|indexedDB\.deleteDatabase|localStorage\.clear|registration\.unregister/);});
test('extension and other-origin asset events are ignored',async()=>{const x=setup();x.asset('chrome-extension://abc/a.js');x.asset('https://cdn.example.com/assets/a.12345678.js');await x.settle();assert.equal(x.stats.fetches,0);});
test('public site bypasses app recovery',()=>{const x=setup({host:'consubov.com.br'});assert.equal(x.api,undefined);});
test('after app started, only explicit dynamic chunk errors trigger recovery',async()=>{const x=setup();x.api.markStarted();x.asset();await x.settle();assert.equal(x.stats.fetches,0);x.api.recover();await x.settle();assert.equal(x.stats.reloads,1);});
test('build injection is configured and main has no destructive cache purge',()=>{const main=readFileSync(new URL('../../src/main.tsx',import.meta.url),'utf8'),html=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),config=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');assert.match(html,/CONSUBOV_BOOT_REPAIR_INLINE/);assert.match(config,/data-consubov-boot-repair/);assert.doesNotMatch(main,/caches\.delete\(/);assert.match(main,/__consubovBootRepair\?\.markStarted\(\)/);});
test('an HTTP failure cannot trigger an unsafe SW update',async()=>{const x=setup({badStatus:true});x.asset();await x.settle();assert.equal(x.stats.registers,0);assert.equal(x.stats.reloads,0);});
test('watchdog recognizes a blank initial shell without requiring DevTools',async()=>{const x=setup();x.doc.fire('DOMContentLoaded');x.runTimer(15000);await x.settle();assert.equal(x.stats.reloads,1);});
test('no controllerchange means no reload until the verified worker controls the page',async()=>{const x=setup({noActivate:true});x.asset();await x.settle();assert.equal(x.stats.reloads,0);x.runTimer(18000);await x.settle();assert.equal(x.stats.reloads,0);});
test('auth renewal is respected and a newly started critical operation defers reload',async()=>{
  const x=setup();let critical=false, authIdle, drained;
  x.api.setGuards({isCritical:()=>critical,whenIdle(cb){drained=cb;return()=>{};},whenAuthIdle(cb){authIdle=cb;}});
  x.asset();await x.settle();assert.equal(x.stats.reloads,0);
  critical=true;authIdle();await x.settle();assert.equal(x.stats.reloads,0);
  critical=false;drained();await x.settle();assert.equal(x.stats.reloads,1);
});
