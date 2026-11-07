/** F23 TEST DOMAIN ONLY. Web-standard Node/Vercel function.
 * This exposes the existing Supabase through the read-only, per-user gateway;
 * it never forwards service_role or accepts unreviewed writes.
 */
import {handleSharedLiveRequest,SHARED_F23_TEST_ORIGIN,loadSharedLiveConfig}
  from '../../../../api/src/integrations/legacy-v2061/shared-live-readonly';

export default {
  async fetch(request:Request):Promise<Response>{
    const url=new URL(request.url);
    // Do not serve this proxy from unrelated Vercel URLs or production host.
    if(url.origin!==SHARED_F23_TEST_ORIGIN)return Response.json({error:'F23_TEST_ORIGIN_REQUIRED'},{status:403});
    if(process.env.CONSUBOV_SHARED_LIVE_READONLY_ENABLED!=='true')
      return Response.json({error:'F23_SHARED_GATEWAY_DISABLED'},{status:503});
    const suffix=url.searchParams.get('path');
    if(!suffix||suffix.length>512||!/^([a-z][a-z0-9_-]*\/)*[a-zA-Z0-9_./-]+$/.test(suffix)||
        suffix.split('/').some(p=>!p||p==='..'||p==='.'))
      return Response.json({error:'INVALID_PROXY_PATH'},{status:404});
    const routed=new URL('/api/v1/shared/'+suffix,url);
    url.searchParams.delete('path');
    routed.search=url.search;
    const newRequest=new Request(routed,request);
    const config=loadSharedLiveConfig();
    return handleSharedLiveRequest(newRequest,config);
  }
};
