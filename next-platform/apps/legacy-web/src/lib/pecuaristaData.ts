import { dataLocalSP, diasCalendarioSP } from "@/lib/diasCalendario";

/** Converte "YYYY-MM-DD" escolhido pelo usuário em ISO. Hoje = agora; outro dia = 12:00 de Brasília. */
export function dataEscolhidaParaIso(ymd: string): string {
  if (!ymd || ymd === dataLocalSP(new Date())) return new Date().toISOString();
  return new Date(`${ymd}T12:00:00-03:00`).toISOString();
}

/** Dias de calendário (Brasília) entre duas datas de pesagem; null se <= 0. */
export function diasEntrePesagens(anterior: string, atual: string): number | null {
  const d = diasCalendarioSP(anterior, atual);
  return d != null && d > 0 ? d : null;
}

/** Linhas de pesos anteriores do animal: escolhe a de maior "Data da pesagem" antes da data atual. */
export function escolherPesoAnterior<T extends { pesagem_lote_id?: string; pesagens_lote_pecuarista?: { data_pesagem?: string } | null }>(
  rows: T[], dataAtual: string, pesagemAtualId?: string,
): T | null {
  const diaAtual = dataLocalSP(dataAtual);
  const cands = rows
    .filter((r) => r.pesagem_lote_id !== pesagemAtualId && r.pesagens_lote_pecuarista?.data_pesagem)
    .filter((r) => dataLocalSP(r.pesagens_lote_pecuarista!.data_pesagem!) < diaAtual)
    .sort((a, b) => new Date(b.pesagens_lote_pecuarista!.data_pesagem!).getTime() - new Date(a.pesagens_lote_pecuarista!.data_pesagem!).getTime());
  return cands[0] ?? null;
}
