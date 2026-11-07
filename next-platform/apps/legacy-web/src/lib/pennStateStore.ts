// Integração do motor puro (src/lib/pennState.ts) com o banco.
// Toda a lógica de cálculo vive em pennState.ts — aqui só persistimos.

import { supabase } from "@/integrations/supabase/client";
import { calcularPennState, type PennStateInput } from "@/lib/pennState";
import {
  CONSULTOR_NETWORK_TIMEOUT_MS,
  CONSULTOR_SYNC_ATTEMPTS,
  getErrorMessage,
  retryDelayMs,
  sleep,
  withConsultorTimeout,
} from "@/lib/consultorOffline/network";

/**
 * Safari/WebKit derruba a primeira requisição feita sobre uma conexão ociosa
 * ("TypeError: Load failed"). Mesma correção já validada no restante do
 * Relatto: cada tentativa refaz a requisição do zero (nada de reaproveitar a
 * promise/referência anterior), com timeout e backoff.
 */
export async function pennStateRequest<T>(
  etapa: string,
  run: () => PromiseLike<T>,
  attempts = CONSULTOR_SYNC_ATTEMPTS,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await withConsultorTimeout(run(), etapa, CONSULTOR_NETWORK_TIMEOUT_MS);
    } catch (err) {
      last = err;
      const msg = getErrorMessage(err).toLowerCase();
      const transitorio =
        msg.includes("load failed") ||
        msg.includes("failed to fetch") ||
        msg.includes("network") ||
        msg.includes("tempo limite");
      if (!transitorio || attempt === attempts) break;
      await sleep(retryDelayMs(attempt));
    }
  }
  throw last instanceof Error ? last : new Error(getErrorMessage(last));
}

export type PennStateAnaliseInput = PennStateInput & {
  id?: string;
  visita_id: string;
  dieta_id?: string | null;
  nome: string;
  ordem?: number;
};

/** Monta a linha completa (entradas + campos calculados) para persistir. */
export function buildAnaliseRow(input: PennStateAnaliseInput) {
  const r = calcularPennState(input);
  return {
    ...(input.id ? { id: input.id } : {}),
    visita_id: input.visita_id,
    dieta_id: input.dieta_id ?? null,
    nome: input.nome,
    peso_amostra_g: input.peso_amostra_g,
    peso_19mm_g: input.peso_19mm_g,
    peso_8mm_g: input.peso_8mm_g,
    peso_4mm_g: input.peso_4mm_g,
    peso_fundo_g: input.peso_fundo_g,
    fdn_percentual_usado: input.fdn_percentual ?? null,
    percentual_19mm: r.percentual_19mm,
    percentual_8mm: r.percentual_8mm,
    percentual_4mm: r.percentual_4mm,
    percentual_fundo: r.percentual_fundo,
    fef: r.fef,
    peNDF: r.peNDF,
    aviso_divergencia: r.aviso_divergencia,
    ordem: input.ordem ?? 0,
  };
}

/** Cria ou atualiza uma análise recalculando sempre pelo motor puro. */
export async function salvarPennStateAnalise(input: PennStateAnaliseInput) {
  const row = buildAnaliseRow(input);
  const { data, error } = await pennStateRequest<any>("salvar análise Penn State", () =>
    (supabase as any)
      .from("penn_state_analises")
      .upsert(row, { onConflict: "id" })
      .select()
      .maybeSingle());
  if (error) throw error;
  return data;
}

export async function listarPennStateAnalises(visitaId: string) {
  const { data, error } = await pennStateRequest<any>("carregar análises Penn State", () =>
    (supabase as any)
    .from("penn_state_analises")
    .select("*")
    .eq("visita_id", visitaId)
    .is("deleted_at", null)
    .order("ordem"));
  if (error) throw error;
  // Recalcula sempre pelo motor puro: linhas antigas gravadas antes da
  // correção da base de cálculo (soma real das frações) ficariam com
  // percentuais somando mais de 100%.
  return ((data as any[]) || []).map(row => {
    const r = calcularPennState({
      peso_amostra_g: Number(row.peso_amostra_g) || 0,
      peso_19mm_g: Number(row.peso_19mm_g) || 0,
      peso_8mm_g: Number(row.peso_8mm_g) || 0,
      peso_4mm_g: Number(row.peso_4mm_g) || 0,
      peso_fundo_g: Number(row.peso_fundo_g) || 0,
      fdn_percentual: row.fdn_percentual_usado ?? null,
    });
    return {
      ...row,
      percentual_19mm: r.percentual_19mm,
      percentual_8mm: r.percentual_8mm,
      percentual_4mm: r.percentual_4mm,
      percentual_fundo: r.percentual_fundo,
      fef: r.fef,
      peNDF: r.peNDF,
      aviso_divergencia: r.aviso_divergencia,
    };
  });
}

export async function excluirPennStateAnalise(id: string) {
  const { error } = await pennStateRequest<any>("excluir análise Penn State", () =>
    (supabase as any)
      .from("penn_state_analises")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id));
  if (error) throw error;
}

/** Dietas (cadastro por fazenda, reutilizável entre visitas). */
export async function listarDietas(fazendaConsultorId: string) {
  const { data, error } = await (supabase as any)
    .from("dietas_consultor")
    .select("*")
    .eq("fazenda_consultor_id", fazendaConsultorId)
    .order("nome");
  if (error) throw error;
  return data || [];
}

export async function salvarDieta(dieta: {
  id?: string;
  fazenda_consultor_id: string;
  nome: string;
  fdn_percentual?: number | null;
}) {
  const { data, error } = await (supabase as any)
    .from("dietas_consultor")
    .upsert(
      {
        ...(dieta.id ? { id: dieta.id } : {}),
        fazenda_consultor_id: dieta.fazenda_consultor_id,
        nome: dieta.nome,
        fdn_percentual: dieta.fdn_percentual ?? null,
      },
      { onConflict: "id" },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
