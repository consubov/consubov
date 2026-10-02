import { VisitaDominioError } from "./erros";
import type { VisitaErroCodigo } from "./erros";

export type VisitaId = string & { readonly __brand: "VisitaId" };
export type AssinanteId = string & { readonly __brand: "AssinanteId" };

// Mesmo limite de tamanho adotado pelo dono das identidades
// (apps/api/src/modules/identity-tenancy/domain/identity.ts:21).
const MAX_IDENTIFIER_LENGTH = 128;

function normalizarIdObrigatorio(
  value: string,
  codigo: VisitaErroCodigo,
  label: string,
): string {
  const normalizado = value.trim();

  if (!normalizado || normalizado.length > MAX_IDENTIFIER_LENGTH) {
    throw new VisitaDominioError(
      codigo,
      `${label} must be non-empty and at most ${MAX_IDENTIFIER_LENGTH} characters.`,
    );
  }

  return normalizado;
}

export function createVisitaId(value: string): VisitaId {
  return normalizarIdObrigatorio(value, "VISITA_ID_INVALIDO", "Visita id") as VisitaId;
}

export function createAssinanteId(value: string): AssinanteId {
  return normalizarIdObrigatorio(
    value,
    "ASSINANTE_ID_INVALIDO",
    "Assinante id",
  ) as AssinanteId;
}