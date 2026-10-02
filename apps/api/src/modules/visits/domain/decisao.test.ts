import { describe, expect, test } from "bun:test";
import { decisaoAoEditarVisita } from "./decisao";
import { VISITA_STATUS } from "./visita";

describe("decisaoAoEditarVisita", () => {
  test("visita finalizada reabre para revisao e apaga o pdf", () => {
    expect(decisaoAoEditarVisita("finalizada")).toEqual({
      deveReabrir: true,
      novoStatus: "revisao",
      limparPdf: true,
    });
  });

  test("nenhum outro status é alterado", () => {
    for (const status of VISITA_STATUS.filter((valor) => valor !== "finalizada")) {
      expect(decisaoAoEditarVisita(status)).toEqual({ deveReabrir: false });
    }
  });
});