/** Conservative application-level authorization for legacy tables with RLS OFF.
 * This does not fix database RLS. Only authenticated HTTP reads in a trusted
 * server may use this scope; never enable arbitrary browser PostgREST access.
 */
import {z} from 'zod';
import {COMPAT_READ_TABLES} from '../compat/compat-allowlists';

const id=z.string().uuid();
const idRows=z.array(z.object({id})).max(100);
const retiroRows=z.array(z.object({id,fazenda_id:id})).max(100);
const DIRECT_FARM=new Set([
  'ciclos','snapshots','lancamentos','ciclos_auditoria','abates',
  'movimentacoes_animais','transferencias_retiros','fabrica_destinos',
  'ocupacoes_pasto','gmd_config','abate_config'
]);
const CAPATAZ_RETIRO=new Set(['ciclos','lancamentos','abates','movimentacoes_animais',
  'fabrica_destinos','ocupacoes_pasto','gmd_config','abate_config']);

export type LegacyNoRlsScope = {ok:true;filter:URLSearchParams}|{ok:false;status:403|502;reason:string};
export interface ScopedLookup {
  root:URL; token:string; publishableKey:string; userId:string;
  fetcher:(url:URL,init:RequestInit)=>Promise<Response>;
}
export function allowedNoRlsTable(table:string):boolean {
  // A code-reviewed explicit allowlist, not arbitrary public.table access.
  return COMPAT_READ_TABLES.has(table);
}

export async function authorizeNoRlsRead(table:string, query:URLSearchParams, deps:ScopedLookup):Promise<LegacyNoRlsScope>{
  if(!allowedNoRlsTable(table))return {ok:false,status:403,reason:'TABLE_DENIED'};
  // PostgREST embeds and arbitrary boolean expressions can bypass naive
  // application-layer filtering; allow only flat table reads.
  if(query.has('or')||query.has('and')||query.has('not')||query.has('offset')||
     [...query.keys()].some(k=>k.includes('.or')||k.includes('.and')||k.includes('.not'))||
     /[()!:]/.test(query.get('select')??''))return {ok:false,status:403,reason:'COMPLEX_FILTER_DENIED'};
  const limit=query.get('limit');
  if(limit!==null&&Number(limit)>100)return {ok:false,status:403,reason:'LEGACY_READ_LIMIT'};
  const headers={apikey:deps.publishableKey,authorization:deps.token,accept:'application/json'};
  const get=async(path:string)=>{
    const resp=await deps.fetcher(new URL(path,deps.root),{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(7000)});
    if(!resp.ok)throw new Error('SCOPE_SOURCE_UNAVAILABLE');
    return resp.json() as Promise<unknown>;
  };
  try {
    const admin=await get('/rest/v1/administradores?select=id&user_id=eq.'+deps.userId+'&ativo=eq.true&limit=1');
    const adminRows=idRows.safeParse(admin);
    if(!adminRows.success)return {ok:false,status:502,reason:'AUTHORITY_MALFORMED'};
    const q=new URLSearchParams(query);
    q.set('limit',String(Math.min(limit===null?100:Number(limit),100)));
    if(adminRows.data.length>0)return {ok:true,filter:q};
    if(!DIRECT_FARM.has(table))return {ok:false,status:403,reason:'NON_FARM_TABLE_ADMIN_ONLY'};
    const manager=await get('/rest/v1/gerentes?select=id&user_id=eq.'+deps.userId+'&ativo=eq.true&limit=1');
    const office=await get('/rest/v1/escritorios?select=id&user_id=eq.'+deps.userId+'&ativo=eq.true&limit=1');
    if(!idRows.safeParse(manager).success||!idRows.safeParse(office).success)
      return {ok:false,status:502,reason:'ROLE_AUTHORITY_MALFORMED'};
    const canReadFarm=(manager as Array<unknown>).length>0||(office as Array<unknown>).length>0;
    if(canReadFarm){
      const farms=idRows.safeParse(await get('/rest/v1/fazendas?select=id&limit=100'));
      if(!farms.success)return {ok:false,status:502,reason:'FARM_AUTHORITY_MALFORMED'};
      if(!farms.data.length)return {ok:false,status:403,reason:'NO_AUTHORIZED_FARMS'};
      q.append('fazenda_id','in.('+farms.data.map(x=>x.id).join(',')+')');
      return {ok:true,filter:q};
    }
    if(!CAPATAZ_RETIRO.has(table))return {ok:false,status:403,reason:'CAPATAZ_SCOPE_UNSUPPORTED'};
    const cap=idRows.safeParse(await get('/rest/v1/capatazes?select=id&user_id=eq.'+deps.userId+'&ativo=eq.true&limit=1'));
    if(!cap.success)return {ok:false,status:502,reason:'ROLE_AUTHORITY_MALFORMED'};
    if(!cap.data.length)return {ok:false,status:403,reason:'NO_ACTIVE_ROLE'};
    const retiros=retiroRows.safeParse(await get('/rest/v1/retiros?select=id,fazenda_id&limit=100'));
    if(!retiros.success)return {ok:false,status:502,reason:'RETREAT_AUTHORITY_MALFORMED'};
    if(!retiros.data.length)return {ok:false,status:403,reason:'NO_AUTHORIZED_RETREATS'};
    q.append('fazenda_id','in.('+[...new Set(retiros.data.map(x=>x.fazenda_id))].join(',')+')');
    q.append('retiro_id','in.('+retiros.data.map(x=>x.id).join(',')+')');
    return {ok:true,filter:q};
  }catch{return {ok:false,status:502,reason:'AUTHORITY_UNAVAILABLE'};}
}
