import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeMapaCoordinates, useMapaData } from "./useMapaData";

type QueryResult = { data: unknown; error: unknown; status?: number };
type Filters = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  query: vi.fn<(table: string, mode: "one" | "many", filters: Filters) => Promise<QueryResult>>(),
  rpc: vi.fn<(name: string, params: Filters) => unknown>(),
}));

vi.mock("@/hooks/useRealtimeSync", () => ({ useRealtimeSync: () => undefined }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, params: Filters) => {
      mocks.rpc(name, params);
      const query = {
        abortSignal: (_signal: AbortSignal) => query,
        then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => never) =>
          mocks.query(name === "get_painel_pasto_mensal_rapido"
            ? "view_painel_mae_pasto" : name, "many", {
            retiro_id: params.p_retiro_id,
            mes_referencia: params.p_mes,
            ano_referencia: params.p_ano,
          }).then(resolve, reject),
      };
      return query;
    },
    from: (table: string) => {
      const filters: Filters = {};
      let mode: "one" | "many" = "many";
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return query;
        },
        in: (field: string, value: unknown) => {
          filters[field] = value;
          return query;
        },
        gte: (field: string, value: unknown) => {
          filters[`${field}_gte`] = value;
          return query;
        },
        lt: (field: string, value: unknown) => {
          filters[`${field}_lt`] = value;
          return query;
        },
        or: () => query,
        order: () => query,
        limit: () => query,
        range: () => query,
        maybeSingle: () => { mode = "one"; return query; },
        abortSignal: (_signal: AbortSignal) => query,
        then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => never) =>
          mocks.query(table, mode, filters).then(resolve, reject),
      };
      return query;
    },
  },
}));

const farmImage = "https://example.supabase.co/storage/v1/object/public/mapas/farm/map.png";
const mapRow = { id: "map-1", fazenda_id: "farm-1", imagem_url: farmImage };

beforeEach(() => {
  mocks.query.mockReset();
  mocks.rpc.mockClear();
  mocks.query.mockImplementation(async (table, mode) => {
    if (table === "mapas" && mode === "one") return { data: mapRow, error: null };
    return { data: [], error: null };
  });
});

describe("useMapaData: access, completeness and read errors", () => {
  it("accepts a successful map response beyond the previous 6.5 second cutoff", async () => {
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        await new Promise(resolve => setTimeout(resolve, 6900));
        return { data: mapRow, error: null, status: 200 };
      }
      return { data: [], error: null };
    });
    const { result, unmount } = renderHook(() =>
      useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage), {
      timeout: 10500,
    });
    expect(result.current.error).toBeNull();
    expect(mocks.query.mock.calls.filter(([table]) => table === "mapas")).toHaveLength(1);
    unmount();
  }, 14500);

  it("retries one transient timeout from the map endpoint automatically", async () => {
    let mapReads = 0;
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        mapReads++;
        return mapReads === 1
          ? { data: null, error: { code: "57014" }, status: 500 }
          : { data: mapRow, error: null, status: 200 };
      }
      return { data: [], error: null };
    });
    const { result } = renderHook(() =>
      useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    expect(mapReads).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("keeps only the previous verified photo on a temporary same-user failure", async () => {
    let mapReads = 0;
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        mapReads++;
        return mapReads === 1
          ? { data: mapRow, error: null, status: 200 }
          : { data: null, error: { code: "57014" }, status: 500 };
      }
      return { data: [], error: null };
    });
    const { result } = renderHook(() =>
      useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.warning).toMatch(/imagem já carregada/));
    expect(result.current.error).toBeNull();
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    expect(result.current.mapa?.pastos).toEqual([]);
    expect(mapReads).toBe(3);
  });

  it("never retries or retains a photo when access is denied, including after a 503", async () => {
    let mapReads = 0;
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        mapReads++;
        if (mapReads === 1) return { data: mapRow, error: null, status: 200 };
        if (mapReads === 2) return { data: null, error: { code: "PGRST000" }, status: 503 };
        return { data: null, error: { code: "42501" }, status: 403 };
      }
      return { data: [], error: null };
    });
    const { result } = renderHook(() =>
      useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.error).toMatch(/Não foi possível/));
    expect(result.current.mapa).toBeNull();
    expect(result.current.warning).toBeNull();
    expect(mapReads).toBe(3);
  });

  it("shows the authorized image before a slow geometry query completes", async () => {
    let finishGeometry!: (value: QueryResult) => void;
    const slowGeometry = new Promise<QueryResult>(resolve => { finishGeometry = resolve; });
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return slowGeometry;
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData(undefined, 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    expect(result.current.loading).toBe(false);
    expect(result.current.detailsLoading).toBe(true);
    expect(mocks.query).not.toHaveBeenCalledWith("retiros", expect.anything(), expect.anything());
    await act(async () => {
      finishGeometry({ data: [], error: null });
    });
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
  });

  it("never blocks the verified polygon on a slow optional consumption view", async () => {
    let resolveView!: (value: QueryResult) => void;
    const slowView = new Promise<QueryResult>(resolve => { resolveView = resolve; });
    mocks.query.mockImplementation(async (table) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [
        { id: "poly-1", pasto_id: "p-1", coordenadas: [[0, 0], [20, 0], [20, 20]], cor: "green" },
      ], error: null };
      if (table === "pastos") return { data: [{
        id: "p-1", nome: "Pasto Teste", num_animais: 14, peso_medio_kg: 230,
        categoria: "Recria", sexo: "M", data_fim_carencia: null,
        label_offset_x: 0, label_offset_y: 0, label_rotation: 0,
      }], error: null };
      if (table === "view_painel_mae_pasto") return slowView;
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.num_animais).toBe(14));
    expect(result.current.loading).toBe(false);
    expect(result.current.indicatorsLoading).toBe(true);
    expect(result.current.mapa?.pastos[0]?.consumo_medio).toBeNull();
    resolveView({ data: null, error: { code: "57014" } });
    await waitFor(() => expect(result.current.indicatorsLoading).toBe(false));
    expect(result.current.warning).toMatch(/indicadores/);
    expect(result.current.mapa?.pastos[0].num_animais).toBe(14);
  });

  it("never shows map data from the previous signed-in user during an account switch", async () => {
    let releaseOtherAccount!: (value: QueryResult) => void;
    const second = new Promise<QueryResult>(resolve => { releaseOtherAccount = resolve; });
    let mapReads = 0;
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        mapReads++;
        return mapReads === 1 ? { data: mapRow, error: null } : second;
      }
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ user }: { user: string }) => useMapaData(undefined, 11, 2026, "retiro-1", user),
      { initialProps: { user: "capataz-A" } },
    );
    await waitFor(() => expect(result.current.mapa?.id).toBe("map-1"));
    rerender({ user: "capataz-B" });
    expect(result.current.mapa).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => { releaseOtherAccount({ data: null, error: null }); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mapa).toBeNull();
  });

  const pasture = {
    id: "p-1", nome: "Pasto Teste", num_animais: 17, peso_medio_kg: 230,
    categoria: "Recria", sexo: "M", data_fim_carencia: null,
    label_offset_x: 0, label_offset_y: 0, label_rotation: 0,
  };

  const polygon = {
    id: "poly-1", pasto_id: "p-1", coordenadas: [[20, 20], [30, 20], [30, 30]],
    cor: "green",
  };

  it("keeps authorized polygons and icons when the optional lines query returns HTTP 500", async () => {
    const seen: string[] = [];
    mocks.query.mockImplementation(async (table) => {
      seen.push(table);
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "linhas_mapa") return { data: null, error: { code: "57014" }, status: 500 };
      if (table === "elementos_mapa") return {
        data: [{ id: "icon-1", tipo: "arvore", emoji: "tree", posicao_x: 10, posicao_y: 10, rotulo: null }],
        error: null,
      };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.mapa?.pastos).toHaveLength(1);
    expect(result.current.mapa?.pastos[0].num_animais).toBe(17);
    expect(result.current.mapa?.linhas).toEqual([]);
    expect(result.current.mapa?.elementos).toHaveLength(1);
    expect(result.current.warning).toMatch(/Algumas linhas ou marcações/);
    expect(result.current.error).toBeNull();
    expect(seen.indexOf("pastos_mapa")).toBeLessThan(seen.indexOf("pastos"));
    expect(seen.indexOf("pastos")).toBeLessThan(seen.indexOf("linhas_mapa"));
    expect(seen).not.toContain("view_painel_mae_pasto_atual");
  });

  it("keeps confirmed polygons and lines when optional map icons time out", async () => {
    mocks.query.mockImplementation(async (table) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "linhas_mapa") return {
        data: [{ id: "line-1", coordenadas: [[1, 1], [2, 2]], cor: "#000", tipo: "cerca", rotulo: null }],
        error: null,
      };
      if (table === "elementos_mapa") return {
        data: null, error: { code: "PGRST001" }, status: 503,
      };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.mapa?.pastos).toHaveLength(1);
    expect(result.current.mapa?.linhas).toHaveLength(1);
    expect(result.current.mapa?.elementos).toEqual([]);
    expect(result.current.warning).toMatch(/Algumas linhas ou marcações/);
  });

  it("shows polygons before slow optional lines or map icons finish", async () => {
    let finishLines!: (v: QueryResult) => void;
    const pendingLines = new Promise<QueryResult>(resolve => { finishLines = resolve; });
    mocks.query.mockImplementation(async (table) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "linhas_mapa") return pendingLines;
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.pastos).toHaveLength(1));
    expect(result.current.detailsLoading).toBe(true);
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    await act(async () => { finishLines({ data: [], error: null }); });
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("does not expose polygons when an optional drawing request is forbidden", async () => {
    mocks.query.mockImplementation(async (table) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "linhas_mapa") return { data: null, error: { code: "42501" }, status: 403 };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    expect(result.current.mapa?.pastos).toEqual([]);
    expect(result.current.warning).toMatch(/Não foi possível atualizar os desenhos/);
    expect(result.current.warning).not.toMatch(/Algumas linhas ou marcações/);
  });

  it("keeps only the image when the essential polygon endpoint is unavailable", async () => {
    mocks.query.mockImplementation(async (table) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: null, error: { code: "57014" }, status: 500 };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    expect(result.current.mapa?.pastos).toEqual([]);
    expect(result.current.warning).toMatch(/Não foi possível atualizar os desenhos/);
    expect(mocks.query.mock.calls.some(([table]) => table === "linhas_mapa")).toBe(false);
    expect(mocks.query.mock.calls.some(([table]) => table === "pastos")).toBe(false);
  });

  it("updates month-specific consumption and visits without refetching the image or geometry", async () => {
    mocks.query.mockImplementation(async (table, _mode, filters) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "view_painel_mae_pasto") return { data: [{
        pasto_id: "p-1", consumo_global_g_cab_dia: filters.mes_referencia === 10 ? 100 : 200,
        status_global: filters.mes_referencia === 10 ? "Baixo" : "Ideal",
      }], error: null };
      if (table === "lancamentos") return { data: [{
        pasto_id: "p-1", cocho_cheio: false, num_sacos: filters.mes_referencia === 10 ? 2 : 5,
        data_salga_informada: `2026-${String(filters.mes_referencia).padStart(2, "0")}-12`,
        created_at: "2026-11-12T15:00:00Z",
      }], error: null };
      if (table === "movimentacoes_animais") return { data: [], error: null };
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ month }: { month: number }) => useMapaData("farm-1", month, 2026, "retiro-1", "capataz-A"),
      { initialProps: { month: 10 } },
    );
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(100));
    expect(result.current.mapa?.pastos[0]?.ultima_salga).toBe("2026-10-12");
    const mapReads = mocks.query.mock.calls.filter(([t]) => t === "mapas").length;
    const geometryReads = mocks.query.mock.calls.filter(([t]) => t === "pastos_mapa").length;
    rerender({ month: 11 });
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    // Old month must not be displayed while the next month is pending.
    expect(result.current.mapa?.pastos[0]?.consumo_medio).toBeNull();
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(200));
    expect(result.current.mapa?.pastos[0]?.status_consumo).toBe("Ideal");
    expect(result.current.mapa?.pastos[0]?.ultima_salga).toBe("2026-11-12");
    expect(result.current.mapa?.pastos[0]?.num_animais).toBe(17);
    expect(mocks.query.mock.calls.filter(([t]) => t === "mapas")).toHaveLength(mapReads);
    expect(mocks.query.mock.calls.filter(([t]) => t === "pastos_mapa")).toHaveLength(geometryReads);
    expect(mocks.query).toHaveBeenCalledWith("view_painel_mae_pasto", "many",
      expect.objectContaining({ retiro_id: "retiro-1", mes_referencia: 11, ano_referencia: 2026 }));
    expect(mocks.rpc).toHaveBeenCalledWith("get_painel_pasto_mensal_rapido",
      { p_retiro_id: "retiro-1", p_mes: 11, p_ano: 2026 });
    expect(mocks.query).toHaveBeenCalledWith("lancamentos", "many",
      expect.objectContaining({ mes_referencia: 11, ano_referencia: 2026 }));
    expect(mocks.query).toHaveBeenCalledWith("movimentacoes_animais", "many",
      expect.objectContaining({ data_gte: "2026-11-01", data_lt: "2026-12-01" }));
  });

  it("respects the selected year and clears indicators for a month without records", async () => {
    mocks.query.mockImplementation(async (table, _mode, filters) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "view_painel_mae_pasto" && filters.ano_referencia === 2026)
        return { data: [{ pasto_id: "p-1", consumo_global_g_cab_dia: 170, status_global: "Ideal" }], error: null };
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ month, year }: { month: number; year: number }) =>
        useMapaData("farm-1", month, year, "retiro-1", "capataz-A"),
      { initialProps: { month: 12, year: 2026 } },
    );
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(170));
    rerender({ month: 1, year: 2027 });
    await waitFor(() => expect(result.current.indicatorsLoading).toBe(false));
    expect(result.current.mapa?.pastos[0]?.consumo_medio).toBeNull();
    expect(result.current.mapa?.pastos[0]?.status_consumo).toBeNull();
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    expect(mocks.query).toHaveBeenCalledWith("movimentacoes_animais", "many",
      expect.objectContaining({ data_gte: "2027-01-01", data_lt: "2027-02-01" }));
  });

  it("ignores a late previous-month result after switching periods rapidly", async () => {
    let resolveOld!: (response: QueryResult) => void;
    const oldView = new Promise<QueryResult>(resolve => { resolveOld = resolve; });
    mocks.query.mockImplementation(async (table, _mode, filters) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "view_painel_mae_pasto") {
        if (filters.mes_referencia === 10) return oldView;
        return { data: [{ pasto_id: "p-1", consumo_global_g_cab_dia: 280, status_global: "Alto" }], error: null };
      }
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ month }: { month: number }) => useMapaData("farm-1", month, 2026, "retiro-1", "capataz-A"),
      { initialProps: { month: 10 } },
    );
    await waitFor(() => expect(result.current.indicatorsLoading).toBe(true));
    rerender({ month: 11 });
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(280));
    await act(async () => {
      resolveOld({ data: [{ pasto_id: "p-1", consumo_global_g_cab_dia: 90, status_global: "Baixo" }], error: null });
    });
    expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(280);
    expect(result.current.mapa?.pastos[0]?.status_consumo).toBe("Alto");
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
  });

  it("removes old-month status instead of inventing a value when monthly consumption fails", async () => {
    mocks.query.mockImplementation(async (table, _mode, filters) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [polygon], error: null };
      if (table === "pastos") return { data: [pasture], error: null };
      if (table === "view_painel_mae_pasto") {
        return filters.mes_referencia === 10
          ? { data: [{ pasto_id: "p-1", consumo_global_g_cab_dia: 120, status_global: "Ideal" }], error: null }
          : { data: null, error: { code: "57014" } };
      }
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ month }: { month: number }) => useMapaData("farm-1", month, 2026, "retiro-1", "capataz-A"),
      { initialProps: { month: 10 } },
    );
    await waitFor(() => expect(result.current.mapa?.pastos[0]?.consumo_medio).toBe(120));
    rerender({ month: 11 });
    await waitFor(() => expect(result.current.indicatorsLoading).toBe(false));
    expect(result.current.mapa?.pastos[0]?.consumo_medio).toBeNull();
    expect(result.current.mapa?.pastos[0]?.status_consumo).toBeNull();
    expect(result.current.mapa?.pastos[0]?.num_animais).toBe(17);
    expect(result.current.warning).toMatch(/indicadores/);
  });

  it("never reports a denied map query as an empty map", async () => {
    mocks.query.mockImplementation(async () => ({ data: null, error: { code: "42501" } }));
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/Não foi possível carregar/);
    expect(result.current.mapa).toBeNull();
    expect(mocks.query.mock.calls.filter(([table]) => table === "mapas")).toHaveLength(1);
  });

  it("shows an empty state only for a confirmed map absence", async () => {
    mocks.query.mockImplementation(async () => ({ data: null, error: null }));
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.mapa).toBeNull();
  });

  it("shows loading during retry after a failed map read, then restores the image without waiting for details", async () => {
    let mapAttempts = 0;
    let finishRetry!: (value: QueryResult) => void;
    const pendingRetry = new Promise<QueryResult>(resolve => { finishRetry = resolve; });
    let finishGeometry!: (value: QueryResult) => void;
    const pendingGeometry = new Promise<QueryResult>(resolve => { finishGeometry = resolve; });
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        return ++mapAttempts === 1
          ? { data: null, error: { code: "42501" }, status: 403 }
          : pendingRetry;
      }
      if (table === "pastos_mapa") return pendingGeometry;
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.error).toMatch(/Não foi possível carregar/));
    expect(result.current.loading).toBe(false);
    await act(async () => { void result.current.refresh(); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.error).toBeNull();
    expect(result.current.mapa).toBeNull();
    await act(async () => { finishRetry({ data: mapRow, error: null }); });
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    expect(result.current.loading).toBe(false);
    expect(result.current.detailsLoading).toBe(true);
    await act(async () => { finishGeometry({ data: [], error: null }); });
    await waitFor(() => expect(result.current.detailsLoading).toBe(false));
  });

  it("does not show a false empty map during retry after a failed refresh", async () => {
    let attempts = 0;
    let completeRetry!: (value: QueryResult) => void;
    const waiting = new Promise<QueryResult>(resolve => { completeRetry = resolve; });
    mocks.query.mockImplementation(async (table, mode) => {
      if (table === "mapas" && mode === "one") {
        attempts += 1;
        if (attempts === 1) return { data: mapRow, error: null };
        if (attempts === 2) return { data: null, error: { code: "42501" }, status: 403 };
        return waiting;
      }
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1", "capataz-A"));
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    await act(async () => { await result.current.refresh(); });
    await waitFor(() => expect(result.current.error).toMatch(/Não foi possível carregar/));
    await act(async () => { void result.current.refresh(); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.mapa).toBeNull();
    expect(result.current.error).toBeNull();
    await act(async () => { completeRetry({ data: mapRow, error: null }); });
    await waitFor(() => expect(result.current.mapa?.imagem_url).toBe(farmImage));
    expect(result.current.loading).toBe(false);
  });

  it("returns the actual background even for a map with zero polygons and scopes by farm and retiro", async () => {
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.mapa?.imagem_url).toBe(farmImage);
    expect(result.current.mapa?.pastos).toEqual([]);
    expect(mocks.query).toHaveBeenCalledWith("mapas", "one", expect.objectContaining({
      retiro_id: "retiro-1", fazenda_id: "farm-1",
    }));
  });

  it("keeps confirmed livestock data and warns when only optional indicators fail", async () => {
    mocks.query.mockImplementation(async (table, mode, filters) => {
      if (table === "mapas") return { data: mapRow, error: null };
      if (table === "pastos_mapa") return { data: [
        { id: "poly-1", pasto_id: "p-1", coordenadas: [[20, 20], [30, 20], [30, 30]], cor: "green" },
      ], error: null };
      if (table === "pastos") {
        if (filters.retiro_id && !filters.id) return { data: [{ id: "p-1" }], error: null };
        return { data: [{
          id: "p-1", nome: "Pasto real", num_animais: 17, peso_medio_kg: 265,
          categoria: "Recria", sexo: "M", data_fim_carencia: null,
          label_offset_x: 0, label_offset_y: 0, label_rotation: 0,
        }], error: null };
      }
      if (table === "view_painel_mae_pasto") {
        return { data: null, error: { code: "57014" } };
      }
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useMapaData("farm-1", 11, 2026, "retiro-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.warning).toMatch(/indicadores/);
    expect(result.current.mapa?.pastos[0]).toMatchObject({
      pasto_nome: "Pasto real", num_animais: 17, consumo_medio: null,
    });
  });

  it("ignores late responses from a previous retiro", async () => {
    let answerOld!: (response: QueryResult) => void;
    const oldPromise = new Promise<QueryResult>((resolve) => { answerOld = resolve; });
    mocks.query.mockImplementation(async (table, mode, filters) => {
      if (table === "mapas" && mode === "one") {
        if (filters.retiro_id === "old-retiro") return oldPromise;
        return { data: { ...mapRow, id: "map-new" }, error: null };
      }
      return { data: [], error: null };
    });
    const { result, rerender } = renderHook(
      ({ retiro }: { retiro: string }) => useMapaData("farm-1", 11, 2026, retiro),
      { initialProps: { retiro: "old-retiro" } },
    );
    rerender({ retiro: "new-retiro" });
    await waitFor(() => expect(result.current.mapa?.id).toBe("map-new"));
    answerOld({ data: mapRow, error: null });
    await waitFor(() => expect(result.current.mapa?.id).toBe("map-new"));
  });

  it("does not remain loading when a retiro is missing", async () => {
    const { result } = renderHook(() => useMapaData(undefined, 11, 2026, undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.mapa).toBeNull();
  });

  it("drops malformed geometry instead of sending infinite or invalid coordinates to the viewer", () => {
    expect(normalizeMapaCoordinates([[1, 2], ["x", 3], [Infinity, 1], [4, 5]])).toEqual([
      [1, 2], [4, 5],
    ]);
  });
});
