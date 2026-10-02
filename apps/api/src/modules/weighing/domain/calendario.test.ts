import { describe, expect, test } from "bun:test";
import { dataLocalSaoPaulo, diasCalendarioSP } from "./calendario";

describe("data local em São Paulo", () => {
  test("devolve YYYY-MM-DD no fuso local", () => {
    expect(dataLocalSaoPaulo("2026-03-10T12:00:00.000Z")).toBe("2026-03-10");
  });

  test("meio-dia UTC ainda é o mesmo dia em São Paulo", () => {
    expect(dataLocalSaoPaulo("2026-03-10T12:00:00Z")).toBe("2026-03-10");
  });

  test("a madrugada UTC já é o dia anterior em São Paulo", () => {
    expect(dataLocalSaoPaulo("2026-03-10T02:00:00Z")).toBe("2026-03-09");
  });

  test("aceita Date e número", () => {
    expect(dataLocalSaoPaulo(new Date("2026-03-10T12:00:00Z"))).toBe(
      "2026-03-10",
    );
    expect(dataLocalSaoPaulo(Date.parse("2026-03-10T12:00:00Z"))).toBe(
      "2026-03-10",
    );
  });

  test("devolve string vazia para data inválida", () => {
    expect(dataLocalSaoPaulo("data-invalida")).toBe("");
    expect(dataLocalSaoPaulo(Number.NaN)).toBe("");
  });
});

describe("dias de calendário", () => {
  test("uma hora de diferença bruta que atravessa a meia-noite UTC continua no mesmo dia", () => {
    expect(
      diasCalendarioSP("2026-03-01T23:30:00Z", "2026-03-02T00:30:00Z"),
    ).toBe(0);
  });

  test("o mesmo dia é zero dias, qualquer que seja a hora", () => {
    expect(
      diasCalendarioSP("2026-03-10T13:00:00Z", "2026-03-10T23:00:00Z"),
    ).toBe(0);
  });

  test("aceita a ordem inversa e devolve negativo", () => {
    expect(diasCalendarioSP("2026-03-10", "2026-03-01")).toBe(-9);
  });

  test("devolve null se alguma data for inválida", () => {
    expect(diasCalendarioSP("data-invalida", "2026-03-10")).toBeNull();
    expect(diasCalendarioSP("2026-03-10", "data-invalida")).toBeNull();
  });

  test("data sem hora é interpretada em UTC", () => {
    expect(diasCalendarioSP("2026-03-01", "2026-03-10")).toBe(9);
  });
});