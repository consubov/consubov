import { describe, it, expect } from "vitest";
import { calcularPennState } from "@/lib/pennState";

describe("calcularPennState", () => {
  it("caso âncora: 1000g, sem divergência", () => {
    const r = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 150,
      fdn_percentual: 30,
    });
    expect(r.percentual_19mm).toBe(10);
    expect(r.percentual_8mm).toBe(50);
    expect(r.percentual_4mm).toBe(25);
    expect(r.percentual_fundo).toBe(15);
    expect(r.fef).toBe(85);
    expect(r.peNDF).toBe(25.5);
    expect(r.aviso_divergencia).toBeNull();
  });

  it("divergência: soma 998g vs amostra 1000g — calcula sobre 998g e avisa", () => {
    const r = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 148,
      fdn_percentual: 30,
    });
    expect(r.soma_fracoes).toBe(998);
    expect(r.diferenca_g).toBe(2);
    expect(r.aviso_divergencia).toContain("998");
    expect(r.aviso_divergencia).toContain("1.000");
    expect(r.percentual_19mm).toBe(10);
    expect(r.percentual_8mm).toBe(50.1);
    expect(r.percentual_4mm).toBe(25.1);
    expect(r.percentual_fundo).toBe(14.8);
    expect(r.fef).toBe(85.2);
  });

  it("Linha 2: 680g informado, frações 40/350/210/90 — percentuais somam 100%", () => {
    const r = calcularPennState({
      peso_amostra_g: 680,
      peso_19mm_g: 40,
      peso_8mm_g: 350,
      peso_4mm_g: 210,
      peso_fundo_g: 90,
    });
    expect(r.soma_fracoes).toBe(690);
    expect(r.percentual_19mm).toBe(5.8);
    expect(r.percentual_8mm).toBe(50.7);
    expect(r.percentual_4mm).toBe(30.4);
    expect(r.percentual_fundo).toBe(13);
    expect(
      r.percentual_19mm + r.percentual_8mm + r.percentual_4mm + r.percentual_fundo,
    ).toBeCloseTo(100, 6);
    expect(r.fef).toBe(86.9);
    expect(r.aviso_divergencia).toBeTruthy();
  });

  it("sem FDN: peNDF é null (nunca estima)", () => {
    const r = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 150,
    });
    expect(r.peNDF).toBeNull();
    expect(r.fef).toBe(85);
  });
});
