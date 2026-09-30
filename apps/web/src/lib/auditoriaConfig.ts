/**
 * Configuração da auditoria de fotos da salga.
 * Prioridade: retiro → fazenda → padrão (3 fotos a cada 10, foto do Cocho obrigatória).
 * Compartilhado entre Admin (/admin/auditoria), Gerente (Auditoria de Fotos) e Capataz (leitura).
 */
import { supabase } from "@/integrations/supabase/client";

export const AUDITORIA_FOTOS_PADRAO = 3;
export const EXIGIR_FOTO_COCHO_PADRAO = true;

export interface AuditoriaNivel {
  auditoria_fotos_por_bloco: number | null;
  exigir_foto_cocho: boolean | null;
}

export interface AuditoriaEfetiva {
  fotosPorBloco: number;
  exigirFotoCocho: boolean;
}

export function resolverAuditoria(
  retiro: Partial<AuditoriaNivel> | null | undefined,
  fazenda: Partial<AuditoriaNivel> | null | undefined,
): AuditoriaEfetiva {
  return {
    fotosPorBloco: retiro?.auditoria_fotos_por_bloco ?? fazenda?.auditoria_fotos_por_bloco ?? AUDITORIA_FOTOS_PADRAO,
    exigirFotoCocho: retiro?.exigir_foto_cocho ?? fazenda?.exigir_foto_cocho ?? EXIGIR_FOTO_COCHO_PADRAO,
  };
}

export function retiroTemConfigPropria(r: Partial<AuditoriaNivel>): boolean {
  return r.auditoria_fotos_por_bloco != null || r.exigir_foto_cocho != null;
}

export function descreverAuditoria(fotos: number, cocho: boolean): string {
  const f = fotos === 0 ? "Sem foto de auditoria" : `${fotos} foto${fotos > 1 ? "s" : ""} a cada 10`;
  return `${f} · Cocho: ${cocho ? "foto obrigatória" : "foto opcional"}`;
}

/** Grava a configuração no nível fazenda. Campos omitidos não são alterados. */
export async function salvarAuditoriaFazenda(
  fazendaId: string,
  valores: { auditoria_fotos_por_bloco?: number; exigir_foto_cocho?: boolean },
) {
  return supabase.from("fazendas").update(valores as any).eq("id", fazendaId);
}

/** Grava a configuração do retiro. null = segue a fazenda. */
export async function salvarAuditoriaRetiro(retiroId: string, valores: AuditoriaNivel) {
  return supabase.from("retiros").update(valores as any).eq("id", retiroId);
}
