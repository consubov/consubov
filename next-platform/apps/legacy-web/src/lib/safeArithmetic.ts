const isDigit = (value: string | undefined) => value !== undefined && value >= "0" && value <= "9";

class ArithmeticParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      throw new Error(`Caractere inválido na posição ${this.index + 1}`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.consume("+")) {
        value += this.parseTerm();
      } else if (this.consume("-")) {
        value -= this.parseTerm();
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parseUnary();
    while (true) {
      this.skipWhitespace();
      if (this.consume("*")) {
        value *= this.parseUnary();
      } else if (this.consume("/")) {
        value /= this.parseUnary();
      } else if (this.consume("%")) {
        value %= this.parseUnary();
      } else {
        return value;
      }
    }
  }

  private parseUnary(): number {
    this.skipWhitespace();
    if (this.consume("+")) return this.parseUnary();
    if (this.consume("-")) return -this.parseUnary();
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    this.skipWhitespace();
    if (this.consume("(")) {
      const value = this.parseExpression();
      this.skipWhitespace();
      if (!this.consume(")")) {
        throw new Error("Parêntese não fechado");
      }
      return value;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWhitespace();
    const start = this.index;
    let sawDigit = false;
    let sawDecimal = false;

    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (isDigit(char)) {
        sawDigit = true;
        this.index += 1;
        continue;
      }
      if ((char === "." || char === ",") && !sawDecimal) {
        sawDecimal = true;
        this.index += 1;
        continue;
      }
      break;
    }

    if (!sawDigit) {
      throw new Error(`Número esperado na posição ${start + 1}`);
    }

    const token = this.source.slice(start, this.index).replace(",", ".");
    const value = Number(token);
    if (!Number.isFinite(value)) {
      throw new Error("Número inválido");
    }
    return value;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private consume(expected: string): boolean {
    if (this.source[this.index] !== expected) return false;
    this.index += 1;
    return true;
  }
}

export function evaluateArithmeticExpression(expression: string): number {
  if (!expression.trim()) {
    throw new Error("Fórmula vazia");
  }
  return new ArithmeticParser(expression).parse();
}
