/**
 * Recuperação de registros "pai" órfãos.
 *
 * Causa raiz observada em campo (Fazenda Bom Jardim, pasto P):
 * a fila local guardava avaliações e fotos apontando para um `visita_pastos.id`
 * que NUNCA chegou ao servidor (a mutação de criação do pasto foi cancelada ou
 * perdida — p.ex. exclusão local do registro pai enquanto os filhos ficavam na
 * fila). Como o pai jamais existiria, cada filho era "adiado" para sempre com a
 * mensagem genérica "aguardando sincronização do registro principal", sem nunca
 * virar erro visível e sem que nenhum botão de retry pudesse resolver.
 *
 * Este módulo:
 *  1. verifica no servidor se o pai realmente existe;
 *  2. recria o pai a partir do snapshot local (backup do aparelho) quando ele
 *     sumiu da fila mas os dados ainda estão no dispositivo;
 *  3. informa "missing" quando não há como recriar — aí o filho vira erro
 *     visível e acionável, nunca mais um pendente silencioso.
 *
 * Não importa `snapshotStore` (evita ciclo de dependência): fala direto com o
 * IndexedDB (`db.ts`) e com o Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import { getSnapshot, listAllMutations, putMutation, type TextMutation } from "./db";
import { CONSULTOR_NETWORK_TIMEOUT_MS, getErrorMessage, withConsultorTimeout } from "./network";

export type ParentKind = "pasto" | "curral" | "topico";

export const PARENT_TABLE_BY_KIND: Record<ParentKind, string> = {
  pasto: "visita_pastos",
  curral: "visita_currais",
  topico: "visita_topicos",
};

const SNAPSHOT_KEY_BY_KIND: Record<ParentKind, string> = {
  pasto: "pastos",
  curral: "currais",
  topico: "topicos",
};

/** Campos locais que não existem nas tabelas do servidor. */
const LOCAL_ONLY_FIELDS = new Set(["fotos", "signed", "samples", "avaliacoes", "queued", "pending", "localOnly"]);

export type ParentRecoveryOutcome = "exists" | "pending" | "queued" | "missing";

export async function parentExistsOnServer(kind: ParentKind, parentId: string): Promise<boolean> {
  const res: any = await withConsultorTimeout(
    (supabase as any).from(PARENT_TABLE_BY_KIND[kind]).select("id").eq("id", parentId).maybeSingle(),
    `verificação do ${kind}`,
    CONSULTOR_NETWORK_TIMEOUT_MS,
  );
  if (res.error) throw new Error(`Falha ao verificar registro principal: ${getErrorMessage(res.error)}`);
  return Boolean(res.data?.id);
}

/** Monta o payload de recriação a partir do registro do snapshot local. */
export function buildParentPayload(record: Record<string, any> | null | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (key === "id" || LOCAL_ONLY_FIELDS.has(key)) continue;
    if (value === undefined) continue;
    if (value !== null && typeof value === "object") continue; // nada aninhado vai ao servidor
    out[key] = value;
  }
  return out;
}

export async function hasPendingCreateMutation(rowId: string): Promise<boolean> {
  const items = await listAllMutations();
  return items.some((m) => m.rowId === rowId
    && (m.operation === "upsert" || m.operation === "insert")
    && (m.tries ?? 0) < 3);
}

/**
 * Tenta garantir que o registro pai exista (ou volte a estar na fila).
 * Retorna:
 *  - "exists"  → já está no servidor (o filho pode subir agora);
 *  - "pending" → há criação pendente na fila, basta aguardar/reprocessar;
 *  - "queued"  → recriamos a partir do backup local e enfileiramos;
 *  - "missing" → não há como recuperar: o filho deve virar erro visível.
 */
export async function recoverMissingParent(
  visitaId: string,
  kind: ParentKind,
  parentId: string,
): Promise<ParentRecoveryOutcome> {
  if (await parentExistsOnServer(kind, parentId)) return "exists";
  if (await hasPendingCreateMutation(parentId)) return "pending";

  const snap = await getSnapshot(visitaId);
  const list = ((snap?.data as any)?.[SNAPSHOT_KEY_BY_KIND[kind]] || []) as any[];
  const record = list.find((r) => r?.id === parentId);
  if (!record) return "missing";

  const patch = buildParentPayload(record);
  patch.visita_id = visitaId;

  const mutation: TextMutation = {
    id: `mut_recover_${parentId}`,
    visitaId,
    table: PARENT_TABLE_BY_KIND[kind],
    rowId: parentId,
    operation: "upsert",
    onConflict: "id",
    patch,
    createdAt: new Date().toISOString(),
    tries: 0,
    status: "pending",
  };
  await putMutation(mutation);
  console.warn("[consultor-sync] registro principal recriado a partir do backup local", {
    visitaId,
    kind,
    parentId,
    table: mutation.table,
  });
  return "queued";
}
