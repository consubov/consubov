import { describe, expect, it } from "vitest";
import { DashboardQueryError, requireDashboardCount, requireAnimalTotal } from "./adminDashboardMetrics";

describe("admin dashboard counts are verified, never silently zeroed", () => {
  it("accepts true positive and genuine zero counts", () => {
    expect(requireDashboardCount({ count: 8, error: null, status: 200 })).toBe(8);
    expect(requireDashboardCount({ count: 0, error: null, status: 200 })).toBe(0);
  });
  it("rejects null and invalid counts rather than showing zero", () => {
    expect(() => requireDashboardCount({ count: null, error: null })).toThrow(DashboardQueryError);
    expect(() => requireDashboardCount({ count: -1, error: null })).toThrow(DashboardQueryError);
  });
  it("distinguishes 401/403 RLS from general connectivity failure", () => {
    expect(() => requireDashboardCount({ count: null, error: { code: "42501" }, status: 403 }))
      .toThrowError(new DashboardQueryError("permission"));
    expect(() => requireDashboardCount({ count: null, error: { code: "PGRST" }, status: 500 }))
      .toThrowError(new DashboardQueryError("network"));
  });
  it("sums animal counts and keeps valid zero", () => {
    expect(requireAnimalTotal({ data: [{ num_animais: 7 }, { num_animais: null }], error: null })).toBe(7);
    expect(requireAnimalTotal({ data: [], error: null })).toBe(0);
  });
  it("rejects incomplete and unauthorized animal queries", () => {
    expect(() => requireAnimalTotal({ data: null, error: null })).toThrow(DashboardQueryError);
    expect(() => requireAnimalTotal({ data: [{ num_animais: -1 }], error: null })).toThrow(DashboardQueryError);
    expect(() => requireAnimalTotal({ data: [], error: { code: "42501" }, status: 403 }))
      .toThrow(DashboardQueryError);
  });
});
