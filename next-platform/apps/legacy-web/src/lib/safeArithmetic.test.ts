import { describe, expect, it } from "vitest";
import { evaluateArithmeticExpression } from "./safeArithmetic";

describe("evaluateArithmeticExpression", () => {
  it("preserves arithmetic precedence and parentheses", () => {
    expect(evaluateArithmeticExpression("2 + 3 * 4")).toBe(14);
    expect(evaluateArithmeticExpression("(2 + 3) * 4")).toBe(20);
  });

  it("supports unary operators, modulo and decimal comma", () => {
    expect(evaluateArithmeticExpression("-5 + +2")).toBe(-3);
    expect(evaluateArithmeticExpression("10 % 4")).toBe(2);
    expect(evaluateArithmeticExpression("1,5 * 2")).toBe(3);
  });

  it("rejects non-arithmetic input instead of executing code", () => {
    expect(() => evaluateArithmeticExpression("globalThis.alert(1)")).toThrow();
    expect(() => evaluateArithmeticExpression("1;2")).toThrow();
  });

  it("rejects malformed expressions", () => {
    expect(() => evaluateArithmeticExpression("(1 + 2")).toThrow("Parêntese não fechado");
    expect(() => evaluateArithmeticExpression("")).toThrow("Fórmula vazia");
  });
});
