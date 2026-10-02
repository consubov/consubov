import { describe, expect, test } from "bun:test";
import { ORDEM_ZONA_CONCLUSAO, ORDEM_ZONA_DESENVOLVIMENTO, zonaDaOrdem } from "./fotos";

describe("zonaDaOrdem", () => {
  test("ordem abaixo de 5 é introdução", () => {
    expect(zonaDaOrdem(0)).toBe("introducao");
    expect(zonaDaOrdem(4)).toBe("introducao");
    expect(ORDEM_ZONA_DESENVOLVIMENTO).toBe(5);
  });

  test("ordem de 5 a 1000 é desenvolvimento", () => {
    expect(zonaDaOrdem(5)).toBe("desenvolvimento");
    expect(zonaDaOrdem(500)).toBe("desenvolvimento");
    expect(zonaDaOrdem(1000)).toBe("desenvolvimento");
  });

  test("ordem a partir de 1001 é conclusão", () => {
    expect(zonaDaOrdem(1001)).toBe("conclusao");
    expect(zonaDaOrdem(5000)).toBe("conclusao");
    expect(ORDEM_ZONA_CONCLUSAO).toBe(1001);
  });

  test("a zona gravada tem precedência sobre a ordem", () => {
    expect(zonaDaOrdem(3, "conclusao")).toBe("conclusao");
    expect(zonaDaOrdem(2000, "introducao")).toBe("introducao");
    expect(zonaDaOrdem(10, null)).toBe("desenvolvimento");
  });
});