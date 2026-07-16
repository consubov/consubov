import { useEffect, useState } from "react";
import { subscribeSyncStatus, syncNow } from "./photoQueue";

export function useSyncStatus() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncStatus((p, s) => {
      setPending(p);
      setSyncing(s);
    });
    return () => {
      unsub();
    };
  }, []);

  return { pending, syncing, syncNow };
}
