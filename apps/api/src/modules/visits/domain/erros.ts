export type VisitaErroCodigo = "VISITA_ID_INVALIDO" | "ASSINANTE_ID_INVALIDO";

export class VisitaDominioError extends Error {
  readonly codigo: VisitaErroCodigo;

  constructor(codigo: VisitaErroCodigo, mensagem: string) {
    super(mensagem);
    this.name = "VisitaDominioError";
    this.codigo = codigo;
  }
}