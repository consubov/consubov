import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const rpc = vi.hoisted(() => ({
  fetchPainelMae: vi.fn(),
  fetchPainelMaeRapido: vi.fn(),
  fetchPainelMaeFallback: vi.fn(),
}));
vi.mock("@/features/painel/repositories/painelMaeRepository", () => rpc);
import { usePainelMae } from "./usePainelMae";

const params = ["farm-a", null, 10, 2026] as const;
const data = {
  consumo_real_g_cab_dia: 54, consumo_global_g_cab_dia: 62,
  eficiencia: 89, pastos_na_meta_num: 3, pastos_na_meta_den: 7, peso_medio_kg: 380,
};
describe("usePainelMae uses lightweight secured data before timeout-prone RPC", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rpc.fetchPainelMaeRapido.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    rpc.fetchPainelMaeFallback.mockResolvedValue(data);
  });
  it("uses the fast authenticated RPC without touching timeout-prone views", async () => {
    const actual = { consumo_real_g_cab_dia: "116.58", consumo_global_g_cab_dia: "111.62",
      eficiencia: "39.9", pastos_na_meta_num: 16, pastos_na_meta_den: 108, peso_medio_kg: "282.0" };
    rpc.fetchPainelMaeRapido.mockResolvedValue({ data: [actual], error: null });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.painelMae).toEqual({
      consumo_real_g_cab_dia: 116.58, consumo_global_g_cab_dia: 111.62,
      eficiencia: 39.9, pastos_na_meta_num: 16, pastos_na_meta_den: 108,
      peso_medio_kg: 282,
    });
    expect(result.current.error).toBeNull();
    expect(rpc.fetchPainelMaeFallback).not.toHaveBeenCalled();
    expect(rpc.fetchPainelMae).not.toHaveBeenCalled();
  });
  it("rejects a fast RPC permission denial without secondary reads", async () => {
    rpc.fetchPainelMaeRapido.mockResolvedValue({ data: null, error: { code: "42501" } });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(rpc.fetchPainelMaeFallback).not.toHaveBeenCalled();
    expect(rpc.fetchPainelMae).not.toHaveBeenCalled();
  });
  it("does not overload the database after a fast SQL timeout", async () => {
    rpc.fetchPainelMaeRapido.mockResolvedValue({ data: null, error: { code: "57014" } });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(rpc.fetchPainelMaeFallback).not.toHaveBeenCalled();
    expect(rpc.fetchPainelMae).not.toHaveBeenCalled();
  });
  it("prioritizes lightweight source to avoid the expensive nested view", async () => {
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.painelMae).toEqual(data);
    expect(rpc.fetchPainelMae).not.toHaveBeenCalled();
    expect(rpc.fetchPainelMaeFallback).toHaveBeenCalledWith({
      fazendaId: "farm-a", retiroId: null, mes: 10, ano: 2026,
    });
  });
  it("does not bypass an access denial with the older RPC", async () => {
    rpc.fetchPainelMaeFallback.mockRejectedValue(new DataReadFailure("permission"));
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/sessão/i);
    expect(rpc.fetchPainelMae).not.toHaveBeenCalled();
  });
  it("recovers with legacy RPC when a non-permission source is unavailable", async () => {
    rpc.fetchPainelMaeFallback.mockRejectedValue(new DataReadFailure("unavailable"));
    rpc.fetchPainelMae.mockResolvedValue({ data: [data], error: null });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.painelMae).toEqual(data);
    expect(rpc.fetchPainelMae).toHaveBeenCalledTimes(1);
  });
  it("does not manufacture zeros when both sources fail", async () => {
    rpc.fetchPainelMaeFallback.mockRejectedValue(new DataReadFailure("unavailable"));
    rpc.fetchPainelMae.mockResolvedValue({ data: null, error: { code: "57014" } });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
  it("does not publish late response from the previously selected farm", async () => {
    let finishOld!: (value: unknown) => void;
    rpc.fetchPainelMaeFallback.mockImplementation(({ fazendaId }: { fazendaId: string }) =>
      fazendaId === "farm-a"
        ? new Promise(resolve => { finishOld = resolve; })
        : Promise.resolve(data),
    );
    const { result, rerender } = renderHook(
      ({ farm }) => usePainelMae(farm, null, 10, 2026),
      { initialProps: { farm: "farm-a" } },
    );
    // Let the missing-RPC compatibility check resolve before changing farms.
    await waitFor(() => expect(rpc.fetchPainelMaeFallback).toHaveBeenCalledWith({
      fazendaId: "farm-a", retiroId: null, mes: 10, ano: 2026,
    }));
    rerender({ farm: "farm-b" });
    await waitFor(() => expect(result.current.painelMae).toEqual(data));
    await act(async () => { finishOld({ ...data, consumo_real_g_cab_dia: 999 }); });
    expect(result.current.painelMae.consumo_real_g_cab_dia).toBe(54);
  });
});
