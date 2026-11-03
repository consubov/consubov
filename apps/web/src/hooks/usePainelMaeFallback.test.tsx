import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  fetchPainelMae: vi.fn(),
  fetchPainelMaeFallback: vi.fn(),
}));
vi.mock("@/features/painel/repositories/painelMaeRepository", () => rpc);

import { usePainelMae } from "./usePainelMae";

const params = ["farm-a", null, 10, 2026] as const;
const data = {
  consumo_real_g_cab_dia: 54,
  consumo_global_g_cab_dia: 62,
  eficiencia: 89,
  pastos_na_meta_num: 3,
  pastos_na_meta_den: 7,
  peso_medio_kg: 380,
};

describe("usePainelMae fallback and scope", () => {
  beforeEach(() => vi.resetAllMocks());

  it("recovers canonical metrics after an unavailable RPC", async () => {
    rpc.fetchPainelMae.mockResolvedValue({ data: null, error: { code: "57014" } });
    rpc.fetchPainelMaeFallback.mockResolvedValue(data);
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.painelMae).toEqual(data);
    expect(rpc.fetchPainelMaeFallback).toHaveBeenCalledWith({
      fazendaId: "farm-a", retiroId: null, mes: 10, ano: 2026,
    });
  });

  it("never retries a denied RPC via alternative views", async () => {
    rpc.fetchPainelMae.mockResolvedValue({ data: null, error: { code: "42501" } });
    const { result } = renderHook(() => usePainelMae(...params));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/sess\u00e3o/i);
    expect(rpc.fetchPainelMaeFallback).not.toHaveBeenCalled();
  });

  it("does not publish late previous-farm responses", async () => {
    let finishOld!: (value: unknown) => void;
    rpc.fetchPainelMae.mockImplementation(({ fazendaId }: { fazendaId: string }) =>
      fazendaId === "farm-a"
        ? new Promise(resolve => { finishOld = resolve; })
        : Promise.resolve({ data: [data], error: null }),
    );
    const { result, rerender } = renderHook(
      ({ farm }) => usePainelMae(farm, null, 10, 2026),
      { initialProps: { farm: "farm-a" } },
    );
    rerender({ farm: "farm-b" });
    await waitFor(() => expect(result.current.painelMae).toEqual(data));
    await act(async () => {
      finishOld({ data: [{ ...data, consumo_real_g_cab_dia: 999 }], error: null });
    });
    expect(result.current.painelMae.consumo_real_g_cab_dia).toBe(54);
  });
});
