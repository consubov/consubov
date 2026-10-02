import type { PastoId, RetiroId } from "./identity";

/**
 * `fazenda_id` é texto puro aqui: o identificador de fazenda é propriedade do
 * módulo `farms`, e a fazenda não carrega tenant.
 */
export type RetiroRecord = {
  id: RetiroId;
  nome: string;
  fazenda_id: string;
  capataz: string;
  ativo: boolean | null;
  produto_id: string | null;
  intervalo_padrao_dias: number | null;
  gmd_recria1: number | null;
  gmd_recria2: number | null;
  gmd_engorda: number | null;
  consumo_recria1: number | null;
  consumo_recria2: number | null;
  consumo_engorda: number | null;
  margem_recria1: number | null;
  margem_recria2: number | null;
  margem_engorda: number | null;
  peso_abate_kg: number | null;
  peso_saco_kg: number | null;
  preco_por_kg: number | null;
  sexo_padrao: string | null;
  ultima_salga_em: string | null;
  alerta_atraso_enviado: boolean;
  exigir_foto_cocho: boolean | null;
  auditoria_fotos_por_bloco: number | null;
  estoque_sacos: number | null;
  criado_em: string | null;
};

/**
 * Colunas comprovadas de `pastos` (types.ts:3288-3317). Não existem
 * `area_ha` nem `data_fim` nessa tabela: a área do pasto só existe como amostra
 * da visita técnica, e a validade do pasto é dada por `ativo`.
 */
export type PastoRecord = {
  id: PastoId;
  nome: string;
  retiro_id: RetiroId;
  ativo: boolean | null;
  num_animais: number;
  peso_medio_kg: number | null;
  peso_entrada: number | null;
  peso_abate_meta_kg: number | null;
  peso_motor_kg: number | null;
  peso_motor_data: string | null;
  ultima_pesagem_em: string | null;
  data_entrada: string | null;
  data_movimentacao: string | null;
  dias_no_pasto: number | null;
  gmd_kg_dia: number | null;
  intervalo_padrao_dias: number | null;
  categoria: string | null;
  sexo: string | null;
  produto_id: string | null;
  pasto_origem_id: PastoId | null;
  qr_uuid: string;
  data_fim_carencia: string | null;
  ultimo_evento_sanitario_id: string | null;
  label_offset_x: number | null;
  label_offset_y: number | null;
  label_rotation: number | null;
  criado_em: string | null;
};

/**
 * Colunas comprovadas de `ocupacoes_pasto` (types.ts:3108-3121).
 *
 * `data_saida` é nullable por schema, mas nenhum código do legado consulta
 * `data_saida IS NULL`; portanto não existe regra comprovada de "ocupação ativa"
 * e a porta de leitura não a expõe. `lote_id` aponta para `lotes.id`
 * (types.ts:3164-3167), e não existe regra comprovada de equivalência lote ≡ pasto.
 */
export type OcupacaoPastoRecord = {
  id: string;
  ciclo_id: string | null;
  fazenda_id: string;
  retiro_id: RetiroId;
  pasto_id: PastoId;
  lote_id: string;
  produto_id: string | null;
  data_entrada: string;
  data_saida: string | null;
  num_animais_entrada: number | null;
  criado_em: string;
};
