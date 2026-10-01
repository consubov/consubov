import { useEffect, useState } from "react";
import {
  listActiveFazendasForPremiacao,
  type FazendaPremiacao,
} from "@/features/admin-premiacao/repositories/adminPremiacaoRepository";

type LoadFazendas = () => Promise<FazendaPremiacao[]>;

export function useAdminPremiacaoFazendas(
  loadFazendas: LoadFazendas = listActiveFazendasForPremiacao,
) {
  const [fazendas, setFazendas] = useState<FazendaPremiacao[]>([]);

  useEffect(() => {
    let mounted = true;

    void loadFazendas().then((data) => {
      if (mounted) setFazendas(data);
    });

    return () => {
      mounted = false;
    };
  }, [loadFazendas]);

  return fazendas;
}
