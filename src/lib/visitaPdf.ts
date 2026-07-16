import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/consubov-logo-preta.jpeg.asset.json";

const BUCKET_FOTOS = "visitas-consultor-fotos";
const BUCKET_RELATORIOS = "relatorios";

const GREEN_DARK = "#14432B";
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
  categoria?: string | null;
  peso_medio_kg?: number | null;
  consumo_esperado_kg?: number | null;
  consumo_real_kg?: number | null;
  observacao: string | null;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  fotos: { id: string; url: string; ordem: number }[];
}

export interface VisitaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  observacoes_gerais: string | null;
  conclusao: string | null;
  objetivo_visita?: string | null;
  resumo_executivo?: string | null;
  indicadores_gerais?: string | null;
  indicadores_tabela?: { key: string; label: string; value: string }[];
  topicos?: { id: string; titulo: string; texto: string | null; ordem: number;
    fotos: { id: string; url: string; ordem: number; signedUrl?: string }[] }[];
  pastos: VisitaPdfPasto[];
  logoOverride?: { esquerdaPath: string | null; direitaPath: string | null } | null;
}

async function compressImageBlob(blob: Blob, maxDim = 1280, quality = 0.72): Promise<string> {
  const bitmapUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = bitmapUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no ctx");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

async function fetchFotoDataUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET_FOTOS).createSignedUrl(path, 60 * 60);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await compressImageBlob(blob);
  } catch { return null; }
}

async function fetchAssetDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const BUCKET_LOGOS = "logos-consultor";
async function fetchLogoDataUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  try {
    // Se já vier como URL absoluta, baixa direto; senão trata como path no bucket privado.
    let res: Response;
    if (/^https?:\/\//i.test(path)) {
      res = await fetch(path);
    } else {
      const { data } = await supabase.storage.from(BUCKET_LOGOS).createSignedUrl(path, 60 * 60);
      if (!data?.signedUrl) return null;
      res = await fetch(data.signedUrl);
    }
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
  doc.text("Gerado por Consubov.com.br", 15, h - 6);
  doc.text(`Página ${page} de ${totalPages}`, w - 15, h - 6, { align: "right" });
}

function drawCoverHeader(
  doc: jsPDF,
  logoDataUrl: string | null,
  subtitle: string,
  logoOverride?: { modo: 'padrao' | 'substituir' | 'adicionar'; dataUrl: string | null } | null,
) {
  const w = doc.internal.pageSize.getWidth();
  const headerH = 32;
  const logoH = 16;
  const logoW = 44;
  const logoX = 15;
  const logoY = 10;

  const modo = logoOverride?.modo ?? 'padrao';
  const customUrl = logoOverride?.dataUrl ?? null;

  // Left logo
  const leftLogo = modo === 'substituir' && customUrl ? customUrl : logoDataUrl;
  if (leftLogo) {
    try { doc.addImage(leftLogo, "PNG", logoX, logoY, logoW, logoH); } catch { /* ignore */ }
  }

  // Right logo (only 'adicionar')
  if (modo === 'adicionar' && customUrl) {
    const rightX = w - 15 - logoW;
    try { doc.addImage(customUrl, "PNG", rightX, logoY, logoW, logoH); } catch { /* ignore */ }
  }

  // Linha vertical fina verde
  const dividerX = logoX + logoW + 6;
  doc.setDrawColor(GREEN_DARK);
  doc.setLineWidth(0.8);
  doc.line(dividerX, logoY, dividerX, logoY + logoH);

  // eyebrow + título
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("RELATÓRIO TÉCNICO", dividerX + 4, logoY + 6);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(subtitle, dividerX + 4, logoY + 14);

  // linha divisória abaixo do header
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.line(15, headerH + 4, w - 15, headerH + 4);
}

function drawFarmBlock(doc: jsPDF, data: VisitaPdfData, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.fazenda.nome_fazenda || "—", 15, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(INK_SOFT);
  const loc = [data.fazenda.proprietario, data.fazenda.municipio, data.fazenda.uf].filter(Boolean).join(" · ");
  if (loc) doc.text(loc, 15, y + 6);

  const boxY = y + 12;
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
    doc.roundedRect(x, boxY, boxW, 18, 2, 2, "S");
    doc.setFontSize(7);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(b.label, x + 3, boxY + 6);
    doc.setFontSize(10);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(b.value, x + 3, boxY + 13);
  });
  return boxY + 24;
}

function drawIntroBlock(doc: jsPDF, title: string, text: string, y: number): number {
  const w = doc.internal.pageSize.getWidth() - 30;
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, y, 2.5, 6, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), 20, y + 4.5);
  doc.setTextColor(INK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, 15, y + 11);
  return y + 11 + lines.length * 4.6 + 4;
}

async function drawPastoBlock(
  doc: jsPDF, pasto: VisitaPdfPasto, fotosCache: Record<string, string | null>,
  x: number, y: number, width: number, height: number,
) {
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 2, 2, "S");

  doc.setFillColor(GREEN_DARK);
  doc.circle(x + 10, y + 10, 6, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pasto.letra || "?", x + 10, y + 12, { align: "center" });

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Pasto ${pasto.num_pasto || "—"}`, x + 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(INK_SOFT);
  const sub = [
    pasto.categoria || null,
    `${pasto.qtd_animais ?? "—"} animais`,
    pasto.peso_medio_kg ? `${pasto.peso_medio_kg} kg/cab` : null,
  ].filter(Boolean).join(" · ");
  doc.text(sub, x + 20, y + 13);

  doc.setDrawColor(LINE);
  doc.line(x + 3, y + 18, x + width - 3, y + 18);

  const real = pasto.consumo_real_kg ?? pasto.consumo_kg_dia ?? 0;
  const esp = pasto.consumo_esperado_kg ?? 0;
  const indice = real > 0 && esp > 0 ? (real / esp) * 100 : 0;
  const pesoVivoTotal = (pasto.qtd_animais || 0) * (pasto.peso_medio_kg || 0);

  const lineY = y + 24;
  const cellW = (width - 6) / 3;
  const cells = [
    { label: "PRODUTO", value: pasto.tipo_produto ? (PRODUTO_LABEL[pasto.tipo_produto] || pasto.tipo_produto) : "—" },
    { label: "% PV", value: pasto.percentual_pv || "—" },
    { label: "PESO VIVO TOTAL", value: pesoVivoTotal > 0 ? `${pesoVivoTotal.toLocaleString("pt-BR")} kg` : "—" },
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

  const lineY2 = y + 34;
  const cells2 = [
    { label: "CONSUMO ESPERADO", value: esp > 0 ? `${esp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg/dia` : "—" },
    { label: "CONSUMO REAL", value: real > 0 ? `${real.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg/dia` : "—" },
    { label: "ÍNDICE / META", value: indice > 0 ? `${indice.toFixed(1)}%` : "—" },
  ];
  cells2.forEach((c, i) => {
    const cx = x + 3 + i * cellW;
    doc.setFontSize(6.5);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.text(c.label, cx, lineY2);
    doc.setFontSize(9);
    doc.setTextColor(INK);
    doc.setFont("helvetica", "bold");
    doc.text(c.value, cx, lineY2 + 5);
  });

  const scoreY = y + 46;
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
    const dotY = scoreY + 4;
    const dotR = 1.6;
    const gap = 4.5;
    const notaInt = nota ? Math.round(nota) : null;
    for (let n = 1; n <= 5; n++) {
      const dx = cx + 2 + (n - 1) * gap;
      if (notaInt && n <= notaInt) doc.setFillColor(GOLD);
      else doc.setFillColor("#E7E3D6");
      doc.circle(dx, dotY, dotR, "F");
    }
    if (nota) {
      doc.setFontSize(7);
      doc.setTextColor(GREEN_DARK);
      doc.setFont("helvetica", "bold");
      doc.text(nota.toFixed(1), cx + 2 + 5 * gap + 2, dotY + 1.2);
    }
  });

  if (pasto.observacao) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK_SOFT);
    doc.text("OBSERVAÇÃO", x + 3, y + 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(pasto.observacao, width - 6);
    doc.text(lines.slice(0, 2), x + 3, y + 63);
  }

  const fotosStartY = y + 72;
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
  doc.setFillColor(GREEN_DARK);
  doc.rect(x, y, 3, 8, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), x + 6, y + 6);

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

  const logoDataUrl = await fetchAssetDataUrl(logoAsset.url);
  const customLogoDataUrl = data.logoOverride && data.logoOverride.modo !== 'padrao'
    ? await fetchLogoDataUrl(data.logoOverride.path)
    : null;
  const logoOverride = data.logoOverride
    ? { modo: data.logoOverride.modo, dataUrl: customLogoDataUrl }
    : null;
  const fotosCache: Record<string, string | null> = {};
  const allFotos = data.pastos.flatMap(p => p.fotos.slice(0, 5));
  const allTopicoFotos = (data.topicos || []).flatMap(t => t.fotos.slice(0, 5));
  await Promise.all([
    ...allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }),
    ...allTopicoFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }),
  ]);

  // PAGE 1 — cover header claro + fazenda + intro blocks
  drawCoverHeader(doc, logoDataUrl, "Visita Técnica - Rotina", logoOverride);
  let y = drawFarmBlock(doc, data, 50);

  const drawTabela = () => {
    const tabela = (data.indicadores_tabela || []).filter(r => (r.value || "").trim() && r.value !== "—");
    if (!tabela.length) return;
    if (y > pageH - (14 + tabela.length * 7)) { doc.addPage(); y = 20; }
    doc.setFillColor(GREEN_DARK);
    doc.rect(15, y, 2.5, 6, "F");
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("INDICADORES GERAIS DA FAZENDA", 20, y + 4.5);
    y += 10;
    const wTable = pageW - 30;
    const labelW = wTable * 0.55;
    const rowH = 7;
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    tabela.forEach((r, i) => {
      if (i % 2 === 0) { doc.setFillColor("#FAF8F0"); doc.rect(15, y, wTable, rowH, "F"); }
      doc.setTextColor(INK);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(r.label, 18, y + 4.8);
      doc.setFont("helvetica", "bold");
      const lines = doc.splitTextToSize(r.value, wTable - labelW - 6);
      doc.text(lines[0] || "—", 15 + labelW, y + 4.8);
      doc.line(15, y + rowH, 15 + wTable, y + rowH);
      y += rowH;
    });
    y += 6;
  };

  const drawTopico = (titulo: string, texto: string | null, fotos: { id: string; ordem: number }[]) => {
    const t = (texto || "").trim();
    if (!titulo.trim() && !t && fotos.length === 0) return;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    if (titulo.trim() || t) {
      y = drawIntroBlock(doc, titulo || "—", t || "—", y);
    }
    if (fotos.length > 0) {
      const wArea = pageW - 30;
      const cols = 5;
      const gap = 2;
      const fw = (wArea - (cols - 1) * gap) / cols;
      const fh = fw;
      if (y + fh > pageH - 20) { doc.addPage(); y = 20; }
      for (let i = 0; i < Math.min(fotos.length, cols); i++) {
        const fx = 15 + i * (fw + gap);
        const foto = fotos[i];
        const dataUrl = fotosCache[foto.id];
        if (dataUrl) {
          try {
            const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(dataUrl, fmt, fx, y, fw, fh, undefined, "FAST");
          } catch {
            doc.setDrawColor(LINE); doc.rect(fx, y, fw, fh);
          }
        } else {
          doc.setFillColor("#F3F1E8"); doc.rect(fx, y, fw, fh, "F");
        }
      }
      y += fh + 6;
    } else {
      y += 2;
    }
  };

  if (data.topicos && data.topicos.length > 0) {
    const sorted = [...data.topicos].sort((a, b) => a.ordem - b.ordem);
    const fixos = sorted.filter(t => t.ordem <= 3);
    const customs = sorted.filter(t => t.ordem >= 5);
    for (const t of fixos) drawTopico(t.titulo, t.texto, t.fotos);
    drawTabela();
    for (const t of customs) drawTopico(t.titulo, t.texto, t.fotos);
  } else {
    const intros: [string, string | null | undefined][] = [
      ["Objetivo da Visita", data.objetivo_visita],
      ["Resumo Executivo", data.resumo_executivo],
      ["Indicadores Gerais", data.indicadores_gerais],
    ];
    for (const [title, txt] of intros) {
      const t = (txt || "").trim();
      if (!t) continue;
      if (y > pageH - 60) { doc.addPage(); y = 20; }
      y = drawIntroBlock(doc, title, t, y);
    }
    drawTabela();
  }



  // PAGES: 2 pastos por página — cabeçalho enxuto só com nome da fazenda
  const pastosPorPagina = 2;
  const blockHeight = 100;
  const gap = 8;

  for (let i = 0; i < data.pastos.length; i += pastosPorPagina) {
    doc.addPage();
    const pair = data.pastos.slice(i, i + pastosPorPagina);
    doc.setTextColor(INK_SOFT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.fazenda.nome_fazenda || "", 15, 12);
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.4);
    doc.line(15, 16, pageW - 15, 16);

    let py = 24;
    for (const p of pair) {
      await drawPastoBlock(doc, p, fotosCache, 15, py, pageW - 30, blockHeight);
      py += blockHeight + gap;
    }
  }

  // ÚLTIMA PÁGINA: encerramento (footer topicos) + assinatura
  doc.addPage();
  doc.setTextColor(INK_SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.fazenda.nome_fazenda || "", 15, 12);
  doc.setDrawColor(LINE);
  doc.line(15, 16, pageW - 15, 16);

  let fy = 26;
  const footer = (data.topicos || []).filter(t => t.ordem >= 1001).sort((a,b)=>a.ordem-b.ordem);
  if (footer.length > 0) {
    for (const t of footer) {
      if (fy > pageH - 80) { doc.addPage(); fy = 20; }
      fy = drawTextBlock(doc, t.titulo || "—", t.texto || "—", fy);
      if (t.fotos.length > 0) {
        const wArea = pageW - 30;
        const cols = 5;
        const gap = 2;
        const fw = (wArea - (cols - 1) * gap) / cols;
        const fh = fw;
        if (fy + fh > pageH - 60) { doc.addPage(); fy = 20; }
        fy += 4;
        for (let i = 0; i < Math.min(t.fotos.length, cols); i++) {
          const fx = 15 + i * (fw + gap);
          const dataUrl = fotosCache[t.fotos[i].id];
          if (dataUrl) {
            try {
              const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(dataUrl, fmt, fx, fy, fw, fh, undefined, "FAST");
            } catch {
              doc.setDrawColor(LINE); doc.rect(fx, fy, fw, fh);
            }
          } else {
            doc.setFillColor("#F3F1E8"); doc.rect(fx, fy, fw, fh, "F");
          }
        }
        fy += fh + 6;
      }
      fy += 6;
    }
  } else {
    fy = drawTextBlock(doc, "Observações Gerais", data.observacoes_gerais || "—", fy);
    fy = Math.max(fy + 8, 130);
    drawTextBlock(doc, "Conclusão da Visita", data.conclusao || "—", fy);
  }

  const sigY = pageH - 40;
  doc.setDrawColor(INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.setTextColor(INK_SOFT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.consultor.nome || "Consultor", pageW / 2, sigY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Consultor Técnico", pageW / 2, sigY + 10, { align: "center" });

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
  blob: Blob, fileName: string, consultorId: string, visitaId: string,
): Promise<string> {
  const path = `visitas-consultor/${consultorId}/${visitaId}/${fileName}`;
  const { error } = await supabase.storage
    .from(BUCKET_RELATORIOS)
    .upload(path, blob, { upsert: true, contentType: "application/pdf" });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_RELATORIOS).getPublicUrl(path);
  return data.publicUrl;
}

// ============================================================================
// FÁBRICA — template isolado (Round 8, PDF novo)
// ============================================================================

export interface VisitaFabricaPdfData {
  visitaId: string;
  fazenda: { nome_fazenda: string; proprietario?: string | null; municipio?: string | null; uf?: string | null };
  consultor: { nome: string };
  hora_inicio: string;
  hora_fim: string | null;
  quesitos: { chave: string; rotulo: string; nota: number | null }[];
  topicos: { id: string; titulo: string; texto: string | null; ordem: number;
    fotos: { id: string; url: string; ordem: number }[] }[];
  numeroMap?: Record<string, number>;
  logoOverride?: { modo: 'padrao' | 'substituir' | 'adicionar'; path: string | null } | null;
}

function drawNumeroBadge(doc: jsPDF, x: number, y: number, n: number) {
  const r = 3.4;
  doc.setFillColor(GREEN_DARK);
  doc.circle(x + r, y + r, r, "F");
  doc.setTextColor(GOLD);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(String(n), x + r, y + r + 2.2, { align: "center" });
}

export async function generateFabricaPdf(data: VisitaFabricaPdfData): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logoDataUrl = await fetchAssetDataUrl(logoAsset.url);
  const customLogoDataUrl = data.logoOverride && data.logoOverride.modo !== 'padrao'
    ? await fetchLogoDataUrl(data.logoOverride.path)
    : null;
  const logoOverride = data.logoOverride
    ? { modo: data.logoOverride.modo, dataUrl: customLogoDataUrl }
    : null;

  const fotosCache: Record<string, string | null> = {};
  const allFotos = (data.topicos || []).flatMap(t => t.fotos.slice(0, 5));
  await Promise.all(allFotos.map(async f => { fotosCache[f.id] = await fetchFotoDataUrl(f.url); }));

  // PAGE 1
  drawCoverHeader(doc, logoDataUrl, "Visita Técnica - Fábrica", logoOverride);
  let y = drawFarmBlock(doc, {
    fazenda: data.fazenda, consultor: data.consultor,
    hora_inicio: data.hora_inicio, hora_fim: data.hora_fim,
    visitaId: data.visitaId, observacoes_gerais: null, conclusao: null, pastos: [],
  } as VisitaPdfData, 50);

  // Bloco Avaliação
  if (y > pageH - 70) { doc.addPage(); y = 20; }
  doc.setFillColor(GREEN_DARK);
  doc.rect(15, y, 2.5, 6, "F");
  doc.setTextColor(GREEN_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("AVALIAÇÃO DA FÁBRICA", 20, y + 4.5);
  y += 10;

  const wTable = pageW - 30;
  const labelW = wTable * 0.62;
  const rowH = 8;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  const notaValida = data.quesitos.filter(q => q.nota != null);
  const media = notaValida.length
    ? notaValida.reduce((s, q) => s + (q.nota || 0), 0) / notaValida.length
    : 0;
  data.quesitos.forEach((q, i) => {
    if (y + rowH > pageH - 30) { doc.addPage(); y = 20; }
    if (i % 2 === 0) { doc.setFillColor("#FAF8F0"); doc.rect(15, y, wTable, rowH, "F"); }
    doc.setTextColor(INK);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(q.rotulo, 18, y + 5.4);
    // rating boxes 1..5
    const bxSize = 5.2;
    const gap = 1.4;
    const groupW = 5 * bxSize + 4 * gap;
    const bxStart = 15 + labelW + (wTable - labelW - groupW - 4);
    for (let n = 1; n <= 5; n++) {
      const bx = bxStart + (n - 1) * (bxSize + gap);
      const by = y + (rowH - bxSize) / 2;
      const active = q.nota === n;
      doc.setDrawColor(active ? GREEN_DARK : LINE);
      doc.setFillColor(active ? GREEN_DARK : "#FFFFFF");
      doc.roundedRect(bx, by, bxSize, bxSize, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(active ? GOLD : INK_SOFT);
      doc.text(String(n), bx + bxSize / 2, by + bxSize / 2 + 1.4, { align: "center" });
    }
    doc.setDrawColor(LINE);
    doc.line(15, y + rowH, 15 + wTable, y + rowH);
    y += rowH;
  });

  if (notaValida.length) {
    y += 4;
    doc.setTextColor(GREEN_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Média geral: ${media.toFixed(1)}/5  ·  ${notaValida.length}/${data.quesitos.length} quesitos avaliados`, 15, y);
    y += 8;
  } else {
    y += 6;
  }

  // Tópicos (custom + footer inline)
  const sortedTopicos = [...(data.topicos || [])].sort((a, b) => a.ordem - b.ordem);
  for (const t of sortedTopicos) {
    const tx = (t.texto || "").trim();
    if (!t.titulo.trim() && !tx && t.fotos.length === 0) continue;
    if (y > pageH - 60) { doc.addPage(); y = 20; }
    if (t.titulo.trim() || tx) {
      y = drawIntroBlock(doc, t.titulo || "—", tx || "—", y);
    }
    if (t.fotos.length > 0) {
      const wArea = pageW - 30;
      const cols = 5;
      const gap = 2;
      const fw = (wArea - (cols - 1) * gap) / cols;
      const fh = fw;
      if (y + fh > pageH - 20) { doc.addPage(); y = 20; }
      for (let i = 0; i < Math.min(t.fotos.length, cols); i++) {
        const fx = 15 + i * (fw + gap);
        const foto = t.fotos[i];
        const dataUrl = fotosCache[foto.id];
        if (dataUrl) {
          try {
            const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
            doc.addImage(dataUrl, fmt, fx, y, fw, fh, undefined, "FAST");
          } catch {
            doc.setDrawColor(LINE); doc.rect(fx, y, fw, fh);
          }
        } else {
          doc.setFillColor("#F3F1E8"); doc.rect(fx, y, fw, fh, "F");
        }
        // Numeração global
        const n = data.numeroMap?.[foto.id];
        if (n != null) drawNumeroBadge(doc, fx + 1.5, y + 1.5, n);
      }
      y += fh + 6;
    } else {
      y += 2;
    }
  }

  // Assinatura
  const sigY = pageH - 40;
  doc.setDrawColor(INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 40, sigY, pageW / 2 + 40, sigY);
  doc.setTextColor(INK_SOFT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.consultor.nome || "Consultor", pageW / 2, sigY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text("Consultor Técnico", pageW / 2, sigY + 10, { align: "center" });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total);
  }

  const blob = doc.output("blob");
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  const safeName = (data.fazenda.nome_fazenda || "fazenda").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const fileName = `fabrica-${safeName}-${stamp}.pdf`;
  return { blob, fileName };
}
