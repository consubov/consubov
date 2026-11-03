import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const rpc = vi.hoisted(() => ({
  fetchPainelMae: vi.fn(),
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
    rpc.fetchPainelMaeFallback.mockResolvedValue(data);
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
    rerender({ farm: "farm-b" });
    await waitFor(() => expect(result.current.painelMae).toEqual(data));
    await act(async () => { finishOld({ ...data, consumo_real_g_cab_dia: 999 }); });
    expect(result.current.painelMae.consumo_real_g_cab_dia).toBe(54);
  });
});
