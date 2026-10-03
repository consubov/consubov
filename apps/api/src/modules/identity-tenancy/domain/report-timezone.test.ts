import { describe, expect, test } from "bun:test";
import {
  createTenantReportTimeZone,
  requireTenantReportTimeZone,
} from "./report-timezone";

describe("tenant report timezone", () => {
  test("accepts an explicit IANA timezone", () => {
    expect(createTenantReportTimeZone(" America/Sao_Paulo ")).toBe("America/Sao_Paulo");
  });

  test("rejects empty and invalid timezone values", () => {
    expect(() => createTenantReportTimeZone(" ")).toThrow(
      "tenant report time zone is required",
    );
    expect(() => createTenantReportTimeZone("Mars/Olympus")).toThrow(
      "tenant report time zone must be a valid IANA timezone",
    );
  });

  test("requires configuration instead of applying a silent fallback", () => {
    expect(() => requireTenantReportTimeZone(null)).toThrow(
      "tenant report time zone is not configured",
    );
    expect(
      requireTenantReportTimeZone(createTenantReportTimeZone("UTC")),
    ).toBe("UTC");
  });
});
