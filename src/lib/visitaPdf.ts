import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const BUCKET_FOTOS = "visitas-consultor-fotos";
const BUCKET_RELATORIOS = "relatorios";

// Palette
const GREEN_DARK = "#14432B";
const GREEN_MED = "#1F7A4D";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

const PRODUTO_LABEL: Record<string, string> = {
  mineral: "Mineral",
  racao: "Ração",
  "proteinado_0.1": "Proteinado 0,1%",
  "proteinado_0.3": "Proteinado 0,3%",
  "proteinado_0.5": "Proteinado 0,5%",
  "proteinado_1": "Proteinado 1%",
  outro: "Outro",
};

export interface VisitaPdfPasto {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  observacao: string | null;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  fotos: { id: string; url: string; ordem: number }[]; // url = storage path
}

export interface VisitaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  pastos: VisitaPdfPasto[];
  fazendaId?: string; // for storage path
  consultorId?: string;
}

async function fetchFotoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawFooter(doc: jsPDF, page: number, totalPages: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(15, h - 12, w - 15, h - 12);
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text("Gerado por Consubov", 15, h - 6);
  doc.text(`Página ${page} de ${totalPages}`, w - 15, h - 6, { align: "right" });
}

function drawHeaderPage1(doc: jsPDF, data: VisitaPdfData) {
  const w = doc.internal.pageSize.getWidth();
  // banner
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, w, 60, "F");

  // Logo mark
  doc.setFillColor(GOLD);
  doc.roundedRect(15, 15, 14, 14, 2, 2, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("C", 22, 25, { align: "center" });

  // Title
  doc.setTextColor("#FFFFFF");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("RELATÓRIO DE VISITA TÉCNICA", 34, 20);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Consubov Consultoria", 34, 27);

  // Farm block
  doc.setFontSize(20);
  doc.text(data.fazenda.nome_fazenda || "—", 15, 48);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#E7E3D6");
  const loc = [data.fazenda.proprietario, data.fazenda.municipio, data.fazenda.uf].filter(Boolean).join(" · ");
  if (loc) doc.text(loc, 15, 55);

  // Info grid
  doc.setTextColor(INK);
  const y = 75;
  const boxW = (w - 30 - 10) / 3;
  const boxes = [
    { label: "CONSULTOR", value: data.consultor.nome || "—" },
    { label: "INÍCIO", value: format(new Date(data.hora_inicio), "dd/MM/yyyy HH:mm", { locale: ptBR }) },
    { label: "TÉRMINO", value: data.hora_fim ? format(new Date(data.hora_fim), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—" },
  ];
  boxes.forEach((b, i) => {
    const x = 15 + i * (boxW + 5);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "S");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, x + 3, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value, x + 3, y + 13);
  });

  // Summary
  doc.setFontSize(9);
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Total de pastos avaliados: ${data.pastos.length}`,
    15,
    y + 30,
  );
}

async function drawPastoBlock(
  doc: jsPDF,
  pasto: VisitaPdfPasto,
  fotosCache: Record<string, string | null>,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // Card border
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  // Letter badge
  doc.setFillColor(GREEN_DARK);
  doc.circle(x + 10, y + 10, 6, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pasto.letra || "?", x + 10, y + 12, { align: "center" });

  // Title (num pasto + animais)
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Pasto ${pasto.num_pasto || "—"}`, x + 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(`${pasto.qtd_animais ?? "—"} animais`, x + 20, y + 13);

  // Divider
  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 18, x + width - 3, y + 18);

  // Produto / % PV / Consumo
  const lineY = y + 24;
  const cellW = (width - 6) / 3;
  const cells = [
    { label: "PRODUTO", value: pasto.tipo_produto ? (PRODUTO_LABEL[pasto.tipo_produto] || pasto.tipo_produto) : "—" },
    { label: "% PV", value: pasto.percentual_pv || "—" },
    { label: "CONSUMO", value: pasto.consumo_kg_dia ? `${pasto.consumo_kg_dia} kg/dia` : "—" },
  ];
  cells.forEach((c, i) => {
    const cx = x + 3 + i * cellW;
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(c.label, cx, lineY);
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(c.value, cx, lineY + 5);
  });

  // Scores (dots)
  const scoreY = y + 36;
  const scoreCellW = (width - 6) / 3;
  const scores: [string, number | undefined][] = [
    ["Fezes", pasto.scores.fezes],
    ["Corporal", pasto.scores.corporal],
    ["Bebedouro", pasto.scores.bebedouro],
  ];
  scores.forEach(([label, nota], i) => {
    const cx = x + 3 + i * scoreCellW;
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text(label.toUpperCase(), cx, scoreY);
    // 5 dots
    const dotY = scoreY + 4;
    const dotR = 1.6;
    const gap = 4.5;
    for (let n = 1; n <= 5; n++) {
      const dx = cx + 2 + (n - 1) * gap;
      if (nota && n <= nota) doc.setFillColor(GOLD);
      else doc.setFillColor("#E7E3D6");
      doc.circle(dx, dotY, dotR, "F");
    }
    if (nota) {
      doc.setFontSize(7);
      doc.setTextColor(GREEN_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(`${nota}/5`, cx + 2 + 5 * gap + 2, dotY + 1.2);
    }
  });

  // Observação
  if (pasto.observacao) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text("OBSERVAÇÃO", x + 3, y + 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(pasto.observacao, width - 6);
    doc.text(lines.slice(0, 2), x + 3, y + 55);
  }

  // Fotos grid (bottom)
  const fotosStartY = y + 66;
  const fotoAreaH = height - (fotosStartY - y) - 4;
  const cols = 5;
  const gap = 2;
  const fw = (width - 6 - (cols - 1) * gap) / cols;
  const fh = Math.min(fw, fotoAreaH);
  for (let i = 0; i < cols; i++) {
    const fx = x + 3 + i * (fw + gap);
    const foto = pasto.fotos[i];
    if (foto) {
      const dataUrl = fotosCache[foto.id];
      if (dataUrl) {
        try {
          const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, fx, fotosStartY, fw, fh, undefined, "FAST");
        } catch {
          doc.setDrawColor(LINE);
          doc.rect(fx, fotosStartY, fw, fh);
        }
      } else {
        doc.setFillColor("#F3F1E8");
        doc.rect(fx, fotosStartY, fw, fh, "F");
      }
    } else {
      doc.setDrawColor(LINE);
      doc.setFillColor("#FAF8F0");
      doc.roundedRect(fx, fotosStartY, fw, fh, 1, 1, "FD");
    }
  }
}

function drawTextBlock(doc: jsPDF, title: string, text: string, y: number, x = 15): number {
  const w = doc.internal.pageSize.getWidth() - 30;
  // Title bar
  doc.setFillColor(GREEN_DARK);
  doc.rect(x, y, 3, 8, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), x + 6, y + 6);

  // Body
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text || "—", w);
  doc.text(lines, x, y + 15);
  return y + 15 + lines.length * 4.8;
}

export async function generateVisitaPdf(data: VisitaPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Preload photos as data URLs
  const fotosCache: Record<string, string | null> = {};
  const allFotos = data.pastos.flatMap(p => p.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // PAGE 1: header
  drawHeaderPage1(doc, data);

  // PAGES: 2 pastos por página
  const pastosPorPagina = 2;
  const blockHeight = 100; // mm
  const gap = 8;

  for (let i = 0; i < data.pastos.length; i += pastosPorPagina) {
    doc.addPage();
    const pair = data.pastos.slice(i, i + pastosPorPagina);
    // Section header
    doc.setFillColor(GREEN_DARK);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor("#FFFFFF");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Avaliação de Pastos (${i + 1}–${i + pair.length} de ${data.pastos.length})`, 15, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor("#E7E3D6");
    doc.text(data.fazenda.nome_fazenda, pageW - 15, 12, { align: "right" });

    let y = 26;
    for (const p of pair) {
      await drawPastoBlock(doc, p, fotosCache, 15, y, pageW - 30, blockHeight);
      y += blockHeight + gap;
    }
  }

  // ÚLTIMA PÁGINA: observações + conclusão
  doc.addPage();
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Considerações Finais", 15, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#E7E3D6");
  doc.text(data.fazenda.nome_fazenda, pageW - 15, 12, { align: "right" });

  let y = 30;
  y = drawTextBlock(doc, "Observações Gerais", data.observacoes_gerais || "—", y);
  y = Math.max(y + 8, 130);
  drawTextBlock(doc, "Conclusão da Visita", data.conclusao || "—", y);

  // Signature line
  const sigY = pageH - 40;
  doc.setDrawColor(INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.setTextColor(INK_SOFT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.consultor.nome || "Consultor", pageW / 2, sigY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Consultor Técnico – Consubov", pageW / 2, sigY + 10, { align: "center" });

  // Footers em todas as páginas
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const blob = doc.output("blob");
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const safeName = (data.fazenda.nome_fazenda || "fazenda").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `visita-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}

export async function uploadVisitaPdf(
  blob: Blob,
  fileName: string,
  consultorId: string,
  visitaId: string,
): Promise<string> {
  const path = `visitas-consultor/${consultorId}/${visitaId}/${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET_RELATORIOS)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_RELATORIOS).getPublicUrl(path);
  return data.publicUrl;
}
