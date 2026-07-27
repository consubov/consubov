import type jsPDF from "jspdf";

const INK_SOFT = "#767066";

export interface PdfAssinante {
  nome: string;
  cargo_funcao: string;
}

/**
 * Desenha o bloco de assinatura na última página do PDF (módulo Consultor).
 * - 1 assinante  → linha horizontal + nome + cargo (formato clássico)
 * - >1 assinantes → sem linha, apenas lista "Nome, Cargo/Função" (um por linha)
 */
export function drawAssinaturas(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  assinantes: PdfAssinante[] | undefined,
  consultorNomeFallback: string,
) {
  const filtrados = (assinantes || []).filter(a => (a?.nome || "").trim());
  const lista: PdfAssinante[] = filtrados.length > 0
    ? filtrados
    : [{ nome: consultorNomeFallback || "Consultor", cargo_funcao: "Consultor Técnico" }];

  if (lista.length === 1) {
    const sigY = pageH - 40;
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
  let y = pageH - 20 - totalH;
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const a of lista) {
    const line = `${a.nome}, ${a.cargo_funcao || "Consultor Técnico"}`;
    doc.text(line, pageW / 2, y, { align: "center" });
    y += lineH;
  }
}
