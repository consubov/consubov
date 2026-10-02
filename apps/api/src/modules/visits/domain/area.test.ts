import { describe, expect, test } from "bun:test";
import { resolverAreaTotal } from "./area";

const base = { area_alqueires: null as number | null };

describe("resolverAreaTotal", () => {
  const pastos = [
    { ...base, area_alqueires: 12 },
    { ...base, area_alqueires: 8 },
    { ...base, area_alqueires: null },
  ];

  test("soma as áreas por pasto quando ao menos um tem área", () => {
    const resolvida = resolverAreaTotal(pastos, null);

    expect(resolvida.area).toBe(20);
    expect(resolvida.origem).toBe("pastos");
    expect(resolvida.comArea).toBe(2);
    expect(resolvida.totalPastos).toBe(3);
    expect(resolvida.nota).toContain("2 de 3 pastos");
  });

  test("ignora o total manual quando existe área por pasto", () => {
    expect(resolverAreaTotal(pastos, 100).area).toBe(20);
  });

  test("nota sem parcialidade quando todos os pastos têm área", () => {
    const resolvida = resolverAreaTotal(
      [
        { ...base, area_alqueires: 12 },
        { ...base, area_alqueires: 8 },
      ],
      null,
    );

    expect(resolvida.nota).toBe("Calculado com base na área informada por pasto.");
  });

  test("usa o total manual quando nenhum pasto tem área", () => {
    const semArea = pastos.map((pasto) => ({ ...pasto, area_alqueires: null }));
    const resolvida = resolverAreaTotal(semArea, 20);

    expect(resolvida.area).toBe(20);
    expect(resolvida.origem).toBe("manual");
    expect(resolvida.nota).toBe("Calculado com base na área total informada.");
  });

  test("sem nenhuma área não há área nem origem", () => {
    const semArea = pastos.map((pasto) => ({ ...pasto, area_alqueires: null }));
    const resolvida = resolverAreaTotal(semArea, null);

    expect(resolvida.area).toBeNull();
    expect(resolvida.origem).toBeNull();
    expect(resolvida.nota).toBeNull();
  });

  test("área zero nos pastos não impede o uso do total manual", () => {
    const resolvida = resolverAreaTotal(
      [{ ...base, area_alqueires: 0 }],
      20,
    );

    expect(resolvida.origem).toBe("manual");
    expect(resolvida.area).toBe(20);
  });
});