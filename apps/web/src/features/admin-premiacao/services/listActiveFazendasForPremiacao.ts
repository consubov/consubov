import {
  supabaseAdminPremiacaoRepository,
  type AdminPremiacaoRepository,
} from "../repositories/adminPremiacaoRepository";
import type { FazendaPremiacao } from "../types";

export function listActiveFazendasForPremiacao(
  repository: AdminPremiacaoRepository = supabaseAdminPremiacaoRepository,
): Promise<FazendaPremiacao[]> {
  return repository.listActiveFazendas();
}
