import { fetchPdfBinaryWithTimeout } from "@/lib/reportPdfExport";
import jsPDF from "jspdf";
import { translatePdfLabel } from "@/lib/pdfUiLabels";
import type { SiteLanguage } from "@/lib/siteLanguage";

const GREEN_DARK = "#14432B";
const GREEN = "#1F7A4D";
const GOLD = "#C9A84C";
const INK = "#1C1C1A";
const INK_SOFT = "#767066";
const LINE = "#E7E3D6";

export interface ServicoPdfItem {
  descricao: string;
  tipo_item: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}
export interface ServicoPdfData {
  /** Selected App language; defaults to pt-BR. */
  language?: SiteLanguage;
  numero: string;
  data_referencia: string;
  data_vencimento?: string | null;
  empresa: { nome: string; cnpj?: string | null };
  veterinario: { nome: string; telefone?: string | null };
  fazenda: { nome: string; proprietario?: string | null; municipio?: string | null; estado?: string | null };
  periodo?: { inicio: string; fim: string } | null;
  estacao?: string | null;
  modelo_cobranca: string;
  itens: ServicoPdfItem[];
  valor_total: number;
  km_total?: number | null;
  animais_atendidos?: number | null;
  observacoes?: string | null;
}

function fmtBRL(n: number, language: SiteLanguage = "pt-BR") {
  return n.toLocaleString(language, { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string, language: SiteLanguage = "pt-BR") {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return language === "en-US" ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
}

async function loadLogo(): Promise<string | null> {
  try {
    const url = "/lovable-uploads/consubov-logo.png";
    const blob = await fetchPdfBinaryWithTimeout(url);
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function gerarServicoPDF(data: ServicoPdfData): Promise<Blob> {
  const language = data.language ?? "pt-BR";
  const tr = (source: string) => translatePdfLabel(language, source);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 40;

  // Cabeçalho
  doc.setFillColor(GREEN_DARK);
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, 90, pageW, 4, "F");

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(tr("Relatório de Serviço"), marginX, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nº ${data.numero}`, marginX, 58);
  doc.text(`${tr("Emissão:")} ${fmtDate(data.data_referencia, language)}`, marginX, 72);
  if (data.data_vencimento) doc.text(`${tr("Vencimento:")} ${fmtDate(data.data_vencimento, language)}`, marginX + 180, 72);

  // Empresa (right)
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.empresa.nome, pageW - marginX, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.empresa.cnpj) doc.text(data.empresa.cnpj, pageW - marginX, 54, { align: "right" });
  doc.text(data.veterinario.nome, pageW - marginX, 68, { align: "right" });
  if (data.veterinario.telefone) doc.text(data.veterinario.telefone, pageW - marginX, 80, { align: "right" });

  y = 120;
  doc.setTextColor(INK);

  // Bloco Fazenda / Período
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(tr("Cliente / Fazenda"), marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`${tr("Fazenda:")} ${data.fazenda.nome}`, marginX, y); y += 13;
  if (data.fazenda.proprietario) { doc.text(`${tr("Proprietário:")} ${data.fazenda.proprietario}`, marginX, y); y += 13; }
  if (data.fazenda.municipio || data.fazenda.estado) {
    doc.text(`${tr("Local:")} ${[data.fazenda.municipio, data.fazenda.estado].filter(Boolean).join(" / ")}`, marginX, y); y += 13;
  }
  if (data.periodo) { doc.text(`${tr("Período:")} ${fmtDate(data.periodo.inicio, language)}${tr(" a ")}${fmtDate(data.periodo.fim, language)}`, marginX, y); y += 13; }
  if (data.estacao) { doc.text(`${tr("Estação de Monta:")} ${data.estacao}`, marginX, y); y += 13; }
  doc.text(`${tr("Modelo de cobrança:")} ${tr(data.modelo_cobranca === "protocolo_completo" ? "Protocolo Completo" : "Mão de Obra + Km")}`, marginX, y); y += 20;

  // Tabela de itens
  doc.setFillColor(GREEN);
  doc.rect(marginX, y, pageW - marginX * 2, 22, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text(tr("Descrição"), marginX + 8, y + 15);
  doc.text(tr("Qtd"), marginX + 320, y + 15, { align: "right" });
  doc.text(tr("Unitário"), marginX + 400, y + 15, { align: "right" });
  doc.text(tr("Total"), pageW - marginX - 8, y + 15, { align: "right" });
  y += 22;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");

  const rowH = 20;
  for (const it of data.itens) {
    if (y + rowH > pageH - 100) {
      doc.addPage();
      y = 40;
    }
    doc.setDrawColor(LINE);
    doc.line(marginX, y + rowH, pageW - marginX, y + rowH);
    const desc = doc.splitTextToSize(it.descricao || it.tipo_item, 300);
    doc.text(desc[0] ?? "", marginX + 8, y + 14);
    doc.text(String(it.quantidade), marginX + 320, y + 14, { align: "right" });
    doc.text(fmtBRL(it.valor_unitario, language), marginX + 400, y + 14, { align: "right" });
    doc.text(fmtBRL(it.valor_total, language), pageW - marginX - 8, y + 14, { align: "right" });
    y += rowH;
  }

  y += 10;
  // Totais
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.setFillColor(GREEN_DARK);
  doc.rect(pageW - marginX - 220, y, 220, 28, "F");
  doc.setTextColor("#FFFFFF");
  doc.text(tr("VALOR TOTAL"), pageW - marginX - 210, y + 18);
  doc.text(fmtBRL(data.valor_total, language), pageW - marginX - 8, y + 18, { align: "right" });
  y += 40;

  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  if (data.km_total != null) { doc.text(`${tr("Km percorrido no período:")} ${data.km_total.toFixed(2)} km`, marginX, y); y += 12; }
  if (data.animais_atendidos != null) { doc.text(`${tr("Animais atendidos:")} ${data.animais_atendidos}`, marginX, y); y += 12; }

  if (data.observacoes) {
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text(tr("Observações"), marginX, y); y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.observacoes, pageW - marginX * 2);
    doc.text(lines, marginX, y);
    y += lines.length * 12;
  }

  // Rodapé
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  doc.text(tr("Gerado por Consubov.com.br"), marginX, pageH - 20);
  doc.text(new Date().toLocaleString(language), pageW - marginX, pageH - 20, { align: "right" });

  return doc.output("blob");
}
