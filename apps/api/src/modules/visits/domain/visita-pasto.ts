import type { PastoId } from "../../pastures";
import type { VisitaId } from "./identificadores";

/**
 * Espelho das colunas de `visita_pastos` (types.ts:6181-6207).
 *
 * `pasto_id` é opcional (types.ts:6197) porque a conferência do admin grava o
 * pasto conferido sem vínculo com o cadastro de pastos
 * (conferenciaAdminVisita.ts:285-287). `retiro_nome` e `fazenda_nome` são cópias
 * textuais enviadas pela conferência, não referências (types.ts:6201,6189).
 */
export type VisitaPastoRecord = {
  id: string;
  visita_id: VisitaId;
  pasto_id: PastoId | null;
  letra: string;
  ordem: number;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  consumo_esperado_kg: number | null;
  consumo_real_kg: number | null;
  meta_g_100kg: number | null;
  categoria: string | null;
  sexo: string | null;
  peso_medio_kg: number | null;
  area_alqueires: number | null;
  observacao: string | null;
  retiro_nome: string | null;
  fazenda_nome: string | null;
  ultima_salga: string | null;
  ultima_salga_sacos: number | null;
  consumo_medio_g: number | null;
  dias_consumo: number | null;
  kg_consumidos: number | null;
};

/** Letras disponíveis do pasto: A..Z (VisitaTecnicaPage.tsx:44-51). */
const LETRAS_PASTO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Próxima letra livre do pasto. Devolve "" quando as 26 letras já estão em uso,
 * exatamente como o app (VisitaTecnicaPage.tsx:46-50), para que a ausência de
 * letra disponível não seja mascarada por um valor inventado.
 */
export function proximaLetraPasto(
  pastos: readonly { letra: string }[],
): string {
  const usadas = new Set(pastos.map((pasto) => pasto.letra.toUpperCase()));

  for (let indice = 0; indice < LETRAS_PASTO.length; indice++) {
    const letra = LETRAS_PASTO[indice];
    if (!usadas.has(letra)) return letra;
  }

  return "";
}

/**
 * `ordem` seguinte = maior `ordem` existente + 1; sem pastos, começa em 0
 * (VisitaTecnicaPage.tsx:210).
 */
export function proximaOrdem(pastos: readonly { ordem: number }[]): number {
  if (pastos.length === 0) return 0;

  return Math.max(...pastos.map((pasto) => pasto.ordem)) + 1;
}