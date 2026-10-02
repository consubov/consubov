import { describe, expect, test } from "bun:test";
import { arredondar1, arredondar2, truncar2 } from "./arredondamento";

describe("arredondamento", () => {
  test("arredondar1 fixa uma casa decimal", () => {
    expect(arredondar1(180.44)).toBe(180.4);
    expect(arredondar1(180.46)).toBe(180.5);
    expect(arredondar1(180)).toBe(180);
  });

  test("arredondar2 fixa duas casas decimais", () => {
    expect(arredondar2(180.125)).toBe(180.13);
    expect(arredondar2(180.124)).toBe(180.12);
  });

  test("truncar2 nunca sobe", () => {
    expect(truncar2(180.129)).toBe(180.12);
    expect(truncar2(180.1299999)).toBe(180.12);
  });

  test("truncar e arredondar divergem na fronteira", () => {
    const valor = 3.999;

    expect(truncar2(valor)).toBe(3.99);
    expect(arredondar2(valor)).toBe(4);
  });

  test("o piso de truncar2 mantem o valor abaixo do limite", () => {
    expect(truncar2(0.009)).toBe(0);
    expect(arredondar2(0.009)).toBe(0.01);
  });
});