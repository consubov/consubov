import {describe,expect,test} from 'bun:test';
import entry from '../src/server/shared-entry';
const ROOT='https://consubov-f23-fazendas-teste-suporteagrodigital.vercel.app';
describe('F23 test-only serverless adapter refuses unknown hosts and disabled access',()=>{
  test('foreign Vercel, production or arbitrary host is denied before any upstream connection',async()=>{
    for(const site of ['https://app.consubov.com.br','https://evil.example','https://other.vercel.app']){
      const r=await entry.fetch(new Request(site+'/api/shared?path=rest/fazendas'));
      expect(r.status).toBe(403);
    }
  });
  test('disabled runtime cannot expose existing Supabase data',async()=>{
    const old=process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED;
    try{
      process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED='false';
      const r=await entry.fetch(new Request(ROOT+'/api/shared?path=rest/fazendas'));
      expect(r.status).toBe(503);
    }finally{
      if(old===undefined)delete process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED;
      else process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED=old;
    }
  });
  test('rejects path traversal and missing path before invoking backend',async()=>{
    const old=process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED;
    try{
      process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED='true';
      for(const p of ['', '../auth/user', 'rest/../../auth/user','/rest/fazendas']){
        const path=ROOT+'/api/shared'+(p?'?path='+encodeURIComponent(p):'');
        const r=await entry.fetch(new Request(path));
        expect(r.status).toBe(404);
      }
    }finally{
      if(old===undefined)delete process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED;
      else process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED=old;
    }
  });
});
