import type { VisitaStatus } from "./visita";

export type DecisaoAoEditarVisita =
  | { deveReabrir: false }
  | { deveReabrir: true; novoStatus: "revisao"; limparPdf: true };

/**
 * Qualquer edição de visita finalizada reabre para "revisao" e apaga o `pdf_url`
 * (apps/web/src/pages/RevisaoVisitaPage.tsx:492-495). A conferência do admin
 * aplica a mesma decisão e devolve false quando a visita não está finalizada
 * (apps/web/src/lib/conferenciaAdminVisita.ts:141-150).
 *
 * Reabertura não é o mesmo que finalização: o app não valida completude antes de
 * reabrir, e nada aqui presume o que precisa existir para finalizar.
 */
export function decisaoAoEditarVisita(statusAtual: VisitaStatus): DecisaoAoEditarVisita {
  if (statusAtual === "finalizada") {
    return { deveReabrir: true, novoStatus: "revisao", limparPdf: true };
  }

  return { deveReabrir: false };
}