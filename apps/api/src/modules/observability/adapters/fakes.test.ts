import { describe, expect, it } from "vitest";
import { FakeAuditLogAdapter, FakeTelemetryAdapter } from "./fakes";

describe("FakeAuditLogAdapter", () => {
  it("stores audit logs in memory", async () => {
    const adapter = new FakeAuditLogAdapter();
    const entry = {
      actorId: "user-1",
      tenantId: "tenant-1",
      action: "resource:create",
      result: "success" as const,
      requestId: "req-1",
    };

    await adapter.log(entry);

    expect(adapter.logs).toHaveLength(1);
    expect(adapter.logs[0]).toEqual(entry);
  });
});

describe("FakeTelemetryAdapter", () => {
  it("stores telemetry data in memory", () => {
    const adapter = new FakeTelemetryAdapter();
    
    adapter.log("info", "test log", { key: "value" });
    adapter.recordEvent({ name: "test_event" });
    adapter.recordMetric({ name: "test_metric", value: 10 });
    adapter.recordError(new Error("test error"));

    expect(adapter.logs).toHaveLength(1);
    expect(adapter.logs[0].level).toBe("info");
    
    expect(adapter.events).toHaveLength(1);
    expect(adapter.events[0].name).toBe("test_event");
    
    expect(adapter.metrics).toHaveLength(1);
    expect(adapter.metrics[0].value).toBe(10);
    
    expect(adapter.errors).toHaveLength(1);
    expect(adapter.errors[0].error.message).toBe("test error");
  });
});
