/** F23 dual-runtime transport: production AUTH + scoped READ ONLY via Bun API.
 * Never access production Supabase URL or keys in the preview browser.
 * All domain mutations, unknown RPCs, Edge functions and signed URL creation
 * are intentionally denied until F12/RLS review and separate approval.
 */
import { localReadOnlyOrigin } from './readonlyTransport';
export const F23_SHARED_TEST_ORIGIN='https://consubov-f23-fazendas-teste-suporteagrodigital.vercel.app';
export function trustedSharedOrigin(raw:string|undefined):string|null {
  if(!raw)return null;
  return localReadOnlyOrigin(raw)??(raw===F23_SHARED_TEST_ORIGIN?raw:null);
}
const ALLOWED_HEADERS = ['authorization','content-type','accept','prefer','range','range-unit','accept-profile'];
function route(url:URL):string|null {
  let m=/^\/auth\/v1\/(token|user|logout)$/.exec(url.pathname);
  if(m)return '/api/v1/shared/auth/'+m[1];
  m=/^\/rest\/v1\/([a-z][a-z0-9_]*)$/.exec(url.pathname);
  if(m)return '/api/v1/shared/rest/'+m[1];
  m=/^\/storage\/v1\/object\/(public\/)?([a-z][a-z0-9-]*)\/(.+)$/.exec(url.pathname);
  if(m&&/^[a-zA-Z0-9_./-]{1,420}$/.test(m[3]!)&&
    !m[3]!.split('/').some(p=>!p||p==='.'||p==='..')) {
    return '/api/v1/shared/storage/object/'+(m[1]??'')+m[2]+'/'+m[3];
  }
  return null;
}
export function createSharedLiveTransport(
  localOrigin:string,
  fetcher:(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>=fetch
):typeof fetch {
  if(trustedSharedOrigin(localOrigin)!==localOrigin) throw new Error('SHARED_LIVE_ORIGIN_MUST_BE_LOCAL');
  return async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
    const original=input instanceof Request?input:new Request(input,init);
    const url=new URL(original.url);
    if(url.origin!==localOrigin)throw new Error('SHARED_LIVE_REMOTE_EGRESS_DENIED');
    const path=route(url);
    if(!path)throw new Error('SHARED_LIVE_ENDPOINT_BLOCKED');
    const method=(init?.method??original.method).toUpperCase();
    const auth=path.startsWith('/api/v1/shared/auth/');
    if(!auth&&!['GET','HEAD'].includes(method))throw new Error('SHARED_LIVE_DOMAIN_WRITES_DISABLED');
    if(auth){
      if(path.endsWith('/user')&&method!=='GET')throw new Error('SHARED_LIVE_AUTH_MUTATION_DENIED');
      if(!path.endsWith('/user')&&method!=='POST')throw new Error('SHARED_LIVE_AUTH_METHOD_DENIED');
    }
    const originalHeaders=new Headers(original.headers);
    if(init?.headers)new Headers(init.headers).forEach((value,key)=>originalHeaders.set(key,value));
    const headers=new Headers();
    for(const name of ALLOWED_HEADERS){const value=originalHeaders.get(name);if(value)headers.set(name,value);}
    const proxy=new URL(path+url.search,localOrigin);
    return fetcher(proxy,{method,headers,redirect:'error',credentials:'omit',
      ...(!['GET','HEAD'].includes(method)?{body:init?.body??(input instanceof Request?input.body:original.body)}:{})
    });
  };
}
