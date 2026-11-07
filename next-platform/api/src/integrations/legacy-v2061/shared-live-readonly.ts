/** Parallel F23/production access. Only Auth session lifecycle and user-RLS reads.
 * No service role, no domain mutations, no cross-project fallback, loopback only.
 */
import { z } from 'zod';
import { COMPAT_READ_TABLES } from '../compat/compat-allowlists';
import { LIVE_RLS_ENABLED_TABLES } from './live-rls-snapshot';
import { authorizeNoRlsRead } from './no-rls-scopes';
export interface SharedLiveConfig {
  enabled:boolean; supabaseUrl?:string; publishableKey?:string;
  allowedOrigin:string; expectedProjectRef:string;
  fetcher?:(url:URL,init:RequestInit)=>Promise<Response>;
}
export function loadSharedLiveConfig():SharedLiveConfig { return {
  enabled:process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED==='true',
  supabaseUrl:process.env.CONSUBOV_READ_ONLY_SUPABASE_URL,
  publishableKey:process.env.CONSUBOV_READ_ONLY_SUPABASE_PUBLISHABLE_KEY,
  allowedOrigin:process.env.CONSUBOV_READ_ONLY_ALLOWED_ORIGIN||'http://127.0.0.1:8188',
  expectedProjectRef:'zptkqeiyvkqogrimbvna'
}; }
export const SHARED_F23_TEST_ORIGIN='https://consubov-f23-fazendas-teste-suporteagrodigital.vercel.app';
const safeToken=/^Bearer [A-Za-z0-9._~-]{16,16380}$/;
const safeObject=/^[a-zA-Z0-9_./-]{1,420}$/;
const publicBuckets=new Set(['landing','mapas','relatorios','logos-consultor','fotos-salga']);
const privateBuckets=new Set(['fotos-salga','despesas-consultor-fotos','relatorios','mapas']);
const passSchema=z.object({email:z.string().email().max(254),password:z.string().min(1).max(512)}).passthrough();
const refreshSchema=z.object({refresh_token:z.string().min(16).max(4096)}).passthrough();
const verifiedUser=z.object({id:z.string().uuid()});
type Route={kind:'auth';name:'token'|'user'|'logout'}|{kind:'rest';name:string}|{kind:'storage';path:string;public:boolean};
export function sharedLiveTableAllowed(name:string):boolean {
  return COMPAT_READ_TABLES.has(name)&&LIVE_RLS_ENABLED_TABLES.has(name);
}
function target(config:SharedLiveConfig):URL|null {
  if(!config.enabled||!config.publishableKey||!/^sb_publishable_[\w-]+$/.test(config.publishableKey)||
     !/^[a-z0-9]{20}$/.test(config.expectedProjectRef)||
     !(/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(config.allowedOrigin)||
       config.allowedOrigin===SHARED_F23_TEST_ORIGIN)) return null;
  try {const u=new URL(config.supabaseUrl||'');
    if(u.protocol!=='https:'||u.hostname!==config.expectedProjectRef+'.supabase.co'||
       u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)return null;
    return u;
  }catch{return null;}
}
function classify(path:string):Route|null {
  let m=/^\/api\/v1\/shared\/auth\/(token|user|logout)$/.exec(path);
  if(m)return {kind:'auth',name:m[1] as 'token'|'user'|'logout'};
  m=/^\/api\/v1\/shared\/rest\/([a-z][a-z0-9_]*)$/.exec(path);
  if(m)return {kind:'rest',name:m[1]!};
  m=/^\/api\/v1\/shared\/storage\/object\/(public\/)?([a-z][a-z0-9-]*)\/(.+)$/.exec(path);
  if(!m)return null;
  const isPublic=Boolean(m[1]);const bucket=m[2]!,object=m[3]!;
  if(!(isPublic?publicBuckets:privateBuckets).has(bucket)||!safeObject.test(object)||
      object.split('/').some(x=>!x||x==='.'||x==='..'))return null;
  return {kind:'storage',public:isPublic,path:'/storage/v1/object/'+(isPublic?'public/':'')+bucket+'/'+object};
}
function headers(type:string,origin:string|null,allowed:string):Headers {
  const h=new Headers({'content-type':type,'cache-control':'no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  if(origin){h.set('access-control-allow-origin',origin);h.set('vary','Origin');}
  return h;
}
function denied(code:number,message:string,origin:string|null,allowed:string):Response {
  return new Response(JSON.stringify({error:message}),{status:code,headers:headers('application/json',origin,allowed)});
}
async function consume(req:Request,limit:number):Promise<Uint8Array|null>{
  if(Number(req.headers.get('content-length'))>limit)return null;
  if(!req.body)return new Uint8Array();
  const reader=req.body.getReader();let size=0;const parts:Uint8Array[]=[];
  for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;
    if(size>limit){await reader.cancel();return null;}parts.push(x.value);}
  const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.length;}
  return out;
}
async function completed(response:Response,kind:Route['kind'],method:string,origin:string|null,allowed:string):Promise<Response>{
  const cap=kind==='storage'?12_000_000:2_000_000;
  if(Number(response.headers.get('content-length'))>cap)return denied(502,'RESPONSE_TOO_LARGE',origin,allowed);
  const bytes=method==='HEAD'?new Uint8Array():new Uint8Array(await response.arrayBuffer());
  if(bytes.length>cap)return denied(502,'RESPONSE_TOO_LARGE',origin,allowed);
  const h=headers(response.headers.get('content-type')||(kind==='storage'?'application/octet-stream':'application/json'),origin,allowed);
  for(const name of ['content-range','range-unit','etag','x-request-id']){const v=response.headers.get(name);if(v)h.set(name,v);}
  return new Response(method==='HEAD'||[204,205,304].includes(response.status)?null:bytes,{status:response.status,headers:h});
}

export async function handleSharedLiveRequest(req:Request,config:SharedLiveConfig=loadSharedLiveConfig()):Promise<Response>{
  const origin=req.headers.get('origin');
  // VS Code forwards may use localhost or 127.0.0.1 on the same fixed port.
  const secondOrigin=config.allowedOrigin.replace('127.0.0.1','localhost');
  const firstOrigin=config.allowedOrigin.replace('localhost','127.0.0.1');
  if(origin && origin!==config.allowedOrigin && origin!==secondOrigin && origin!==firstOrigin)
    return denied(403,'ORIGIN_DENIED',null,config.allowedOrigin);
  const url=new URL(req.url);const route=classify(url.pathname);
  if(!route)return denied(404,'ENDPOINT_NOT_ALLOWED',origin,config.allowedOrigin);
  const method=req.method.toUpperCase();
  if(method==='OPTIONS')return new Response(null,{status:204,headers:{
    'access-control-allow-origin':origin||config.allowedOrigin,
    'access-control-allow-methods':'GET,HEAD,POST,OPTIONS',
    'access-control-allow-headers':'Authorization,Content-Type,Accept,Prefer,Range,Range-Unit',
    'vary':'Origin','cache-control':'no-store'
  }});
  if(route.kind==='auth'){
    if(route.name==='user'&&method!=='GET')return denied(405,'AUTH_METHOD_DENIED',origin,config.allowedOrigin);
    if(route.name!=='user'&&method!=='POST')return denied(405,'AUTH_METHOD_DENIED',origin,config.allowedOrigin);
  }else if(method!=='GET'&&method!=='HEAD')return denied(405,'READ_ONLY',origin,config.allowedOrigin);
  if(route.kind==='rest'&&!COMPAT_READ_TABLES.has(route.name))return denied(403,'TABLE_NOT_APPROVED',origin,config.allowedOrigin);
  if(route.kind==='rest' && /[()!:]/.test(url.searchParams.get('select')??''))
    return denied(403,'EMBEDDED_RELATIONS_NOT_AUTHORIZED',origin,config.allowedOrigin);
  if(url.search.length>4096||url.searchParams.size>32)return denied(400,'QUERY_TOO_LARGE',origin,config.allowedOrigin);
  if(route.kind==='rest'){
    const raw=url.searchParams.get('limit');
    if(raw!==null&&(!/^\d{1,3}$/.test(raw)||Number(raw)>250))return denied(400,'INVALID_LIMIT',origin,config.allowedOrigin);
    if(raw===null)url.searchParams.set('limit',sharedLiveTableAllowed(route.name)?'250':'100');
  }
  const root=target(config);
  if(!root)return denied(503,'SHARED_LIVE_NOT_CONFIGURED',origin,config.allowedOrigin);
  const token=req.headers.get('authorization');
  const login=route.kind==='auth'&&route.name==='token';
  const publicRead=route.kind==='storage'&&route.public;
  if(!login&&!publicRead&&(!token||!safeToken.test(token)))return denied(401,'USER_JWT_REQUIRED',origin,config.allowedOrigin);
  const upstreamPath=route.kind==='auth'?'/auth/v1/'+route.name:route.kind==='rest'?'/rest/v1/'+route.name:route.path;
  const upstream=new URL(upstreamPath+(route.kind==='auth'&&route.name==='logout'?'?scope=local':url.search),root);
  const h=new Headers({apikey:config.publishableKey!,accept:req.headers.get('accept')||'application/json'});
  if(token&&!login)h.set('authorization',token);
  if(route.kind==='rest'){
    const prefer=req.headers.get('prefer');
    if(prefer&&!/^count=(exact|planned|estimated)$/.test(prefer))return denied(400,'PREFER_DENIED',origin,config.allowedOrigin);
    if(prefer)h.set('prefer',prefer);
    for(const name of ['range','range-unit']){
      const v=req.headers.get(name);if(v&&v.length<=90)h.set(name,v);
    }
    const profile=req.headers.get('accept-profile');
    if(profile&&profile!=='public')return denied(403,'SCHEMA_NOT_ALLOWED',origin,config.allowedOrigin);
  }
  let body:Uint8Array|undefined;
  if(login){
    const grant=url.searchParams.get('grant_type');
    if(grant!=='password'&&grant!=='refresh_token')return denied(403,'AUTH_GRANT_DENIED',origin,config.allowedOrigin);
    let input:unknown;
    try{const bytes=await consume(req,8192);if(!bytes)return denied(413,'BODY_TOO_LARGE',origin,config.allowedOrigin);
      body=bytes;input=JSON.parse(new TextDecoder().decode(bytes));}
    catch{return denied(400,'INVALID_AUTH_BODY',origin,config.allowedOrigin);}
    if(!(grant==='password'?passSchema:refreshSchema).safeParse(input).success)return denied(400,'INVALID_AUTH_BODY',origin,config.allowedOrigin);
    h.set('content-type','application/json');
  }
  if(route.kind==='auth'&&route.name==='logout'){
    h.set('content-type','application/json');body=new Uint8Array();
  }
  const fetcher=config.fetcher??fetch;
  const init:RequestInit={method,headers:h,redirect:'error',signal:AbortSignal.timeout(10000),
    ...(body?{body:new Blob([body.slice().buffer as ArrayBuffer])}:{})};
  try{
    if(route.kind==='rest'||(route.kind==='storage'&&!route.public)){
      const check=await fetcher(new URL('/auth/v1/user',root),{
        method:'GET',headers:{apikey:config.publishableKey!,authorization:token!},
        redirect:'error',signal:AbortSignal.timeout(8000)
      });
      if(!check.ok)return denied(401,'AUTH_NOT_VERIFIED',origin,config.allowedOrigin);
      const found=verifiedUser.safeParse(await check.json());
      if(!found.success)return denied(401,'INVALID_AUTH_IDENTITY',origin,config.allowedOrigin);
      if(route.kind==='rest'&&!sharedLiveTableAllowed(route.name)){
        // The PostgREST table has RLS DISABLED, so it is never safe to forward
        // the raw client query. Verify server-side role/farm/retreat authority.
        if(req.headers.has('range')||req.headers.has('range-unit'))
          return denied(403,'NO_RLS_RANGE_DENIED',origin,config.allowedOrigin);
        const scope=await authorizeNoRlsRead(route.name,url.searchParams,{
          root,token:token!,publishableKey:config.publishableKey!,userId:found.data.id,fetcher
        });
        if(scope.ok===false)return denied(scope.status,scope.reason,origin,config.allowedOrigin);
        upstream.search=scope.filter.toString();
      }
    }
    const result=await fetcher(upstream,init);
    return completed(result,route.kind,method,origin,config.allowedOrigin);
  }catch{return denied(502,'UPSTREAM_UNAVAILABLE',origin,config.allowedOrigin);}
}
