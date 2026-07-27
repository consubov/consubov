import { useEffect, useState } from "react";
import { subscribeSyncStatus as subscribePhotos, syncNow as syncPhotosNow, type PhotoFailureDetail } from "./photoQueue";
import { subscribeMutationStatus, retryFailedMutations } from "./mutationQueue";
import { listAllFotos, listAllMutations } from "./db";

export interface PendingVisitaDebugInfo {
  visitaId: string;
  mutationIds: string[];
  mutationTables: string[];
  photoIds: string[];
  photoParents: string[];
  photoErrors: string[];
}

export async function getPendingVisitaDebugInfos(): Promise<PendingVisitaDebugInfo[]> {
  const [muts, fotos] = await Promise.all([listAllMutations(), listAllFotos()]);
  const map = new Map<string, PendingVisitaDebugInfo>();
  const ensure = (visitaId: string) => {
    const existing = map.get(visitaId);
    if (existing) return existing;
    const created: PendingVisitaDebugInfo = {
      visitaId,
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
  });
  fotos.forEach((f) => {
    if (!f.visitaId) return;
    const item = ensure(f.visitaId);
    item.photoIds.push(f.localId);
    item.photoParents.push(`${f.parentKind}:${f.parentId}:${f.status}`);
    if (f.lastError) item.photoErrors.push(`${f.parentKind}:${f.ordem}:${f.lastError}`);
  });
  return Array.from(map.values()).sort((a, b) => a.visitaId.localeCompare(b.visitaId));
}

async function computePendingVisitas(): Promise<number> {
  try {
    const infos = await getPendingVisitaDebugInfos();
    if (import.meta.env.DEV) {
      console.debug("[consultor-sync] visitas pendentes", infos.map((i) => ({
        visitaId: i.visitaId,
        mutations: i.mutationTables,
        photos: i.photoParents,
        photoErrors: i.photoErrors,
      })));
    }
    return infos.length;
  } catch {
    return 0;
  }
}

export function useSyncStatus() {
  const [photoPending, setPhotoPending] = useState(0);
  const [mutPending, setMutPending] = useState(0);
  const [photoSyncing, setPhotoSyncing] = useState(false);
  const [mutSyncing, setMutSyncing] = useState(false);
  const [visitasPending, setVisitasPending] = useState(0);
  const [photoFailures, setPhotoFailures] = useState<PhotoFailureDetail[]>([]);

  useEffect(() => {
    let alive = true;
    const refreshVisitas = async () => {
      const n = await computePendingVisitas();
      if (alive) setVisitasPending(n);
    };
    const u1 = subscribePhotos((p, s, failures) => {
      setPhotoPending(p);
      setPhotoSyncing(s);
      setPhotoFailures(failures);
      void refreshVisitas();
    });
    const u2 = subscribeMutationStatus((p, s) => {
      setMutPending(p);
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
    photoPending,
    mutPending,
    photoFailures,
    syncing: photoSyncing || mutSyncing,
    syncNow,
  };
}
