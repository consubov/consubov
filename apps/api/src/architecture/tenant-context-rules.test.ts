import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

const MODULES_ROOT = fileURLToPath(new URL("../modules/", import.meta.url));
const SHARED_ROOT = fileURLToPath(new URL("../shared/", import.meta.url));

const tenantScopedPorts = [
  "farms/domain/ports.ts",
  "feed-mill/domain/ports.ts",
  "files/domain/ports.ts",
  "integrations/domain/ports.ts",
  "inventory/domain/ports.ts",
  "livestock/domain/ports.ts",
  "notifications/domain/ports.ts",
  "pastures/domain/ports.ts",
  "reporting/domain/ports.ts",
  "sync/domain/ports.ts",
  "visits/domain/ports.ts",
  "weighing/domain/ports.ts",
] as const;

describe("tenant context boundaries", () => {
  test("tenant-scoped module ports require TenantExecutionContext", async () => {
    for (const relativePath of tenantScopedPorts) {
      const source = await Bun.file(`${MODULES_ROOT}/${relativePath}`).text();
      expect(source).toContain("TenantExecutionContext");
      expect(source).toContain("context: TenantExecutionContext");
    }
  });

  test("shared jobs and events require TenantExecutionContext", async () => {
    for (const relativePath of ["ports/JobQueuePort.ts", "ports/EventPublisherPort.ts"]) {
      const source = await Bun.file(`${SHARED_ROOT}/${relativePath}`).text();
      expect(source).toContain("context: TenantExecutionContext");
    }
  });
});
