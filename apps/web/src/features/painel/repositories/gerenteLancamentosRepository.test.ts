import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock }));
import { fetchGerenteLancamentos } from "./gerenteLancamentosRepository";

const f = "00000000-0000-4000-8000-000000000001";
const p = { fazendaId:f,mes:10,ano:2026 };
const good = {
  id:"l1",retiro_id:"r1",pasto_id:"p1",fazenda_id:f, num_sacos:2,
  num_animais:100,peso_medio_kg:"290",categoria:"Engorda",sexo:"M",
  origem:null,dias_no_pasto:4,created_at:"2026-10-15T12:00:00Z",
  mes_referencia:10,ano_referencia:2026,consumo_g_cab_dia:"125",
  status_consumo:"Ideal",indice_consumo:"1.0",
};
function response(data:unknown,error:unknown=null,status=200) {
  mock.rpc.mockReturnValue({abortSignal:(signal:AbortSignal) => {
    expect(signal).toBeInstanceOf(AbortSignal);
    return Promise.resolve({data,error,status});
  }});
}
describe("manager scoped monthly snapshot boundary",()=>{
  beforeEach(()=>vi.resetAllMocks());
  it("uses one fast RPC and preserves numeric/source fields",async()=>{
    response([good]);
    expect(await fetchGerenteLancamentos(p)).toEqual([{...good,
      peso_medio_kg:290,consumo_g_cab_dia:125,indice_consumo:1}]);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("get_gerente_lancamentos_rapido",{
      p_fazenda_id:f,p_mes:10,p_ano:2026,
    });
  });
  it.each(["57014","PGRST202"])("never falls back to heavy view on %s",async code=>{
    response(null,{code},code==="PGRST202"?404:500);
    await expect(fetchGerenteLancamentos(p)).rejects.toMatchObject({kind:"unavailable"});
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it("denies unauthorized roles without alternate request",async()=>{
    response(null,{code:"42501"},403);
    await expect(fetchGerenteLancamentos(p)).rejects.toMatchObject({kind:"permission"});
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects another farm even if server sends a record",async()=>{
    response([{...good,fazenda_id:"other"}]);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
  });
  it("rejects past-month data rather than showing stale values",async()=>{
    response([{...good,mes_referencia:9}]);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
  });
  it("rejects missing/partial row and duplicate IDs",async()=>{
    response([{id:"l1",fazenda_id:f}]);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
    response([good,good]);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
  });
  it("accepts truly empty result without manufacturing zero rows",async()=>{
    response([]);
    expect(await fetchGerenteLancamentos(p)).toEqual([]);
  });
  it("rejects nonnumeric values and malformed array",async()=>{
    response([{...good,num_sacos:"NaN"}]);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
    response(null);
    await expect(fetchGerenteLancamentos(p)).rejects.toBeInstanceOf(DataReadFailure);
  });
});
