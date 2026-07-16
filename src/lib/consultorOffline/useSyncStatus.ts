import { useEffect, useState } from "react";
import { subscribeSyncStatus as subscribePhotos, syncNow as syncPhotosNow } from "./photoQueue";
import { subscribeMutationStatus, retryFailedMutations } from "./mutationQueue";

export function useSyncStatus() {
  const [photoPending, setPhotoPending] = useState(0);
  const [mutPending, setMutPending] = useState(0);
  const [photoSyncing, setPhotoSyncing] = useState(false);
  const [mutSyncing, setMutSyncing] = useState(false);

  useEffect(() => {
    const u1 = subscribePhotos((p, s) => {
      setPhotoPending(p);
      setPhotoSyncing(s);
    });
    const u2 = subscribeMutationStatus((p, s) => {
      setMutPending(p);
      setMutSyncing(s);
    });
    return () => {
      u1();
      u2();
    };
  }, []);

  const syncNow = async () => {
    await Promise.all([syncPhotosNow(), retryFailedMutations()]);
  };

  return {
    pending: photoPending + mutPending,
    photoPending,
    mutPending,
    syncing: photoSyncing || mutSyncing,
    syncNow,
  };
}
