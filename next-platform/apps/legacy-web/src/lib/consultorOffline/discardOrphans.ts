/**
 * Saída para o cenário IRRECUPERÁVEL da fila offline do Consultor.
 *
 * Quando `parentRecovery` conclui que o registro pai (pasto/curral/tópico) não
 * existe nem no servidor nem no backup local do aparelho, os filhos
 * (avaliações e fotos) jamais poderão subir — a FK nunca vai fechar. Antes,
 * isso travava a visita inteira: o gate de sincronização do PDF via pendências
 * eternas e não havia como limpá-las.
 *
 * Aqui oferecemos o descarte cirúrgico: remove da fila local SOMENTE os itens
 * daquele pai órfão, preservando todo o resto da visita.
 */
import {
  deleteFotosByParent,
  deleteMutation,
  listAllMutations,
  listFotosByVisita,
} from "./db";
import { parentRefOfMutation } from "./mutationQueue";
import { getSnapshot } from "./db";
import { PARENT_TABLE_BY_KIND, parentExistsOnServer, type ParentKind } from "./parentRecovery";

export interface OrphanParentInfo {
  kind: ParentKind;
  parentId: string;
  table: string;
  mutationIds: string[];
  fotoIds: string[];
  /** true quando não há como recuperar (nem servidor, nem backup local). */
  unrecoverable: boolean;
  motivo: string;
}

const SNAPSHOT_KEY_BY_KIND: Record<ParentKind, string> = {
  pasto: "pastos",
  curral: "currais",
  topico: "topicos",
};

/** Lista os pais referenciados pela fila desta visita e diz quais estão órfãos. */
export async function scanOrphanParents(visitaId: string): Promise<OrphanParentInfo[]> {
  const [mutations, fotos, snap] = await Promise.all([
    listAllMutations(),
    listFotosByVisita(visitaId),
    getSnapshot(visitaId),
  ]);

  const groups = new Map<string, OrphanParentInfo>();
  const ensure = (kind: ParentKind, parentId: string) => {
    const key = `${kind}:${parentId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        kind,
        parentId,
        table: PARENT_TABLE_BY_KIND[kind],
        mutationIds: [],
        fotoIds: [],
        unrecoverable: false,
        motivo: "",
      };
      groups.set(key, g);
    }
    return g;
  };

  mutations.forEach((m) => {
    if (m.visitaId !== visitaId) return;
    const ref = parentRefOfMutation(m);
    if (ref) ensure(ref.kind, ref.id).mutationIds.push(m.id);
  });
  fotos.forEach((f) => {
    ensure(f.parentKind as ParentKind, f.parentId).fotoIds.push(f.localId);
  });

  const out: OrphanParentInfo[] = [];
  for (const g of groups.values()) {
    let existsServer = false;
    try {
      existsServer = await parentExistsOnServer(g.kind, g.parentId);
    } catch {
      // Sem rede/erro real: não classificamos como irrecuperável.
      g.motivo = "não foi possível verificar o registro principal agora";
      out.push(g);
      continue;
    }
    if (existsServer) {
      g.motivo = "registro principal existe no servidor";
      out.push(g);
      continue;
    }
    const list = ((snap?.data as any)?.[SNAPSHOT_KEY_BY_KIND[g.kind]] || []) as any[];
    const hasBackup = list.some((r) => r?.id === g.parentId);
    const hasCreate = mutations.some((m) => m.rowId === g.parentId
      && (m.operation === "upsert" || m.operation === "insert"));
    if (hasBackup || hasCreate) {
      g.motivo = "registro principal ainda pode ser recriado (backup local disponível)";
    } else {
      g.unrecoverable = true;
      g.motivo = `${g.kind} ${g.parentId} não existe no servidor nem no backup local do aparelho`;
    }
    out.push(g);
  }
  return out;
}

/** Remove da fila local todos os itens (mutações + fotos) de um pai específico. */
export async function discardParentFromQueue(
  visitaId: string,
  kind: ParentKind,
  parentId: string,
): Promise<{ mutations: number; fotos: number }> {
  const mutations = await listAllMutations();
  let removedMut = 0;
  for (const m of mutations) {
    const ref = parentRefOfMutation(m);
    const isParentRow = m.rowId === parentId;
    const isChild = ref?.id === parentId;
    if (!isParentRow && !isChild) continue;
    if (m.visitaId && m.visitaId !== visitaId) continue;
    await deleteMutation(m.id);
    removedMut++;
  }
  const removedFotos = await deleteFotosByParent(kind, parentId);
  console.warn("[consultor-sync] itens irrecuperáveis descartados da fila", {
    visitaId, kind, parentId, mutations: removedMut, fotos: removedFotos,
  });
  return { mutations: removedMut, fotos: removedFotos };
}

/** Descarta de uma vez todos os pais irrecuperáveis da visita. */
export async function discardUnrecoverableForVisita(visitaId: string): Promise<{
  descartados: OrphanParentInfo[];
  mutations: number;
  fotos: number;
}> {
  const scan = await scanOrphanParents(visitaId);
  const alvos = scan.filter((g) => g.unrecoverable);
  let mutations = 0;
  let fotos = 0;
  for (const alvo of alvos) {
    const res = await discardParentFromQueue(visitaId, alvo.kind, alvo.parentId);
    mutations += res.mutations;
    fotos += res.fotos;
  }
  return { descartados: alvos, mutations, fotos };
}
