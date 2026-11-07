import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import os from 'node:os';

const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_QA_MODULE ?? 'typescript');
const sourceDir = path.resolve(import.meta.dirname, '../..');
const source = fs.readFileSync(path.join(sourceDir, 'vite.config.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true } }).outputText;
function getPlugin(dir) {
  const mod = { exports: {} };
  const scopedRequire = (id)=>id==='vite' ? { defineConfig: (value)=>value } : id==='@vitejs/plugin-react-swc' ? (()=>({name:'test-react'})) : require(id);
  runInNewContext(js, {require:scopedRequire, module:mod,exports:mod.exports,__dirname:dir,console,Date,process}, {timeout:5000});
  const config=mod.exports.default();
  return config.plugins.find(x=>x.name==='inject-sw-build-timestamp');
}

test('build emits a self-contained inline watchdog, matching SW and version.json', async()=>{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'consubov-boot-'));
  try {
    for(const folder of ['dist','dist/assets','src/lib'])fs.mkdirSync(path.join(dir,folder),{recursive:true});
    fs.copyFileSync(path.join(sourceDir,'index.html'),path.join(dir,'dist/index.html'));
    fs.copyFileSync(path.join(sourceDir,'src/lib/pwaBootRepair.inline.js'),path.join(dir,'src/lib/pwaBootRepair.inline.js'));
    fs.writeFileSync(path.join(dir,'src/lib/appVersion.ts'),'export const APP_VERSION = "2.0.0";\n');
    fs.writeFileSync(path.join(dir,'dist/assets/index-CWof2W_g.js'),'console.log("test")');
    fs.writeFileSync(path.join(dir,'dist/assets/index-Ej123456.css'),'body {}');
    fs.writeFileSync(path.join(dir,'dist/sw.js'),"const BUILD='__BUILD_TIMESTAMP__';\nconst PRECACHE_ASSETS = '__PRECACHE_ASSETS__';\n");
    const plugin=getPlugin(dir);
    plugin.closeBundle();
    const html=fs.readFileSync(path.join(dir,'dist/index.html'),'utf8');
    const worker=fs.readFileSync(path.join(dir,'dist/sw.js'),'utf8');
    const version=JSON.parse(fs.readFileSync(path.join(dir,'dist/version.json'),'utf8'));
    assert.match(html,/<script data-consubov-boot-repair>/);
    assert.ok(html.indexOf('data-consubov-boot-repair')<html.indexOf('src="/src/main.tsx"'));
    assert.doesNotMatch(html,/__CONSUBOV_BUILD_TIMESTAMP__|__CONSUBOV_APP_VERSION__|CONSUBOV_BOOT_REPAIR_INLINE/);
    assert.equal(version.appVersion,'2.0.0');
    assert.ok(version.version.length>=12);
    assert.ok(html.includes('var LOCAL_BUILD = \''+version.version+'\''));
    assert.ok(worker.includes("/assets/index-CWof2W_g.js"));
    assert.ok(worker.includes("/assets/index-Ej123456.css"));
    assert.ok(worker.includes(version.version));
    assert.equal(html.includes('caches.delete('),false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
