import { useEffect, useRef, useState } from "react";
import { subscribeSyncStatus as subscribePhotos, syncNow as syncPhotosNow, type PhotoFailureDetail } from "./photoQueue";
import { subscribeMutationStatus, retryFailedMutations } from "./mutationQueue";
import { listAllFotos, listAllMutations, listAllSnapshots } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { patchSnapshot } from "./snapshotStore";

export interface PendingVisitaDebugInfo {
  visitaId: string;
  fazenda: string;
  tipo: string;
  data: string;
  deleted: boolean;
  deletedAt?: string | null;
  mutationIds: string[];
  mutationTables: string[];
  photoIds: string[];
  photoParents: string[];
  photoErrors: string[];
}

export async function getPendingVisitaDebugInfos(options?: { includeDeleted?: boolean }): Promise<PendingVisitaDebugInfo[]> {
  const [muts, fotos, snapshots] = await Promise.all([listAllMutations(), listAllFotos(), listAllSnapshots()]);
  const snapshotById = new Map(snapshots.map((snap) => [snap.visitaId, snap.data as any]));
  const map = new Map<string, PendingVisitaDebugInfo>();
  const ensure = (visitaId: string) => {
    const existing = map.get(visitaId);
    if (existing) return existing;
    const snap = snapshotById.get(visitaId);
    const visita = snap?.visita ?? {};
    const deletedAt = visita.deleted_at ?? null;
    const created: PendingVisitaDebugInfo = {
      visitaId,
      fazenda: snap?.fazenda?.nome_fazenda || visita.fazenda_nome || visita.fazenda_consultor_nome || "Fazenda não identificada",
      tipo: visita.tipo || "—",
      data: visita.hora_inicio || visita.data_visita || "",
      deleted: Boolean(deletedAt),
      deletedAt,
      mutationIds: [],
      mutationTables: [],
      photoIds: [],
      photoParents: [],
      photoErrors: [],
    };
    map.set(visitaId, created);
    return created;
  };

  muts.forEach((m) => {
    if (!m.visitaId) return;
    const item = ensure(m.visitaId);
    item.mutationIds.push(m.id);
    item.mutationTables.push(`${m.table}:${m.operation ?? "update"}:${m.status}`);
    if (m.table === "visitas_tecnicas" && m.patch?.deleted_at) {
      item.deleted = true;
      item.deletedAt = String(m.patch.deleted_at);
    }
    if (m.table === "visitas_tecnicas") {
      if (m.patch?.tipo) item.tipo = String(m.patch.tipo);
      if (m.patch?.hora_inicio) item.data = String(m.patch.hora_inicio);
    }
  });
  fotos.forEach((f) => {
    if (!f.visitaId) return;
    const item = ensure(f.visitaId);
    item.photoIds.push(f.localId);
    item.photoParents.push(`${f.parentKind}:${f.parentId}:${f.status}`);
    if (f.lastError) item.photoErrors.push(`${f.parentKind}:${f.ordem}:${f.lastError}`);
  });
  const infos = Array.from(map.values());
  const serverLookupIds = infos
    .filter((item) => !item.deleted)
    .map((item) => item.visitaId);
  if (serverLookupIds.length > 0 && (typeof navigator === "undefined" || navigator.onLine)) {
    try {
      const { data } = await supabase
        .from("visitas_tecnicas")
        .select("id, tipo, hora_inicio, deleted_at, fazendas_consultor(nome_fazenda)")
        .in("id", serverLookupIds);
      await Promise.all(((data as any[]) || []).map(async (row) => {
        const item = map.get(row.id);
        if (!item) return;
        item.fazenda = row.fazendas_consultor?.nome_fazenda || item.fazenda;
        item.tipo = row.tipo || item.tipo;
        item.data = row.hora_inicio || item.data;
        item.deleted = Boolean(row.deleted_at) || item.deleted;
        item.deletedAt = row.deleted_at || item.deletedAt;
        if (row.deleted_at) {
          await patchSnapshot(row.id, (current) => ({
            ...current,
            visita: { ...(current.visita || {}), id: row.id, deleted_at: row.deleted_at },
          }));
        }
      }));
    } catch (err) {
      console.warn("[consultor-sync] consulta de deleted_at falhou", err);
    }
  }
  return infos
    .filter((item) => options?.includeDeleted || !item.deleted)
    .sort((a, b) => (b.data || "").localeCompare(a.data || "") || a.visitaId.localeCompare(b.visitaId));
}

export function useSyncStatus() {
  const [photoSyncing, setPhotoSyncing] = useState(false);
  const [mutSyncing, setMutSyncing] = useState(false);
  const [visitasPending, setVisitasPending] = useState(0);
  const [activePhotoPending, setActivePhotoPending] = useState(0);
  const [activeMutPending, setActiveMutPending] = useState(0);
  const [photoFailures, setPhotoFailures] = useState<PhotoFailureDetail[]>([]);
  const rawPhotoFailuresRef = useRef<PhotoFailureDetail[]>([]);

  useEffect(() => {
    let alive = true;
    const refreshVisitas = async () => {
      try {
        const infos = await getPendingVisitaDebugInfos();
        if (!alive) return;
        if (import.meta.env.DEV) {
          console.debug("[consultor-sync] visitas pendentes", infos.map((i) => ({
            visitaId: i.visitaId,
            mutations: i.mutationTables,
            photos: i.photoParents,
            photoErrors: i.photoErrors,
          })));
        }
        const activeIds = new Set(infos.map((i) => i.visitaId));
        setVisitasPending(infos.length);
        setActiveMutPending(infos.reduce((total, item) => total + item.mutationIds.length, 0));
        setActivePhotoPending(infos.reduce((total, item) => total + item.photoIds.length, 0));
        setPhotoFailures(rawPhotoFailuresRef.current.filter((failure) => activeIds.has(failure.visitaId)));
      } catch {
        if (!alive) return;
        setVisitasPending(0);
        setActiveMutPending(0);
        setActivePhotoPending(0);
        setPhotoFailures([]);
      }
    };
    const u1 = subscribePhotos((_pending, s, failures) => {
      rawPhotoFailuresRef.current = failures;
      setPhotoSyncing(s);
      void refreshVisitas();
    });
    const u2 = subscribeMutationStatus((_pending, s) => {
      setMutSyncing(s);
      void refreshVisitas();
    });
    return () => {
      alive = false;
      u1();
      u2();
    };
  }, []);

  const syncNow = async () => {
    await retryFailedMutations();
    await syncPhotosNow();
  };

  return {
    // pending = número de VISITAS pendentes (não de itens internos)
    pending: visitasPending,
    photoPending: activePhotoPending,
    mutPending: activeMutPending,
    photoFailures,
    syncing: photoSyncing || mutSyncing,
    syncNow,
  };
}
