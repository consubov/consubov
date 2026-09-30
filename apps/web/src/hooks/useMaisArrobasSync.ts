import { useEffect, useState } from "react";
import { getMaSnapshot, subscribeMa } from "@/lib/maisArrobasQueue";

/** Estado da fila local do Mais Arrobas (pesos pendentes de envio). */
export function useMaisArrobasSync() {
  const [snap, setSnap] = useState(getMaSnapshot);
  useEffect(() => subscribeMa(() => setSnap(getMaSnapshot())), []);
  return snap;
}
