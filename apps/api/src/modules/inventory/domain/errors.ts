export type InventarioCodigoErro =
  | "MES_INVALIDO"
  | "ANO_INVALIDO"
  | "TRANSFERENCIA_INVALIDA";

/**
 * Falha de contrato do módulo de inventário: o valor rejeitado violaria um CHECK
 * que já existe na base, não uma regra nova.
 */
export class InventarioContratoError extends Error {
  readonly codigo: InventarioCodigoErro;

  constructor(codigo: InventarioCodigoErro, mensagem: string) {
    super(mensagem);
    this.name = "InventarioContratoError";
    this.codigo = codigo;
  }
}