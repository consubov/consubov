import { describe, expect, test } from "bun:test";
import { calcularPennState } from "./penn-state";

describe("calcularPennState", () => {
  test("caso âncora: percentuais sobre a soma das frações e peNDF com FDN", () => {
    const resultado = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 150,
      fdn_percentual: 30,
    });

    expect(resultado.soma_fracoes).toBe(1000);
    expect(resultado.diferenca_g).toBe(0);
    expect(resultado.percentual_19mm).toBe(10);
    expect(resultado.percentual_8mm).toBe(50);
    expect(resultado.percentual_4mm).toBe(25);
    expect(resultado.percentual_fundo).toBe(15);
    expect(resultado.fef).toBe(85);
    expect(resultado.peNDF).toBe(25.5);
    expect(resultado.aviso_divergencia).toBeNull();
  });

  test("divergência: calcula sobre a soma real e avisa", () => {
    const resultado = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 148,
      fdn_percentual: 30,
    });

    expect(resultado.soma_fracoes).toBe(998);
    expect(resultado.diferenca_g).toBe(2);
    expect(resultado.percentual_19mm).toBe(10);
    expect(resultado.percentual_8mm).toBe(50.1);
    expect(resultado.percentual_4mm).toBe(25.1);
    expect(resultado.percentual_fundo).toBe(14.8);
    expect(resultado.fef).toBe(85.2);
    expect(resultado.aviso_divergencia).toContain("998");
    expect(resultado.aviso_divergencia).toContain("2");
  });

  test("o fundo de peneira não entra no FEF", () => {
    const resultado = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 150,
    });

    expect(resultado.fef).toBe(85);
  });

  test("sem FDN o peNDF é null e nunca estimado", () => {
    const semFdn = calcularPennState({
      peso_amostra_g: 1000,
      peso_19mm_g: 100,
      peso_8mm_g: 500,
      peso_4mm_g: 250,
      peso_fundo_g: 150,
    });

    expect(semFdn.peNDF).toBeNull();

    expect(
      calcularPennState({
        peso_amostra_g: 1000,
        peso_19mm_g: 100,
        peso_8mm_g: 500,
        peso_4mm_g: 250,
        peso_fundo_g: 150,
        fdn_percentual: null,
      }).peNDF,
    ).toBeNull();
  });

  test("fração ausente vale 0 e frações zeradas não geram percentuais", () => {
    const resultado = calcularPennState({
      peso_amostra_g: 0,
      peso_19mm_g: 0,
      peso_8mm_g: 0,
      peso_4mm_g: 0,
      peso_fundo_g: 0,
      fdn_percentual: 30,
    });

    expect(resultado.soma_fracoes).toBe(0);
    expect(resultado.percentual_19mm).toBe(0);
    expect(resultado.fef).toBe(0);
    expect(resultado.peNDF).toBe(0);
  });
});