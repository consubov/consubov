import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./appVersion";

describe("CONSUBOV Fazendas — versão de produto", () => {
  it("não deve voltar para a numeração legada 1.155.0", () => {
    const parts = APP_VERSION.split(".");
    expect(parts).toHaveLength(3);
    const numbers = parts.map(Number);
    expect(numbers.every((value) => Number.isSafeInteger(value) && value >= 0)).toBe(true);
    const [major, minor, patch] = numbers;
    const isAtLeastV2 = major > 2 || (major === 2 && (minor > 0 || (minor === 0 && patch >= 0)));
    expect(isAtLeastV2).toBe(true);
  });
});
