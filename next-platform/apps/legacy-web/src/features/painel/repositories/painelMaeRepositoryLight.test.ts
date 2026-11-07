import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { fetchPainelMaeFallback } from "./painelMaeRepository";

const farm = "farm-a", retreat = "ret-a";
const prod = {
  id: "prod", peso_saco_kg: 25, amarelo_buffer_g: 2,
  consumo_recria1: 0.08, consumo_recria2: 0.07, consumo_engorda: 0.05,
  margem_mais_recria1_pct: 10, margem_mais_recria2_pct: 10, margem_mais_engorda_pct: 10,
  margem_menos_recria1_pct: 10, margem_menos_recria2_pct: 10, margem_menos_engorda_pct: 10,
};
const responses: Record<string, { data: unknown[] | {id: string} | null; error: {code?: string} | null; status: number }> = {
  fazendas: { data: { id: farm }, error: null, status: 200 },
  view_consumo_tempo_real: { data: [{
    id: "a", fazenda_id: farm, retiro_id: retreat, pasto_id: "past",
    mes_referencia: 10, ano_referencia: 2026, num_animais: 10, num_sacos: 2,
    dias_no_pasto: 4, consumo_g_cab_dia: 155, indice_consumo: 0.9,
    peso_medio_kg: 300, created_at: "2026-10-20T10:00:00Z",
  }], error: null, status: 200 },
  view_lancamento_consumo_real: { data: [{
    lancamento_id: "a", fazenda_id: farm, retiro_id: retreat, pasto_id: "past",
    mes_referencia: 10, ano_referencia: 2026, ocupacao_id: "occ",
    kg_fornecido: 50, cab_dias_assumidos: 40,
  }], error: null, status: 200 },
  view_consumo_consolidado: {
    data: [{ id: "a", consumo_g_cab_dia: 155, dias_no_pasto: 4 }],
    error: null, status: 200,
  },
  retiros: {
    data: [{ id: retreat, fazenda_id: farm, produto_id: "prod", peso_saco_kg: 25 }],
    error: null, status: 200,
  },
  pastos: {
    data: [{ id: "past", retiro_id: retreat, ativo: true, num_animais: 10,
      peso_medio_kg: 300, sexo: "Fêmea", produto_id: null }],
    error: null, status: 200,
  },
  ocupacoes_pasto: {
    data: [{ id: "occ", pasto_id: "past", retiro_id: retreat, produto_id: "prod" }],
    error: null, status: 200,
  },
  produtos: { data: [prod], error: null, status: 200 },
};
function query(table: string) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(async () => responses[table]),
    maybeSingle: vi.fn(async () => responses[table]),
    then: (resolve: (r: unknown) => unknown) => Promise.resolve(responses[table]).then(resolve),
  };
  return q;
}
describe("light repository uses only authorized views and scoped metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(query);
    mocks.rpc.mockImplementation(() => { throw new Error("unexpected costly RPC"); });
    for (const r of Object.values(responses)) { r.error = null; r.status = 200; }
    responses.fazendas.data = { id: farm };
  });
  it("returns verified metrics without nested costly view or RPC", async () => {
    const result = await fetchPainelMaeFallback({ fazendaId: farm, retiroId: null, mes: 10, ano: 2026 });
    expect(result).toEqual({
      consumo_real_g_cab_dia: 1250,
      consumo_global_g_cab_dia: 1250,
      eficiencia: 90,
      pastos_na_meta_num: 1, pastos_na_meta_den: 1,
      peso_medio_kg: 300,
    });
    const tables = mocks.from.mock.calls.map(([t]) => t);
    expect(tables).toContain("view_consumo_tempo_real");
    expect(tables).toContain("view_lancamento_consumo_real");
    expect(tables).not.toContain("view_painel_mae_pasto");
    expect(tables).not.toContain("lancamentos");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not mistake an unauthorized farm for an empty month", async () => {
    responses.fazendas.data = null;
    await expect(fetchPainelMaeFallback({ fazendaId: farm, retiroId: null, mes: 10, ano: 2026 }))
      .rejects.toBeInstanceOf(DataReadFailure);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    responses.fazendas.data = { id: farm };
  });
  it("fails closed on a view permission rejection without querying products", async () => {
    responses.view_consumo_tempo_real.error = { code: "42501" };
    responses.view_consumo_tempo_real.status = 403;
    await expect(fetchPainelMaeFallback({ fazendaId: farm, retiroId: null, mes: 10, ano: 2026 }))
      .rejects.toBeInstanceOf(DataReadFailure);
    const tables = mocks.from.mock.calls.map(([t]) => t);
    expect(tables).not.toContain("produtos");
    expect(tables).not.toContain("ocupacoes_pasto");
  });
});
