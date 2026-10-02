import { describe, expect, test } from "bun:test";
import type { PastoId } from "./identity";
import {
  TRANSFERENCIA_LANCAMENTO,
  decidirTransferenciaEntrePastos,
} from "./transferencia";

const origem = {
  id: "origem" as PastoId,
  num_animais: 100,
  categoria: "Recria 1" as string | null,
};

const destino = {
  id: "destino" as PastoId,
  num_animais: 40,
  categoria: "Engorda" as string | null,
};

describe("transferência entre pastos do mesmo retiro", () => {
  test("debita a origem e credita o destino", () => {
    const decisao = decidirTransferenciaEntrePastos({
      origem,
      destino,
      quantidade: 30,
    });
    expect(decisao).toEqual({
      ok: true,
      num_animais_origem: 70,
      num_animais_destino: 70,
      categoria_destino: "Engorda",
    });
  });

  test("recusa quantidade não positiva", () => {
    for (const quantidade of [0, -1, NaN]) {
      expect(
        decidirTransferenciaEntrePastos({ origem, destino, quantidade }),
      ).toEqual({ ok: false, motivo: "QUANTIDADE_INVALIDA" });
    }
  });

  test("recusa quantidade acima do saldo da origem", () => {
    expect(
      decidirTransferenciaEntrePastos({
        origem,
        destino,
        quantidade: 101,
      }),
    ).toEqual({ ok: false, motivo: "QUANTIDADE_ACIMA_DO_SALDO" });
  });

  test("permite transferir o saldo inteiro", () => {
    const decisao = decidirTransferenciaEntrePastos({
      origem,
      destino,
      quantidade: 100,
    });
    expect(decisao).toEqual({
      ok: true,
      num_animais_origem: 0,
      num_animais_destino: 140,
      categoria_destino: "Engorda",
    });
  });

  test("recusa destino inexistente no retiro", () => {
    expect(
      decidirTransferenciaEntrePastos({ origem, destino: null, quantidade: 5 }),
    ).toEqual({ ok: false, motivo: "DESTINO_NAO_ENCONTRADO" });
  });

  test("recusa destino igual à origem", () => {
    expect(
      decidirTransferenciaEntrePastos({
        origem,
        destino: origem,
        quantidade: 5,
      }),
    ).toEqual({ ok: false, motivo: "DESTINO_IGUAL_ORIGEM" });
  });

  test("destino sem categoria válida exige categoria na transferência", () => {
    const destinoSemCategoria = { ...destino, categoria: null };
    expect(
      decidirTransferenciaEntrePastos({
        origem,
        destino: destinoSemCategoria,
        quantidade: 5,
      }),
    ).toEqual({ ok: false, motivo: "CATEGORIA_DESTINO_OBRIGATORIA" });

    const decisao = decidirTransferenciaEntrePastos({
      origem,
      destino: destinoSemCategoria,
      quantidade: 5,
      categoriaDestino: "Recria 2",
    });
    expect(decisao).toEqual({
      ok: true,
      num_animais_origem: 95,
      num_animais_destino: 45,
      categoria_destino: "Recria 2",
    });
  });

  test("destino com categoria válida não é sobrescrito", () => {
    const decisao = decidirTransferenciaEntrePastos({
      origem,
      destino,
      quantidade: 5,
      categoriaDestino: "Recria 2",
    });
    expect(decisao).toMatchObject({ categoria_destino: "Engorda" });
  });

  test("lançamento de transferência não é leitura de cocho", () => {
    expect(TRANSFERENCIA_LANCAMENTO).toEqual({
      origem: "transferencia",
      num_sacos: 0,
      dias_no_pasto: 1,
    });
  });
});
