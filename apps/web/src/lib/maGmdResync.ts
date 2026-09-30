/**
 * Fase C — após sincronizar o Modo Offline, recalcula com os dados definitivos
 * do servidor o GMD calculado offline (a fórmula é a mesma já usada nas telas).
 */
import { supabase } from "@/integrations/supabase/client";
import type { MaQueueItem } from "@/lib/maisArrobasQueue";
import { dataLocalSP } from "@/lib/diasCalendario";
import { diasEntrePesagens, escolherPesoAnterior } from "@/lib/pecuaristaData";

export interface GmdAlvos {
  pesoIds: string[];
  pesagemIds: string[];
}

/** Captura, antes do envio, o que foi pesado/finalizado no aparelho. */
export function coletarAlvosGmd(queue: MaQueueItem[]): GmdAlvos {
  const pesoIds = new Set<string>();
  const pesagemIds = new Set<string>();
  for (const { op } of queue) {
    if (op.kind === "pecuarista_peso_id") pesoIds.add(op.pesoId);
    else if (op.kind === "update" && op.table === "pesagens_lote_pecuarista" && "hora_fim" in op.values) pesagemIds.add(op.id);
  }
  return { pesoIds: [...pesoIds], pesagemIds: [...pesagemIds] };
}

const quase = (a: number | null, b: number | null) =>
  (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-6);

export async function recalcularGmdServidor(alvos: GmdAlvos) {
  const sb = supabase as any;

  // GMD individual
  if (alvos.pesoIds.length) {
    const { data: pesos } = await sb.from("pesos_animais_pecuarista")
      .select("id, animal_id, peso_kg, gmd_individual, pesagem_lote_id, pesagens_lote_pecuarista!inner(data_pesagem)")
      .in("id", alvos.pesoIds);
    for (const p of (pesos as any[]) ?? []) {
      const { data: hist } = await sb.from("pesos_animais_pecuarista")
        .select("peso_kg, created_at, pesagem_lote_id, pesagens_lote_pecuarista!inner(data_pesagem)")
        .eq("animal_id", p.animal_id);
      const dataAtual = p.pesagens_lote_pecuarista?.data_pesagem;
      if (!dataAtual) continue;
      const ant: any = escolherPesoAnterior((hist as any[]) ?? [], dataAtual, p.pesagem_lote_id);
      let gmd: number | null = null;
      if (ant) {
        const dias = diasEntrePesagens(ant.pesagens_lote_pecuarista.data_pesagem, dataAtual);
        if (dias) gmd = (Number(p.peso_kg) - Number(ant.peso_kg)) / dias;
      }
      const atual = p.gmd_individual != null ? Number(p.gmd_individual) : null;
      if (!quase(atual, gmd)) {
        await sb.from("pesos_animais_pecuarista").update({ gmd_individual: gmd }).eq("id", p.id);
      }
    }
  }

  // GMD de lote (sem identificação)
  for (const id of alvos.pesagemIds) {
    const { data: pes } = await sb.from("pesagens_lote_pecuarista")
      .select("id, lote_id, data_pesagem, peso_medio, gmd, quantidade_animais, lotes_pecuarista!inner(identificado)")
      .eq("id", id).maybeSingle();
    if (!pes || pes.lotes_pecuarista?.identificado || !(pes.quantidade_animais > 0)) continue;
    const { data: ant } = await sb.from("pesagens_lote_pecuarista")
      .select("id, data_pesagem, peso_medio")
      .eq("lote_id", pes.lote_id).neq("id", id).gt("quantidade_animais", 0)
      .order("data_pesagem", { ascending: false }).limit(100);
    const diaAtual = dataLocalSP(pes.data_pesagem);
    const a = ((ant as any[]) ?? []).find((x) => dataLocalSP(x.data_pesagem) < diaAtual);
    let gmd: number | null = null;
    if (a) {
      const dias = diasEntrePesagens(a.data_pesagem, pes.data_pesagem);
      if (dias) gmd = (Number(pes.peso_medio) - Number(a.peso_medio)) / dias;
    }
    const atual = pes.gmd != null ? Number(pes.gmd) : null;
    if (!quase(atual, gmd)) {
      await sb.from("pesagens_lote_pecuarista").update({ gmd }).eq("id", id);
    }
  }
}
