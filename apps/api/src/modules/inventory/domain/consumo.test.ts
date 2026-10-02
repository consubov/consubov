import { describe, expect, test } from "bun:test";
import {
  arredondarConsumoMedioDiario,
  derivarConsumoMedioDiario,
  derivarDiasRestantes,
} from "./consumo";

describe("consumo médio diário", () => {
  test("divide a soma da janela de 30 dias por 30", () => {
    expect(derivarConsumoMedioDiario(300)).toBe(10);
    expect(derivarConsumoMedioDiario(0)).toBe(0);
    expect(derivarConsumoMedioDiario(45)).toBe(1.5);
  });

  test("arredonda para 1 casa na exibicao", () => {
    expect(arredondarConsumoMedioDiario(derivarConsumoMedioDiario(44))).toBe(1.5);
    expect(arredondarConsumoMedioDiario(derivarConsumoMedioDiario(41))).toBe(1.4);
  });
});

describe("dias restantes", () => {
  test("trunca para dia inteiro cheio", () => {
    expect(derivarDiasRestantes(100, 10)).toBe(10);
    expect(derivarDiasRestantes(105, 10)).toBe(10);
    expect(derivarDiasRestantes(99, 10)).toBe(9);
  });

  test("devolve null sem consumo para dividir", () => {
    expect(derivarDiasRestantes(100, 0)).toBeNull();
  });

  test("trata bucket inexistente como saldo zero", () => {
    expect(derivarDiasRestantes(0, 10)).toBe(0);
    expect(derivarDiasRestantes(0, 0)).toBeNull();
  });
});