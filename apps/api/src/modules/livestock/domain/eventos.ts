import type { PastoId, RetiroId } from "../../pastures";

/**
 * Rastreabilidade de eventos de rebanho. O rebanho do domínio principal é
 * contagem agregada por pasto (`pastos.num_animais`), sem identidade individual
 * por cabeça; aqui ficam apenas os lançamentos de fato que saem ou mudam de
 * pasto, cada um com data, mês, ano e autor.
 *
 * As chaves `fazenda_id`/`retiro_id`/`pasto_id` espelham a DDL
 * (apps/web/src/integrations/supabase/types.ts:62-121, :2865-2911, :2913-2959).
 * `fazenda_id` é texto puro porque o identificador de fazenda é do módulo `farms`.
 */

export type AbateRebanho = {
  id: string;
  fazenda_id: string;
  retiro_id: RetiroId;
  pasto_id: PastoId;
  quantidade: number;
  data: string;
  mes: number;
  ano: number;
  usuario_id: string | null;
  created_at: string;
};

export type MortalidadeRebanho = {
  id: string;
  fazenda_id: string;
  retiro_id: RetiroId;
  pasto_id: PastoId;
  quantidade: number;
  data: string;
  mes: number;
  ano: number;
  observacao: string | null;
  /** NOT NULL no banco (types.ts:2872). */
  foto_url: string;
  /** Coluna anulável, mas o fluxo de capataz exige a foto do brinco (MortalidadeModal.tsx:123). */
  foto_brinco_url: string | null;
  usuario_id: string | null;
  created_at: string;
};

/**
 * Uma movimentação sempre tem os dois lados: `pasto_origem_id` e
 * `pasto_destino_id` são NOT NULL (types.ts:2937-2938). Não existe na DDL nem no
 * legado o evento de apenas uma ponta, então o par é a unidade do registro.
 * A decisão de validade do par e da quantidade é de `pastures`
 * (`decidirTransferenciaEntrePastos`); aqui o lançamento é só o rastro.
 */
export type MovimentacaoRebanho = {
  id: string;
  fazenda_id: string;
  retiro_id: RetiroId;
  pasto_origem_id: PastoId;
  pasto_destino_id: PastoId;
  quantidade: number;
  peso_medio: number | null;
  categoria: string | null;
  data: string;
  mes: number;
  ano: number;
  usuario_id: string | null;
  created_at: string;
};
