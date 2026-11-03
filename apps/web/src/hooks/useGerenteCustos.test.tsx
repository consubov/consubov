import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataReadFailure } from "@/lib/dataReadGuard";

const mocked = vi.hoisted(() => ({ fetchGerenteCustos: vi.fn() }));
vi.mock("@/features/painel/repositories/gerenteCustosRepository", () => ({
  fetchGerenteCustos: mocked.fetchGerenteCustos,
}));
import { useGerenteCustos } from "./useGerenteCustos";

const a = "00000000-0000-4000-8000-000000000081";
const b = "00000000-0000-4000-8000-000000000082";
const costA = { retiro_id: "a", total_sacos: 94,
  total_cab_dias: 19250, custo_mensal: 7501.2, custo_diario: 0.3897 };
const costB = { retiro_id: "b", total_sacos: 151,
  total_cab_dias: 29808, custo_mensal: 12049.8, custo_diario: 0.4042 };

describe("manager-only monthly costs never mix farms or months", () => {
  beforeEach(() => vi.resetAllMocks());

  it("keeps confirmed costs only for the requested month", async () => {
    mocked.fetchGerenteCustos.mockResolvedValue([costA]);
    const { result } = renderHook(() => useGerenteCustos(a, 10, 2026));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([costA]);
    expect(mocked.fetchGerenteCustos).toHaveBeenCalledWith(expect.objectContaining({
      fazendaId: a, mes: 10, ano: 2026,
    }));
  });

  it("does not reuse previous user costs when the session changes on the same farm", async () => {
    mocked.fetchGerenteCustos.mockImplementationOnce(() => Promise.resolve([costA]))
      .mockImplementationOnce(() => Promise.resolve([costB]));
    const { result, rerender } = renderHook(
      ({ user }) => useGerenteCustos(a, 10, 2026, user),
      { initialProps: { user: "session-one" } },
    );
    await waitFor(() => expect(result.current.data).toEqual([costA]));
    rerender({ user: "session-two" });
    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.data).toEqual([costB]));
    expect(mocked.fetchGerenteCustos).toHaveBeenCalledTimes(2);
  });

  it("prevents a previous farm response from overriding the active farm", async () => {
    let releaseOld: ((value: unknown) => void) | undefined;
    mocked.fetchGerenteCustos.mockImplementation(({ fazendaId }: { fazendaId: string }) =>
      fazendaId === a ? new Promise(resolve => { releaseOld = resolve; }) : Promise.resolve([costB]));
    const { result, rerender } = renderHook(
      ({ farm }) => useGerenteCustos(farm, 10, 2026),
      { initialProps: { farm: a } },
    );
    rerender({ farm: b });
    await waitFor(() => expect(result.current.data).toEqual([costB]));
    await act(async () => { releaseOld?.([costA]); });
    expect(result.current.data).toEqual([costB]);
  });

  it("cancels an outdated month and never publishes late costs", async () => {
    let resolveOct: ((value: unknown) => void) | undefined;
    mocked.fetchGerenteCustos.mockImplementation(({ mes }: { mes: number }) =>
      mes === 10 ? new Promise(resolve => { resolveOct = resolve; }) : Promise.resolve([costB]));
    const { result, rerender } = renderHook(
      ({ month }) => useGerenteCustos(a, month, 2026),
      { initialProps: { month: 10 } },
    );
    rerender({ month: 9 });
    await waitFor(() => expect(result.current.data).toEqual([costB]));
    await act(async () => { resolveOct?.([costA]); });
    expect(result.current.data).toEqual([costB]);
  });

  it("shows an error rather than a fabricated zero after SQL timeout", async () => {
    mocked.fetchGerenteCustos.mockRejectedValue(new DataReadFailure("unavailable"));
    const { result } = renderHook(() => useGerenteCustos(a, 8, 2026));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toEqual([]);
    expect(mocked.fetchGerenteCustos).toHaveBeenCalledTimes(1);
  });

  it("accepts confirmed empty farm without retries", async () => {
    mocked.fetchGerenteCustos.mockResolvedValue([]);
    const { result } = renderHook(() => useGerenteCustos(b, 12, 2026));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });
});
