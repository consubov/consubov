const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/platform/adapters/IndexedDbLocalDatabase.ts'), 'utf8');
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const modExports = {};
vm.runInNewContext('(function(exports){'+code+'\n})', { structuredClone, Blob })(modExports);
const {IndexedDbLocalDatabase,NEXT_LOCAL_DB_NAME} = modExports;

function fakeFactory() {
  const states = new Map();
  let opened=0, lastDbName;
  const factory = {
    open(name,version) {
      opened++;lastDbName=name;
      const newDb = !states.has(name);
      if(newDb) states.set(name, {stores:new Map()});
      const state=states.get(name);
      const db={version, onversionchange:null, objectStoreNames:{contains(store){return state.stores.has(store)}},
        createObjectStore(store){state.stores.set(store,new Map());},close(){},
        transaction(store,mode){
          const entries=state.stores.get(store);
          const tx={oncomplete:null,onabort:null,onerror:null,error:null, objectStore(){return {
            keyPath: 'id', autoIncrement: false,
            get(key){return request(()=>entries.get(key))},
            put(value){return request(()=>{entries.set(value.id,structuredClone(value));return value.id})},
            delete(key){return request(()=>entries.delete(key))},
          }}};
          function request(action){const req={onsuccess:null,onerror:null,result:undefined,error:null};queueMicrotask(()=>{
            try{req.result=action();req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());}
            catch(e){req.error=e;tx.error=e;req.onerror?.();tx.onerror?.();}
          });return req;}
          return tx;
        }
      };
      const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      queueMicrotask(()=>{if(newDb)req.onupgradeneeded?.();req.onsuccess?.()});
      return req;
    },
    info(){return {opened,lastDbName,names:[...states.keys()]}}
  };return factory;
}
const ownerA={tenantId:'tenant-a',userId:'user-a'};
test('stores and retrieves scoped data after transaction completion',async()=>{
  const db=new IndexedDbLocalDatabase(ownerA,fakeFactory());
  await db.set('key',{value:42});assert.equal((await db.get('key')).value,42);
  await db.close();
});
test('two users and tenants cannot read each others scoped keys',async()=>{
  const f=fakeFactory();const a=new IndexedDbLocalDatabase(ownerA,f);
  const b=new IndexedDbLocalDatabase({tenantId:'tenant-a',userId:'user-b'},f);
  const c=new IndexedDbLocalDatabase({tenantId:'tenant-b',userId:'user-a'},f);
  await a.set('pending',{secret:'only-a'});
  assert.equal(await b.get('pending'),undefined);assert.equal(await c.get('pending'),undefined);
  await b.set('pending','only-b');await a.delete('pending');
  assert.equal(await b.get('pending'),'only-b');
});
test('key tuples do not collide with delimiters in owner identifiers',async()=>{
  const f=fakeFactory();const a=new IndexedDbLocalDatabase({tenantId:'a|b',userId:'c'},f);
  const b=new IndexedDbLocalDatabase({tenantId:'a',userId:'b|c'},f);
  await a.set('same',1);await b.set('same',2);
  assert.equal(await a.get('same'),1);assert.equal(await b.get('same'),2);
});
test('adapter never opens a legacy database',async()=>{
  const f=fakeFactory();const a=new IndexedDbLocalDatabase(ownerA,f);await a.set('x',1);
  assert.equal(f.info().lastDbName,NEXT_LOCAL_DB_NAME);
  assert.deepEqual(f.info().names,[NEXT_LOCAL_DB_NAME]);
});
test('errors loudly when storage unavailable rather than claiming data saved',async()=>{
  const a=new IndexedDbLocalDatabase(ownerA,undefined);
  await assert.rejects(()=>a.set('x',1));
});
test('rejects missing owner and undefined values',async()=>{
  assert.throws(()=>new IndexedDbLocalDatabase({tenantId:'',userId:'user-a'},fakeFactory()));
  const a=new IndexedDbLocalDatabase(ownerA,fakeFactory());await assert.rejects(()=>a.set('x',undefined));
});
test('structured-clone Blob is preserved during read/write',async()=>{
  const a=new IndexedDbLocalDatabase(ownerA,fakeFactory());
  await a.set('image',new Blob(['image-bytes'],{type:'image/jpeg'}));
  const image=await a.get('image');
  assert.equal(await image.text(),'image-bytes');assert.equal(image.type,'image/jpeg');
});
