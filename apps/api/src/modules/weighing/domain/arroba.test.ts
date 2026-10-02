import { describe, expect, test } from "bun:test";
import {
  KG_POR_ARROBA_CARCACA,
  KG_POR_ARROBA_ROTULO,
  arrobaDeCarcaça,
  arrobaDeRotulo,
  calcularPesoPagavel,
  kgDeArrobaDeCarcaça,
  kgDeArrobaDeRotulo,
} from "./arroba";

describe("arroba de carcaça (pagamento)", () => {
  test("divide por 15", () => {
    expect(KG_POR_ARROBA_CARCACA).toBe(15);
    expect(arrobaDeCarcaça(150)).toBe(10);
    expect(arrobaDeCarcaça(300)).toBe(20);
  });

  test("trunca em 2 casas, sem arredondar", () => {
    expect(arrobaDeCarcaça(100)).toBe(6.66);
    expect(arrobaDeCarcaça(120)).toBe(8);
  });

  test("um quilo muda o resultado: 15 kg são uma arroba cheia", () => {
    expect(arrobaDeCarcaça(15)).toBe(1);
    expect(arrobaDeCarcaça(14.9)).toBe(0.99);
  });

  test("converte de volta para kg", () => {
    expect(kgDeArrobaDeCarcaça(10)).toBe(150);
    expect(kgDeArrobaDeCarcaça(0.48)).toBeCloseTo(7.2, 10);
  });
});

describe("arroba de rótulo (exibição)", () => {
  test("divide por 30, não trunca", () => {
    expect(KG_POR_ARROBA_ROTULO).toBe(30);
    expect(arrobaDeRotulo(300)).toBe(10);
    expect(arrobaDeRotulo(180)).toBe(6);
  });

  test("mantém a fração que a divisão por 15 perderia", () => {
    expect(arrobaDeRotulo(150)).toBe(5);
    expect(arrobaDeCarcaça(150)).toBe(10);
    expect(arrobaDeRotulo(120)).toBe(4);
    expect(arrobaDeCarcaça(120)).toBe(8);
  });

  test("não trunca em duas casas, a formatação é da tela", () => {
    expect(arrobaDeRotulo(100)).toBe(3.3333333333333335);
  });

  test("converte de volta para kg", () => {
    expect(kgDeArrobaDeRotulo(6)).toBe(180);
  });
});

describe("peso pagável", () => {
  test("aplica o percentual de rendimento sobre o peso vivo", () => {
    expect(calcularPesoPagavel(300, 50)).toBe(150);
    expect(calcularPesoPagavel(300, 0)).toBe(0);
  });

  test("percentual acima de 100 é aceito como cálculo puro", () => {
    expect(calcularPesoPagavel(300, 120)).toBe(360);
  });
});