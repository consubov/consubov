import { describe, expect, test } from "bun:test";
import { sanitizeTelemetryContext } from "./ConsoleTelemetryAdapter";

describe("runtime telemetry sanitization", () => {
  test("redacts sensitive fields recursively", () => {
    const sanitized = sanitizeTelemetryContext({
      requestId: "req-1",
      authorization: "Bearer top-secret",
      nested: {
        email: "person@example.com",
        token: "token-value",
        safe: "ok",
      },
    });

    expect(sanitized).toEqual({
      requestId: "req-1",
      authorization: "[redacted]",
      nested: {
        email: "[redacted]",
        token: "[redacted]",
        safe: "ok",
      },
    });
  });

  test("redacts email and bearer values embedded in safe strings", () => {
    const serialized = JSON.stringify(
      sanitizeTelemetryContext({
        message: "user person@example.com failed with Bearer abc.def.ghi",
      }),
    );

    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("abc.def.ghi");
    expect(serialized).toContain("[redacted-email]");
    expect(serialized).toContain("Bearer [redacted]");
  });
});
