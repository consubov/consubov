import { useEffect, useState } from "react";
import { subscribeSyncStatus as subscribePhotos, syncNow as syncPhotosNow } from "./photoQueue";
import { subscribeMutationStatus, retryFailedMutations } from "./mutationQueue";
import { listAllFotos, listAllMutations } from "./db";

async function computePendingVisitas(): Promise<number> {
  try {
    const [muts, fotos] = await Promise.all([listAllMutations(), listAllFotos()]);
    const set = new Set<string>();
    muts.forEach((m) => {
      if (m.status === "error" && (m.tries ?? 0) >= 3) return;
      if (m.visitaId) set.add(m.visitaId);
    });
    fotos.forEach((f) => {
      if (f.status === "error" && (f.tries ?? 0) >= 3) return;
      if (f.visitaId) set.add(f.visitaId);
    });
    return set.size;
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

  useEffect(() => {
    let alive = true;
    const refreshVisitas = async () => {
      const n = await computePendingVisitas();
      if (alive) setVisitasPending(n);
    };
    const u1 = subscribePhotos((p, s) => {
      setPhotoPending(p);
      setPhotoSyncing(s);
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
    syncing: photoSyncing || mutSyncing,
    syncNow,
  };
}
