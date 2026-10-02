import { describe, expect, test } from "bun:test";
import {
  getMateriaQuantidadeEmEstoque,
  isMateriaEmSaco,
} from "./estoque";
import type { MateriaPrimaRef } from "./materiaPrima";
import type { FabricaId, MateriaPrimaId } from "./identifiers";

const materia = (
  unidade: MateriaPrimaRef["unidade"],
  pesoPorSaco: number | null,
  estoqueAtual: number | null = null,
): MateriaPrimaRef => ({
  id: "mp-1" as MateriaPrimaId,
  fabricaId: "fab-1" as FabricaId,
  nome: "Milho moído",
  unidade,
  pesoPorSaco,
  estoqueAtual,
  estoqueMinimo: null,
  ativo: true,
});

describe("isMateriaEmSaco", () => {
  test("exige unidade saco e peso do saco preenchido", () => {
    expect(isMateriaEmSaco(materia("saco", 50))).toBe(true);
    expect(isMateriaEmSaco(materia("saco", 0))).toBe(false);
    expect(isMateriaEmSaco(materia("saco", null))).toBe(false);
    expect(isMateriaEmSaco(materia("kg", 50))).toBe(false);
    expect(isMateriaEmSaco(materia("tonelada", 50))).toBe(false);
  });

  test("matéria-prima ausente não é materia em saco", () => {
    expect(isMateriaEmSaco(undefined)).toBe(false);
    expect(isMateriaEmSaco(null)).toBe(false);
  });
});

describe("getMateriaQuantidadeEmEstoque", () => {
  test("converte kg em sacos e arredonda para cima", () => {
    // 120 kg com saco de 50 kg => 2,4 sacos => 3
    expect(getMateriaQuantidadeEmEstoque(120, materia("saco", 50))).toBe(3);
    // 100 kg com saco de 50 kg => 2 sacos exatos
    expect(getMateriaQuantidadeEmEstoque(100, materia("saco", 50))).toBe(2);
    // 51 kg com saco de 50 kg => 1,02 sacos => 2
    expect(getMateriaQuantidadeEmEstoque(51, materia("saco", 50))).toBe(2);
  });

  test("unidade diferente de saco usa o valor cru em kg", () => {
    expect(getMateriaQuantidadeEmEstoque(120, materia("kg", null))).toBe(120);
    expect(getMateriaQuantidadeEmEstoque(120, materia("litro", 50))).toBe(120);
    expect(getMateriaQuantidadeEmEstoque(120, materia("saco", 0))).toBe(120);
    expect(getMateriaQuantidadeEmEstoque(120, null)).toBe(120);
  });

  test("zero kg consome zero saco mesmo arredondando para cima", () => {
    expect(getMateriaQuantidadeEmEstoque(0, materia("saco", 50))).toBe(0);
  });
});
