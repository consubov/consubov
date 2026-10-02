import { describe, expect, test } from "bun:test";
import type { PastoId, RetiroId } from "../../pastures";
import type {
  AbateRebanho,
  MortalidadeRebanho,
  MovimentacaoRebanho,
} from "./eventos";

const retiro = "r1" as RetiroId;
const origem = "p1" as PastoId;
const destino = "p2" as PastoId;

const abate: AbateRebanho = {
  id: "a1",
  fazenda_id: "f1",
  retiro_id: retiro,
  pasto_id: origem,
  quantidade: 12,
  data: "2026-03-10",
  mes: 3,
  ano: 2026,
  usuario_id: null,
  created_at: "2026-03-10T12:00:00Z",
};

const mortalidade: MortalidadeRebanho = {
  id: "m1",
  fazenda_id: "f1",
  retiro_id: retiro,
  pasto_id: origem,
  quantidade: 1,
  data: "2026-03-11",
  mes: 3,
  ano: 2026,
  observacao: null,
  foto_url: "data:animal",
  foto_brinco_url: "data:brinco",
  usuario_id: null,
  created_at: "2026-03-11T12:00:00Z",
};

const movimentacao: MovimentacaoRebanho = {
  id: "v1",
  fazenda_id: "f1",
  retiro_id: retiro,
  pasto_origem_id: origem,
  pasto_destino_id: destino,
  quantidade: 20,
  peso_medio: 380,
  categoria: "Recria 1",
  data: "2026-03-12",
  mes: 3,
  ano: 2026,
  usuario_id: null,
  created_at: "2026-03-12T12:00:00Z",
};

describe("eventos de rebanho", () => {
  test("todo evento carrega retiro, mês, ano e autor", () => {
    for (const evento of [abate, mortalidade, movimentacao]) {
      expect(evento.retiro_id).toBe(retiro);
      expect(evento.mes).toBe(3);
      expect(evento.ano).toBe(2026);
      expect(evento.usuario_id).toBeNull();
    }
  });

  test("movimentação exige as duas pontas do par de pastos", () => {
    const par = [movimentacao.pasto_origem_id, movimentacao.pasto_destino_id];
    expect(par.every((id) => id.length > 0)).toBe(true);
    expect(movimentacao.quantidade).toBeGreaterThan(0);
  });

  test("mortalidade carrega a foto do animal como obrigatória e a do brinco como evidência", () => {
    expect(mortalidade.foto_url.length).toBeGreaterThan(0);
    expect(mortalidade.foto_brinco_url).not.toBeNull();
  });

  test("abate e mortalidade saem de um único pasto", () => {
    expect(abate.pasto_id).toBe(origem);
    expect(mortalidade.pasto_id).toBe(origem);
  });
});
