const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../qa/check-pwa-build.mjs');
const mock=()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pwa-build-'));
  fs.mkdirSync(path.join(dir,'assets'));
  fs.writeFileSync(path.join(dir,'assets','app.12345678.js'),'code');
  fs.writeFileSync(path.join(dir,'assets','lazy.12345678.js'),'lazy');
  fs.writeFileSync(path.join(dir,'index.html'),'<script src="/assets/app.12345678.js"></script>');
  fs.writeFileSync(path.join(dir,'version.json'),JSON.stringify({version:'build1'}));
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({id:'/',scope:'/',start_url:'/',display:'standalone'}));
  fs.writeFileSync(path.join(dir,'sw.js'),"const BUILD_VERSION = 'build1';\nconst PRECACHE_ASSETS = [\"/assets/app.12345678.js\",\"/assets/lazy.12345678.js\"];");
  return dir;
};
function check(change=()=>{}){
  const dir=mock();try{change(dir);return spawnSync(process.execPath,[script],{encoding:'utf8',env:{...process.env,PWA_BUILD_DIR:dir}})}finally{fs.rmSync(dir,{force:true,recursive:true})}
}
test('fully precached build is statically valid',()=>assert.equal(check().status,0));
test('omitted lazy chunk fails',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'sw.js'),"const BUILD_VERSION = 'build1';\nconst PRECACHE_ASSETS = [\"/assets/app.12345678.js\"];")).status,0));
test('missing offline asset fails',()=>assert.notEqual(check(dir=>fs.rmSync(path.join(dir,'assets','lazy.12345678.js'))).status,0));
test('manifest identity change fails',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({id:'/new',scope:'/',start_url:'/',display:'standalone'}))).status,0));
test('unexpanded placeholder fails',()=>assert.notEqual(check(dir=>fs.appendFileSync(path.join(dir,'sw.js'),'__PRECACHE_ASSETS__')).status,0));
test('wrong version manifest fails',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'version.json'),JSON.stringify({version:'wrong'}))).status,0));

test('JSON null manifest must not approve an unidentifiable PWA',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'manifest.json'),'null')).status,0));
test('JSON null version must not approve an unversioned shell',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'version.json'),'null')).status,0));
test('empty HTML must fail instead of skipping the entrypoint check',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'index.html'),'')).status,0));
test('empty service worker must fail instead of skipping validation',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'sw.js'),'')).status,0));
test('version appearing only in a comment is not the installed worker version',()=>assert.notEqual(check(dir=>fs.writeFileSync(path.join(dir,'sw.js'),"const BUILD_VERSION = 'different';\n// build1 appears as 'build1' only here\nconst PRECACHE_ASSETS = [\"/assets/app.12345678.js\",\"/assets/lazy.12345678.js\"];" )).status,0));
