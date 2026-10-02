import { describe, expect, test } from "bun:test";
import type { PesagemId } from "./identity";
import {
  calcularGmdIndividual,
  calcularGmdLote,
  diasEntrePesagens,
  escolherPesoAnterior,
  type PesagemAnteriorCandidata,
} from "./pesagem";

function linha(
  pesagemLoteId: string,
  dataPesagem: string | null,
  peso: number,
): PesagemAnteriorCandidata<number> {
  return {
    pesagemLoteId: pesagemLoteId as PesagemId,
    dataPesagem,
    peso,
  };
}

describe("dias entre pesagens", () => {
  test("conta dias de calendário positivos", () => {
    expect(diasEntrePesagens("2026-03-01T12:00:00Z", "2026-03-11T12:00:00Z")).toBe(
      10,
    );
  });

  test("devolve null no mesmo dia", () => {
    expect(
      diasEntrePesagens("2026-03-10T13:00:00Z", "2026-03-10T23:00:00Z"),
    ).toBeNull();
  });

  test("devolve null quando a pesagem atual é anterior", () => {
    expect(diasEntrePesagens("2026-03-10", "2026-03-01")).toBeNull();
  });

  test("devolve null para data inválida", () => {
    expect(diasEntrePesagens("data-invalida", "2026-03-01")).toBeNull();
  });
});

describe("escolha da pesagem anterior", () => {
  const atual = linha("pesagem-atual", "2026-03-10T12:00:00Z", 300);

  test("escolhe a de maior data estritamente anterior", () => {
    const escolhida = escolherPesoAnterior(
      [
        linha("p1", "2026-02-01T12:00:00Z", 200),
        linha("p2", "2026-03-05T12:00:00Z", 250),
        linha("p3", "2026-01-15T12:00:00Z", 180),
      ],
      atual.dataPesagem as string,
      atual.pesagemLoteId,
    );

    expect(escolhida?.pesagemLoteId).toBe("p2");
    expect(escolhida?.peso).toBe(250);
  });

  test("exclui a própria pesagem atual", () => {
    const escolhida = escolherPesoAnterior(
      [atual],
      atual.dataPesagem as string,
      atual.pesagemLoteId,
    );

    expect(escolhida).toBeNull();
  });

  test("ignora pesagem do mesmo dia, mesmo com hora posterior", () => {
    const escolhida = escolherPesoAnterior(
      [
        linha("mesmo-dia", "2026-03-10T22:00:00Z", 310),
        linha("anterior", "2026-03-09T12:00:00Z", 250),
      ],
      atual.dataPesagem as string,
      atual.pesagemLoteId,
    );

    expect(escolhida?.pesagemLoteId).toBe("anterior");
  });

  test("ignora linha sem data de pesagem", () => {
    const escolhida = escolherPesoAnterior(
      [linha("sem-data", null, 999), linha("anterior", "2026-03-09T12:00:00Z", 250)],
      atual.dataPesagem as string,
    );

    expect(escolhida?.pesagemLoteId).toBe("anterior");
  });

  test("devolve null quando não há pesagem anterior", () => {
    expect(escolherPesoAnterior([], atual.dataPesagem as string)).toBeNull();
  });

  test("devolve null para data atual inválida", () => {
    expect(escolherPesoAnterior([linha("p1", "2026-03-09", 250)], "x")).toBeNull();
  });
});

describe("GMD", () => {
  test("individual: variação sobre os dias", () => {
    expect(
      calcularGmdIndividual({
        pesoAtualKg: 300,
        pesoAnteriorKg: 250,
        dias: 10,
      }),
    ).toBe(5);
  });

  test("lote: mesma fórmula sobre o peso médio", () => {
    expect(
      calcularGmdLote({
        pesoMedioAtualKg: 300,
        pesoMedioAnteriorKg: 250,
        dias: 10,
      }),
    ).toBe(5);
  });

  test("devolve null sem pesagem anterior", () => {
    expect(
      calcularGmdIndividual({ pesoAtualKg: 300, pesoAnteriorKg: null, dias: 10 }),
    ).toBeNull();

    expect(
      calcularGmdLote({
        pesoMedioAtualKg: 300,
        pesoMedioAnteriorKg: null,
        dias: 10,
      }),
    ).toBeNull();
  });

  test("devolve null sem dias, inclusive no mesmo dia", () => {
    expect(
      calcularGmdIndividual({ pesoAtualKg: 300, pesoAnteriorKg: 250, dias: 0 }),
    ).toBeNull();

    expect(
      calcularGmdIndividual({ pesoAtualKg: 300, pesoAnteriorKg: 250, dias: null }),
    ).toBeNull();
  });

  test("ganho negativo é resultado válido", () => {
    expect(
      calcularGmdIndividual({ pesoAtualKg: 240, pesoAnteriorKg: 250, dias: 5 }),
    ).toBe(-2);
  });

  test("usa dias de calendário, não a diferença bruta de instantes", () => {
    const dias = diasEntrePesagens(
      "2026-03-10T22:00:00Z",
      "2026-03-11T01:00:00Z",
    );

    expect(dias).toBeNull();
    expect(
      calcularGmdIndividual({ pesoAtualKg: 300, pesoAnteriorKg: 250, dias }),
    ).toBeNull();
  });
});