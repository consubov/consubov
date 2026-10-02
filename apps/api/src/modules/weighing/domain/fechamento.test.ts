import { describe, expect, test } from "bun:test";
import {
  persistePesoPorAnimal,
  podeFinalizarPesagem,
  planejarFechamentoPesagem,
} from "./fechamento";

describe("condição de fechamento", () => {
  test("não finaliza sem nenhum peso", () => {
    expect(podeFinalizarPesagem([])).toBe(false);
  });

  test("finaliza com ao menos um peso", () => {
    expect(podeFinalizarPesagem([300])).toBe(true);
  });

  test("lote identificado persiste peso por animal; sem identificação, só totais", () => {
    expect(persistePesoPorAnimal(true)).toBe(true);
    expect(persistePesoPorAnimal(false)).toBe(false);
  });
});

describe("fechamento de lote identificado", () => {
  test("soma os totais e mantém o peso médio sem arredondar", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: true,
      pesos: [300, 200, 250.5],
      dataPesagem: "2026-03-10T12:00:00Z",
    });

    expect(fechamento).toEqual({
      ok: true,
      quantidadeAnimais: 3,
      pesoTotalKg: 750.5,
      pesoMedioKg: 750.5 / 3,
      persistePesoPorAnimal: true,
      pesosPorAnimal: [300, 200, 250.5],
      gmdLoteKgDia: null,
    });
  });

  test("não calcula GMD do lote em lote identificado", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: true,
      pesos: [300],
      dataPesagem: "2026-03-10T12:00:00Z",
      pesoMedioAnteriorKg: 250,
      dataAnterior: "2026-03-01T12:00:00Z",
    });

    expect(fechamento.ok).toBe(true);
    expect(fechamento.ok && fechamento.gmdLoteKgDia).toBeNull();
  });
});

describe("fechamento de lote sem identificação", () => {
  test("não entrega pesos por animal, só os totais", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: false,
      pesos: [300, 200],
      dataPesagem: "2026-03-10T12:00:00Z",
    });

    expect(fechamento.ok).toBe(true);
    expect(fechamento.ok && fechamento.persistePesoPorAnimal).toBe(false);
    expect(fechamento.ok && fechamento.pesosPorAnimal).toBeNull();
    expect(fechamento.ok && fechamento.pesoTotalKg).toBe(500);
    expect(fechamento.ok && fechamento.quantidadeAnimais).toBe(2);
  });

  test("calcula o GMD do lote contra a pesagem anterior", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: false,
      pesos: [300, 200],
      dataPesagem: "2026-03-11T12:00:00Z",
      pesoMedioAnteriorKg: 200,
      dataAnterior: "2026-03-01T12:00:00Z",
    });

    expect(fechamento.ok).toBe(true);
    expect(fechamento.ok && fechamento.pesoMedioKg).toBe(250);
    expect(fechamento.ok && fechamento.gmdLoteKgDia).toBe(5);
  });

  test("sem pesagem anterior não há GMD", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: false,
      pesos: [300, 200],
      dataPesagem: "2026-03-11T12:00:00Z",
    });

    expect(fechamento.ok && fechamento.gmdLoteKgDia).toBeNull();
  });

  test("pesagem anterior no mesmo dia não gera GMD", () => {
    const fechamento = planejarFechamentoPesagem({
      loteIdentificado: false,
      pesos: [300, 200],
      dataPesagem: "2026-03-10T22:00:00Z",
      pesoMedioAnteriorKg: 200,
      dataAnterior: "2026-03-10T12:00:00Z",
    });

    expect(fechamento.ok && fechamento.gmdLoteKgDia).toBeNull();
  });
});

describe("fechamento sem pesos", () => {
  test("recusa e diz o motivo", () => {
    expect(
      planejarFechamentoPesagem({
        loteIdentificado: true,
        pesos: [],
        dataPesagem: "2026-03-10T12:00:00Z",
      }),
    ).toEqual({ ok: false, motivo: "nenhum_peso_registrado" });

    expect(
      planejarFechamentoPesagem({
        loteIdentificado: false,
        pesos: [],
        dataPesagem: "2026-03-10T12:00:00Z",
      }),
    ).toEqual({ ok: false, motivo: "nenhum_peso_registrado" });
  });
});