import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createSharedLiveTransport, trustedSharedOrigin, F23_SHARED_TEST_ORIGIN } from './sharedLiveTransport';
const ORIGIN='http://127.0.0.1:3333';
const USER={id:'550e8400-e29b-41d4-a716-446655440000',aud:'authenticated',role:'authenticated',
  email:'fixture@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};

describe('F23 production coexisting Supabase SDK, same backend read-only',()=>{
  it('only allows verified test deployment origin or localhost, never arbitrary Vercel hosts',()=>{
    expect(trustedSharedOrigin(F23_SHARED_TEST_ORIGIN)).toBe(F23_SHARED_TEST_ORIGIN);
    expect(trustedSharedOrigin('http://127.0.0.1:3333')).toBe('http://127.0.0.1:3333');
    expect(trustedSharedOrigin('https://app.consubov.com.br')).toBeNull();
    expect(trustedSharedOrigin('https://other.vercel.app')).toBeNull();
  });
  it('blocks direct production origin, writes and unreviewed APIs before fetch',async()=>{
    const remote=vi.fn(async()=>new Response('{}'));
    const fetcher=createSharedLiveTransport(ORIGIN,remote);
    await expect(fetcher('https://zptkqeiyvkqogrimbvna.supabase.co/rest/v1/fazendas')).rejects.toThrow('REMOTE_EGRESS_DENIED');
    for(const method of ['POST','PUT','PATCH','DELETE']){
      await expect(fetcher(ORIGIN+'/rest/v1/fazendas',{method})).rejects.toThrow('DOMAIN_WRITES_DISABLED');
    }
    await expect(fetcher(ORIGIN+'/auth/v1/recover',{method:'POST'})).rejects.toThrow('ENDPOINT_BLOCKED');
    await expect(fetcher(ORIGIN+'/rest/v1/rpc/alterar_estoque',{method:'POST'})).rejects.toThrow('ENDPOINT_BLOCKED');
    await expect(fetcher(ORIGIN+'/functions/v1/create-user',{method:'POST'})).rejects.toThrow('ENDPOINT_BLOCKED');
    expect(remote).not.toHaveBeenCalled();
  });
  it('scopes GET reads and auth through localhost, never forwarding api keys or cookies',async()=>{
    const remote=vi.fn(async()=>new Response('[{"id":"fixture"}]',{status:200}));
    const transport=createSharedLiveTransport(ORIGIN,remote);
    const result=await transport(ORIGIN+'/rest/v1/fazendas?select=id&limit=5',{
      headers:{authorization:'Bearer synthetic',apikey:'sb_secret_never_send',cookie:'secret',prefer:'count=exact'}
    });
    expect(result.status).toBe(200);
    const [url,init]=remote.mock.calls[0]! as unknown as [URL,RequestInit];
    expect(url.pathname).toBe('/api/v1/shared/rest/fazendas');
    expect(url.searchParams.get('limit')).toBe('5');
    const headers=new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer synthetic');
    expect(headers.get('prefer')).toBe('count=exact');
    expect(headers.has('apikey')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
    expect(init.credentials).toBe('omit');
  });
  it('uses the ORIGINAL SDK for existing-user login, refresh, user read, table SELECT and isolated logout',async()=>{
    const paths:string[]=[];
    const remote=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=new URL(String(input));paths.push(url.pathname);
      if(url.pathname==='/api/v1/shared/auth/token')return new Response(JSON.stringify({
        access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',
        token_type:'bearer',expires_in:3600,user:USER
      }),{status:200,headers:{'content-type':'application/json'}});
      if(url.pathname==='/api/v1/shared/auth/user')return new Response(JSON.stringify(USER),{status:200,headers:{'content-type':'application/json'}});
      if(url.pathname==='/api/v1/shared/auth/logout')return new Response(null,{status:204});
      if(url.pathname==='/api/v1/shared/rest/fazendas')return new Response('[{"id":"existing-fixture"}]',{
        status:200,headers:{'content-type':'application/json'}
      });
      return new Response('{"message":"test route unavailable"}',{status:404});
    });
    const client=createClient(ORIGIN,'local-f23-publishable-placeholder',{
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
      global:{fetch:createSharedLiveTransport(ORIGIN,remote)}
    });
    try{
      const signIn=await client.auth.signInWithPassword({email:USER.email,password:'fixture-only'});
      expect(signIn.error).toBeNull();
      expect(signIn.data.session?.user?.id).toBe(USER.id);
      expect((await client.auth.refreshSession()).error).toBeNull();
      expect((await client.auth.getUser()).data.user?.id).toBe(USER.id);
      const result=await client.from('fazendas').select('id');
      expect(result.error).toBeNull();
      expect(result.data).toEqual([{id:'existing-fixture'}]);
      expect((await client.auth.signOut()).error).toBeNull();
      expect(paths).toEqual(['/api/v1/shared/auth/token','/api/v1/shared/auth/token',
        '/api/v1/shared/auth/user','/api/v1/shared/rest/fazendas','/api/v1/shared/auth/logout']);
      expect(paths.every(p=>p.startsWith('/api/v1/shared/'))).toBe(true);
    }finally{client.auth.stopAutoRefresh();}
  });
});
