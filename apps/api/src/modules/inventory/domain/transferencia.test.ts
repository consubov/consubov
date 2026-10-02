import { describe, expect, test } from "bun:test";
import { InventarioContratoError } from "./errors";
import type { TransferenciaEstoqueId } from "./identity";
import {
  criarTransferenciaEstoque,
  type TransferenciaEstoqueStatus,
  type TransferenciaTipoAcao,
} from "./transferencia";

type Entrada = Parameters<typeof criarTransferenciaEstoque>[0];

const origem = "retiro-origem" as Entrada["retiroOrigemId"];
const destino = "retiro-destino" as Entrada["retiroDestinoId"];
const id = "transferencia-1" as TransferenciaEstoqueId;

describe("transferência de estoque", () => {
  test("nasce pendente quando o status não é informado", () => {
    const transferencia = criarTransferenciaEstoque({
      id,
      retiroOrigemId: origem,
      retiroDestinoId: destino,
      quantidade: 12,
      tipoAcao: "solicitacao",
    });

    expect(transferencia.status).toBe("pendente");
    expect(transferencia.quantidade).toBe(12);
  });

  test("cobre os status e ações do CHECK", () => {
    const status: TransferenciaEstoqueStatus[] = [
      "pendente",
      "aprovado",
      "recusado",
    ];
    const tipoAcao: TransferenciaTipoAcao[] = ["solicitacao", "envio"];

    expect(status).toHaveLength(3);
    expect(tipoAcao).toHaveLength(2);
  });

  test("recusa quantidade zero ou negativa", () => {
    expect(() =>
      criarTransferenciaEstoque({
        id,
        retiroOrigemId: origem,
        retiroDestinoId: destino,
        quantidade: 0,
        tipoAcao: "envio",
      }),
    ).toThrow(InventarioContratoError);

    expect(() =>
      criarTransferenciaEstoque({
        id,
        retiroOrigemId: origem,
        retiroDestinoId: destino,
        quantidade: -1,
        tipoAcao: "envio",
      }),
    ).toThrow(InventarioContratoError);
  });

  test("recusa transferencia para o proprio retiro de origem", () => {
    expect(() =>
      criarTransferenciaEstoque({
        id,
        retiroOrigemId: origem,
        retiroDestinoId: origem,
        quantidade: 5,
        tipoAcao: "solicitacao",
      }),
    ).toThrow(InventarioContratoError);
  });
});