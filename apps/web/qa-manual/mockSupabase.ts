export const state = {
  headers: [] as Record<string, unknown>[],
  items: [] as Record<string, unknown>[],
  sentHeaders: [] as Record<string, unknown>[],
  sentItems: [] as Record<string, unknown>[][],
  rollbackIds: [] as string[],
  failNext: false,
};
declare global {interface Window{__qaManual:typeof state}}
window.__qaManual=state;
export const supabase={
  from(table:string){
    if(table==="solicitacoes_lancamento_manual")return {
      select:()=>({eq:()=>({order:()=>({limit:async()=>({data:state.headers,error:null})})})}),
      insert:(row:Record<string,unknown>)=>{
        state.sentHeaders.push(row);
        const id="qa-sol-"+state.sentHeaders.length;
        state.headers.push({id,...row,created_at:new Date().toISOString()});
        return {select:()=>({single:async()=>({data:{id},error:null})})};
      },
      delete:()=>({eq:(_key:string,id:string)=>{
        state.rollbackIds.push(id);
        state.headers=state.headers.filter(h=>h.id!==id);
        return Promise.resolve({error:null});
      }}),
    };
    if(table==="solicitacoes_lancamento_itens")return{
      select:()=>({in:async()=>({data:state.items,error:null})}),
      insert:(rows:Record<string,unknown>[])=>{
        state.sentItems.push(rows);
        if(state.failNext){state.failNext=false;return Promise.resolve({error:{message:"Falha simulada"}});}
        state.items.push(...rows.map((it,i)=>({id:"qa-item-"+i,...it})));
        return Promise.resolve({error:null});
      },
    };
    throw Error("BLOCKED: "+table);
  }
};
