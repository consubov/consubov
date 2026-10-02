import { describe, expect, test } from "bun:test";
import { creditar, debitar } from "./saldo";

describe("aritmética do saldo do bucket", () => {
  test("creditar soma sem piso", () => {
    expect(creditar(0, 40)).toBe(40);
    expect(creditar(40, 40)).toBe(80);
    expect(creditar(0, 0)).toBe(0);
  });

  test("creditar preserva o piso quando o saldo ja esta no zero", () => {
    expect(creditar(-10, 5)).toBe(-5);
  });

  test("debitar subtrai quando ha saldo", () => {
    expect(debitar(100, 30)).toBe(70);
    expect(debitar(30, 30)).toBe(0);
  });

  test("debitar nunca produz saldo negativo", () => {
    expect(debitar(10, 30)).toBe(0);
    expect(debitar(0, 1)).toBe(0);
  });

  test("debitar nao devolve o excesso debitado depois", () => {
    const debitado = debitar(5, 12);

    expect(debitado).toBe(0);
    expect(creditar(debitado, 0)).toBe(0);
  });
});