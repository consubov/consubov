import { describe, expect, test } from "bun:test";
import {
  TOLERANCIA_PCT,
  acimaDaTolerancia,
  calcularDivergenciaRecebimento,
  divergenciaBatida,
  divergenciaBatidaRegistrada,
  divergenciaPesoBatida,
} from "./divergencia";

describe("TOLERANCIA_PCT", () => {
  test("é 5%", () => {
    expect(TOLERANCIA_PCT).toBe(5);
  });

  test("a comparação é estrita: exatamente 5% ainda está dentro", () => {
    expect(acimaDaTolerancia(5)).toBe(false);
    expect(acimaDaTolerancia(-5)).toBe(false);
    expect(acimaDaTolerancia(5.01)).toBe(true);
    expect(acimaDaTolerancia(-5.01)).toBe(true);
  });
});

describe("divergenciaBatida", () => {
  test("compara produzido contra esperado em percentual", () => {
    expect(divergenciaBatida(110, 100)).toBeCloseTo(10, 10);
    expect(divergenciaBatida(90, 100)).toBeCloseTo(-10, 10);
    expect(divergenciaBatida(100, 100)).toBe(0);
  });

  test("esperado não positivo zera a divergência", () => {
    expect(divergenciaBatida(110, 0)).toBe(0);
    expect(divergenciaBatida(110, null)).toBe(0);
  });

  test("produzido zero é -100% neste caminho", () => {
    expect(divergenciaBatida(0, 100)).toBe(-100);
  });
});

describe("divergenciaBatidaRegistrada", () => {
  test("mesma conta quando há produção", () => {
    expect(divergenciaBatidaRegistrada(110, 100)).toBeCloseTo(10, 10);
    expect(divergenciaBatidaRegistrada(90, 100)).toBeCloseTo(-10, 10);
  });

  test("produção ausente zera a divergência, ao contrário da finalização", () => {
    expect(divergenciaBatidaRegistrada(0, 100)).toBe(0);
    expect(divergenciaBatidaRegistrada(null, 100)).toBe(0);
    expect(divergenciaBatidaRegistrada(110, 0)).toBe(0);
  });
});

describe("divergenciaPesoBatida", () => {
  test("compara a soma dos ingredientes contra o peso da batida", () => {
    expect(divergenciaPesoBatida(980, 1000)).toBeCloseTo(-2, 10);
    expect(divergenciaPesoBatida(1020, 1000)).toBeCloseTo(2, 10);
  });

  test("peso da batida não positivo zera a divergência", () => {
    expect(divergenciaPesoBatida(980, 0)).toBe(0);
    expect(divergenciaPesoBatida(980, null)).toBe(0);
  });
});

describe("calcularDivergenciaRecebimento", () => {
  test("falta na origem é positiva e estoura a tolerância", () => {
    expect(calcularDivergenciaRecebimento(100, 94)).toEqual({
      divergenciaSacos: 6,
      divergenciaPercentual: 6,
      divergenciaPercentualArmazenada: 6,
      acimaDaTolerancia: true,
    });
  });

  test("exatamente 5% ainda está dentro da tolerância", () => {
    const resultado = calcularDivergenciaRecebimento(100, 95);
    expect(resultado.divergenciaPercentual).toBe(5);
    expect(resultado.acimaDaTolerancia).toBe(false);
  });

  test("sobra no destino é negativa e também estoura a tolerância", () => {
    const resultado = calcularDivergenciaRecebimento(100, 110);
    expect(resultado.divergenciaSacos).toBe(-10);
    expect(resultado.divergenciaPercentual).toBeCloseTo(-10, 10);
    expect(resultado.acimaDaTolerancia).toBe(true);
  });

  test("percentual gravado tem duas casas, comparação usa o valor cheio", () => {
    const resultado = calcularDivergenciaRecebimento(3, 2);
    expect(resultado.divergenciaPercentual).toBeCloseTo(33.333333, 5);
    expect(resultado.divergenciaPercentualArmazenada).toBe(33.33);
  });

  test("recebimento dentro da tolerância não alerta", () => {
    const resultado = calcularDivergenciaRecebimento(100, 97);
    expect(resultado.divergenciaPercentual).toBeCloseTo(3, 10);
    expect(resultado.acimaDaTolerancia).toBe(false);
  });

  test("sem quantidade enviada não há percentual nem alerta", () => {
    expect(calcularDivergenciaRecebimento(0, 0)).toEqual({
      divergenciaSacos: 0,
      divergenciaPercentual: 0,
      divergenciaPercentualArmazenada: 0,
      acimaDaTolerancia: false,
    });
  });

  test("nada recebido de um envio cheio é 100%", () => {
    const resultado = calcularDivergenciaRecebimento(100, 0);
    expect(resultado.divergenciaPercentual).toBe(100);
    expect(resultado.acimaDaTolerancia).toBe(true);
  });
});
