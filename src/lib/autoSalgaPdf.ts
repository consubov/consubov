import { supabase } from "@/integrations/supabase/client";
import { gerarPdfSalga, type PastoSalgaRow, type SalgaPdfData } from "@/utils/gerarPdfSalga";
import { saveLastPdf, type LastPdfEntry } from "@/lib/offlineDb";

export interface AutoSalgaPdfArgs {
  fazendaId: string;
  fazendaNome: string;
  retiroId: string;
  retiroNome: string;
  /** ISO date — start of range (typically previous lastSyncedAt). If null, defaults to last 24h. */
  sinceIso: string | null;
  responsavelNome?: string | null;
}

export interface AutoSalgaPdfResult {
  blob: Blob;
  fileName: string;
  generatedAt: string;
  rangeStartIso: string;
  rangeEndIso: string;
  empty: boolean;
}

function deriveStatus(indice?: number | null, status?: string | null): "ABAIXO" | "IDEAL" | "ACIMA" | undefined {
  if (status) {
    const u = status.toUpperCase();
    if (u === "ABAIXO" || u === "IDEAL" || u === "ACIMA") return u;
  }
  if (indice == null || Number.isNaN(indice)) return undefined;
  if (indice < 0.85) return "ABAIXO";
  if (indice > 1.15) return "ACIMA";
  return "IDEAL";
}

function buildLabel(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  return `SYNC_${fmt(start)}_${fmt(end)}`;
}

/**
 * Generates a salga PDF covering the period since the given ISO timestamp,
 * stores the blob in IndexedDB under `last_pdf_{retiroId}`, and returns the blob/fileName.
 *
 * Safe to call after a successful sync. Returns `empty: true` (and skips storage)
 * when no salga rows were found in the range.
 */
export async function generateAndStoreSalgaPdf(args: AutoSalgaPdfArgs): Promise<AutoSalgaPdfResult> {
  const end = new Date();
  const start = args.sinceIso ? new Date(args.sinceIso) : new Date(end.getTime() - 24 * 60 * 60 * 1000);

  // Fetch salga lancamentos in range for this retiro
  const { data: lancData, error } = await supabase
    .from("lancamentos")
    .select("pasto_id, num_sacos, indice_consumo, status_consumo, cocho_cheio")
    .eq("retiro_id", args.retiroId)
    .eq("fazenda_id", args.fazendaId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  if (error) throw error;

  if (!lancData || lancData.length === 0) {
    return {
      blob: new Blob(),
      fileName: "",
      generatedAt: end.toISOString(),
      rangeStartIso: start.toISOString(),
      rangeEndIso: end.toISOString(),
      empty: true,
    };
  }

  // Aggregate per pasto
  const sacosMap: Record<string, number> = {};
  const indiceMap: Record<string, number[]> = {};
  const statusMap: Record<string, string | null> = {};
  const cochoMap: Record<string, number> = {};
  for (const l of lancData) {
    sacosMap[l.pasto_id] = (sacosMap[l.pasto_id] || 0) + (l.num_sacos || 0);
    if ((l as any).cocho_cheio) cochoMap[l.pasto_id] = (cochoMap[l.pasto_id] || 0) + 1;
    if (l.indice_consumo != null) {
      (indiceMap[l.pasto_id] ||= []).push(Number(l.indice_consumo));
    }
    // Last-seen status (rows are unsorted; that's fine for a snapshot)
    if (l.status_consumo) statusMap[l.pasto_id] = l.status_consumo;
  }

  const pastoIds = Object.keys(sacosMap);
  const { data: pastosData } = await supabase
    .from("pastos")
    .select("id, nome, num_animais, peso_medio_kg")
    .in("id", pastoIds);

  const rows: PastoSalgaRow[] = (pastosData || []).map((p) => {
    const indices = indiceMap[p.id] || [];
    const avgIndice = indices.length > 0 ? indices.reduce((a, b) => a + b, 0) / indices.length : null;
    return {
      nome: p.nome,
      numAnimais: p.num_animais || 0,
      pesoMedioKg: Number(p.peso_medio_kg ?? 0),
      sacosUtilizados: sacosMap[p.id] || 0,
      cochoCheio: cochoMap[p.id] || 0,
      status: deriveStatus(avgIndice, statusMap[p.id]),
    };
  });
  rows.sort((a, b) => a.nome.localeCompare(b.nome));

  const periodoLabel = buildLabel(start, end);
  const pdfData: SalgaPdfData = {
    fazendaNome: args.fazendaNome,
    retiroNome: args.retiroNome,
    periodoLabel,
    pastos: rows,
    rangeStartIso: start.toISOString(),
    rangeEndIso: end.toISOString(),
    responsavel: args.responsavelNome ?? null,
  };

  const { blob, fileName } = gerarPdfSalga(pdfData);

  // Persist locally
  const entry: LastPdfEntry = {
    id: `last_pdf_${args.retiroId}`,
    retiroId: args.retiroId,
    retiroNome: args.retiroNome,
    fileName,
    blob,
    generatedAt: end.toISOString(),
    rangeStartIso: start.toISOString(),
    rangeEndIso: end.toISOString(),
  };
  await saveLastPdf(entry);

  // Best-effort upload to Supabase Storage so gerente/admin can fetch it
  try {
    const storagePath = `salgas/${args.fazendaId}/${args.retiroId}/${fileName}`;
    await supabase.storage
      .from("relatorios")
      .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });
  } catch (e) {
    console.warn("[autoSalgaPdf] storage upload failed:", e);
  }

  return {
    blob,
    fileName,
    generatedAt: end.toISOString(),
    rangeStartIso: start.toISOString(),
    rangeEndIso: end.toISOString(),
    empty: false,
  };
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
