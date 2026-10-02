import { InventarioContratoError } from "./errors";

/**
 * Bucket (mês/ano) do estoque. `estoque_retiro` é materializado por período com
 * UNIQUE (retiro_id, mes, ano): o saldo NÃO é derivado de entradas − saídas
 * (migration 20260408120801:3-13).
 */
export type BucketPeriodo = {
  readonly mes: number;
  readonly ano: number;
};

export const MES_MINIMO = 1;
export const MES_MAXIMO = 12;
export const ANO_MINIMO = 2020;
export const ANO_MAXIMO = 2100;

/**
 * Janela fixa do consumo médio: a soma de `lancamentos.num_sacos` dos últimos
 * 30 dias dividida por 30 (useEstoqueData.ts:77-78, :95).
 */
export const JANELA_CONSUMO_DIAS = 30;

export function criarBucketPeriodo(mes: number, ano: number): BucketPeriodo {
  if (!Number.isInteger(mes) || mes < MES_MINIMO || mes > MES_MAXIMO) {
    throw new InventarioContratoError(
      "MES_INVALIDO",
      `Mês do bucket deve estar entre ${MES_MINIMO} e ${MES_MAXIMO}.`,
    );
  }

  if (!Number.isInteger(ano) || ano < ANO_MINIMO || ano > ANO_MAXIMO) {
    throw new InventarioContratoError(
      "ANO_INVALIDO",
      `Ano do bucket deve estar entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`,
    );
  }

  return { mes, ano };
}

export function mesmoBucket(a: BucketPeriodo, b: BucketPeriodo): boolean {
  return a.mes === b.mes && a.ano === b.ano;
}