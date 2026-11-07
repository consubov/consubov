/**
 * Limpeza local ao apagar um lote do Pecuarista: fila, confirmações
 * e cache do Modo Offline. Não altera o funcionamento da fila.
 */
import {
  getMaQueueItems, getMaProcessingId, removeMaQueueItemsWhere,
  getAllMaAcknowledged, removeMaAcknowledgedIds, type MaQueueItem,
} from "@/lib/maisArrobasQueue";
import { getMaCacheTables, removeMaCachedIds } from "@/lib/maOffline";

function refsDoItem(item: MaQueueItem): { id?: string; refs: string[] } {
  const op = item.op;
  if (op.kind === "insert") return { id: String(op.row.id), refs: Object.values(op.row).filter((v) => typeof v === "string") as string[] };
  if (op.kind === "update" || op.kind === "delete") return { id: op.id, refs: [op.id] };
  return { id: op.pesoId, refs: [op.loteId, op.pesagemLoteId, op.animalIdLocal, op.leituraBalancaoId ?? ""] };
}

/** Conjunto de ids ligados ao lote (lote + pesagens + pesos + leituras + animais + apartações). */
export async function coletarIdsLocaisDoLote(loteId: string): Promise<Set<string>> {
  const [fila, acks, cache] = await Promise.all([getMaQueueItems(), getAllMaAcknowledged(), getMaCacheTables()]);
  const linhas: Array<{ id?: string; refs: string[] }> = [
    ...fila.map(refsDoItem),
    ...acks.map((a) => ({ id: String(a.row.id), refs: Object.values(a.row).filter((v) => typeof v === "string") as string[] })),
  ];
  for (const rows of cache.values()) for (const r of rows) {
    linhas.push({ id: String(r.id), refs: Object.values(r).filter((v) => typeof v === "string") as string[] });
  }
  const ids = new Set<string>([loteId]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const l of linhas) {
      if (l.id && !ids.has(l.id) && l.refs.some((v) => ids.has(v))) { ids.add(l.id); mudou = true; }
    }
  }
  return ids;
}

/** true se o insert do lote ainda está na fila e pode ser cancelado. */
export async function loteAindaNaoEnviado(loteId: string): Promise<boolean> {
  const fila = await getMaQueueItems();
  const proc = getMaProcessingId();
  return fila.some((i) => i.op.kind === "insert" && i.op.table === "lotes_pecuarista" && String(i.op.row.id) === loteId && i.id !== proc);
}

/** Remove todas as cópias locais ligadas ao lote. */
export async function limparLoteLocal(loteId: string) {
  const ids = await coletarIdsLocaisDoLote(loteId);
  await removeMaQueueItemsWhere((item) => {
    const { id, refs } = refsDoItem(item);
    return (!!id && ids.has(id)) || refs.some((v) => ids.has(v));
  });
  await removeMaAcknowledgedIds(ids);
  await removeMaCachedIds(ids);
}
