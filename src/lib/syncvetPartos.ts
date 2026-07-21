import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna a lista de partos previstos com base em IATFs concluídas + dias de
 * gestação configurados por raça (com fallbacks padrão).
 */
export type PartoPrevisto = {
  lote_id: string;
  lote_nome: string;
  fazenda_id: string;
  fazenda_nome: string;
  raca: string;
  dias_gestacao: number;
  data_iatf: string; // ISO date
  data_prevista_parto: string; // ISO date
  quantidade_animais: number;
};

const FALLBACK: Record<string, number> = {
  nelore: 285,
  angus: 283,
  girolando: 280,
};
export const RACAS_PADRAO = [
  { raca: "Nelore", dias_gestacao: 285 },
  { raca: "Angus", dias_gestacao: 283 },
  { raca: "Girolando", dias_gestacao: 280 },
];

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function calcularPartosPrevistos(empresaId: string): Promise<PartoPrevisto[]> {
  // Fazendas → Lotes → Ciclos → Manejos IATF concluídos
  const { data: faz } = await supabase
    .from("syncvet_fazendas")
    .select("id, nome")
    .eq("empresa_id", empresaId);
  const fazendas = (faz as { id: string; nome: string }[]) || [];
  if (fazendas.length === 0) return [];
  const fazMap = new Map(fazendas.map(f => [f.id, f.nome]));

  const { data: lotes } = await supabase
    .from("syncvet_lotes")
    .select("id, nome, fazenda_id, quantidade_animais")
    .in("fazenda_id", fazendas.map(f => f.id));
  const lotesArr = (lotes as { id: string; nome: string; fazenda_id: string; quantidade_animais: number | null }[]) || [];
  if (lotesArr.length === 0) return [];
  const loteMap = new Map(lotesArr.map(l => [l.id, l]));

  const { data: ciclos } = await supabase
    .from("syncvet_lote_ciclos")
    .select("id, lote_id, protocolo_id, data_d0")
    .in("lote_id", lotesArr.map(l => l.id));
  const ciclosArr = (ciclos as { id: string; lote_id: string; protocolo_id: string; data_d0: string }[]) || [];
  if (ciclosArr.length === 0) return [];
  const cicloMap = new Map(ciclosArr.map(c => [c.id, c]));

  const { data: manejos } = await supabase
    .from("syncvet_manejos")
    .select("id, lote_ciclo_id, etapa_id, data_execucao, status")
    .in("lote_ciclo_id", ciclosArr.map(c => c.id))
    .eq("status", "concluido");
  const manejosArr = (manejos as { id: string; lote_ciclo_id: string; etapa_id: string; data_execucao: string | null; status: string }[]) || [];
  if (manejosArr.length === 0) return [];

  const etapaIds = Array.from(new Set(manejosArr.map(m => m.etapa_id)));
  const { data: etapas } = await supabase
    .from("syncvet_protocolo_etapas")
    .select("id, nome_etapa")
    .in("id", etapaIds);
  const etapaMap = new Map(((etapas as { id: string; nome_etapa: string | null }[]) || []).map(e => [e.id, e.nome_etapa || ""]));

  const { data: racasCfg } = await supabase
    .from("syncvet_racas_gestacao")
    .select("raca, dias_gestacao")
    .eq("empresa_id", empresaId);
  const racasMap = new Map<string, number>();
  ((racasCfg as { raca: string; dias_gestacao: number }[]) || []).forEach(r => racasMap.set(r.raca.trim().toLowerCase(), r.dias_gestacao));

  // Amostra: pegar raça predominante do lote a partir dos animais
  const { data: animais } = await supabase
    .from("syncvet_animais")
    .select("lote_id, raca")
    .in("lote_id", lotesArr.map(l => l.id));
  const racaPorLote = new Map<string, string>();
  const contagem = new Map<string, Map<string, number>>();
  ((animais as { lote_id: string; raca: string | null }[]) || []).forEach(a => {
    if (!a.raca) return;
    const inner = contagem.get(a.lote_id) || new Map<string, number>();
    inner.set(a.raca, (inner.get(a.raca) || 0) + 1);
    contagem.set(a.lote_id, inner);
  });
  contagem.forEach((inner, loteId) => {
    let best = ""; let n = -1;
    inner.forEach((v, k) => { if (v > n) { n = v; best = k; } });
    if (best) racaPorLote.set(loteId, best);
  });

  const result: PartoPrevisto[] = [];
  for (const m of manejosArr) {
    const nome = (etapaMap.get(m.etapa_id) || "").toLowerCase();
    const isIATF = nome.includes("iatf") || (nome.includes(" ia") || nome.startsWith("ia ") || nome === "ia");
    if (!isIATF) continue;
    if (!m.data_execucao) continue;
    const ciclo = cicloMap.get(m.lote_ciclo_id);
    if (!ciclo) continue;
    const lote = loteMap.get(ciclo.lote_id);
    if (!lote) continue;
    const raca = racaPorLote.get(lote.id) || "Nelore";
    const dias = racasMap.get(raca.trim().toLowerCase()) ?? FALLBACK[raca.trim().toLowerCase()] ?? 285;
    const dataIatf = m.data_execucao.slice(0, 10);
    const parto = addDaysISO(dataIatf, dias);
    result.push({
      lote_id: lote.id,
      lote_nome: lote.nome,
      fazenda_id: lote.fazenda_id,
      fazenda_nome: fazMap.get(lote.fazenda_id) || "",
      raca,
      dias_gestacao: dias,
      data_iatf: dataIatf,
      data_prevista_parto: parto,
      quantidade_animais: lote.quantidade_animais ?? 0,
    });
  }
  return result;
}
