import type jsPDF from "jspdf";

const INK_SOFT = "#767066";

export interface PdfAssinante {
  nome: string;
  cargo_funcao: string;
}

function resolverLista(
  assinantes: PdfAssinante[] | undefined,
  consultorNomeFallback: string,
): PdfAssinante[] {
  const filtrados = (assinantes || []).filter(a => (a?.nome || "").trim());
  return filtrados.length > 0
    ? filtrados
    : [{ nome: consultorNomeFallback || "Consultor", cargo_funcao: "Consultor Técnico" }];
}

/** Altura real (mm) que o bloco de assinatura ocupa — usado pelo motor de paginação. */
export function measureAssinaturas(
  assinantes: PdfAssinante[] | undefined,
  consultorNomeFallback: string,
): number {
  const lista = resolverLista(assinantes, consultorNomeFallback);
  // 1 assinante: linha + nome + cargo. N assinantes: uma linha de texto cada.
  return lista.length === 1 ? 18 : 6 + lista.length * 5;
}

/**
 * Desenha o bloco de assinatura (módulo Consultor).
 * - 1 assinante  → linha horizontal + nome + cargo (formato clássico)
 * - >1 assinantes → sem linha, apenas lista "Nome, Cargo/Função" (um por linha)
 * Sem `startY`, ancora no rodapé da página (comportamento legado).
 */
export function drawAssinaturas(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  assinantes: PdfAssinante[] | undefined,
  consultorNomeFallback: string,
  startY?: number,
) {
  const lista = resolverLista(assinantes, consultorNomeFallback);

  if (lista.length === 1) {
    const sigY = startY != null ? startY + 8 : pageH - 40;
    doc.setDrawColor(INK_SOFT);
    doc.setLineWidth(0.3);
    doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
    doc.setTextColor(INK_SOFT);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lista[0].nome, pageW / 2, sigY + 5, { align: "center" });
    doc.setFontSize(8);
    doc.text(lista[0].cargo_funcao || "Consultor Técnico", pageW / 2, sigY + 10, { align: "center" });
    return;
  }

  const lineH = 5;
  const totalH = lista.length * lineH;
  let y = startY != null ? startY + 8 : pageH - 20 - totalH;
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const a of lista) {
    const line = `${a.nome}, ${a.cargo_funcao || "Consultor Técnico"}`;
    doc.text(line, pageW / 2, y, { align: "center" });
    y += lineH;
  }
}

