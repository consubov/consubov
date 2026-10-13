import { describe, expect, it, vi } from "vitest";
import { auditConferenciaLocation } from "./conferenciaGeoAudit";

describe("auditConferenciaLocation", () => {
  it("records GPS location exactly once", async () => {
    const record = vi.fn();
    await auditConferenciaLocation({ getCurrentPosition: async () => ({ latitude: -21, longitude: -40 }) }, record);
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(-21, -40);
  });

  it("records null exactly once when GPS rejects", async () => {
    const record = vi.fn();
    await auditConferenciaLocation({ getCurrentPosition: async () => { throw Error("denied"); } }, record);
    expect(record).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledWith(null, null);
  });

  it("does not propagate an audit failure into the QR flow", async () => {
    await expect(auditConferenciaLocation(
      { getCurrentPosition: async () => null },
      async () => { throw Error("network"); },
    )).resolves.toBeUndefined();
  });
});
