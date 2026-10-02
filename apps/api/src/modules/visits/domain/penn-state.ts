import type { VisitaId } from "./identificadores";

/**
 * Motor de cálculo do Particle Separator: apenas aritmética sobre as frações
 * pesadas na amostra, sem qualquer acesso a dado externo
 * (apps/web/src/lib/pennState.ts:1-2,36-83).
 */
export type PennStateEntrada = {
  peso_amostra_g: number;
  peso_19mm_g: number;
  peso_8mm_g: number;
  peso_4mm_g: number;
  peso_fundo_g: number;
  /** FDN da dieta em %. Sem ele, `peNDF` é null e nunca estimado (apps/web/src/lib/pennState.ts:10). */
  fdn_percentual?: number | null;
};

export type PennStateResultado = {
  soma_fracoes: number;
  diferenca_g: number;
  percentual_19mm: number;
  percentual_8mm: number;
  percentual_4mm: number;
  percentual_fundo: number;
  fef: number;
  peNDF: number | null;
  aviso_divergencia: string | null;
};

/**
 * Espelho das colunas de `penn_state_analises` (types.ts:3515-3537).
 *
 * Exclusão é soft-delete por `deleted_at`
 * (apps/web/src/lib/pennStateStore.ts:125-132). Na tela só `nome` e o peso da
 * amostra são obrigatórios; frações e FDN são opcionais e valem 0
 * (apps/web/src/components/consultor/PennStateSection.tsx:172-185), por isso as
 * colunas de peso são `number` e não `number | null`.
 *
 * As colunas de percentual gravadas não são a fonte da leitura: o app as
 * recalcula sempre pelo motor puro ao listar, porque linhas antigas foram salvas
 * com a base antiga e somariam mais de 100%
 * (apps/web/src/lib/pennStateStore.ts:100-111).
 */
export type PennStateAnaliseRecord = {
  id: string;
  visita_id: VisitaId;
  dieta_id: string | null;
  nome: string;
  ordem: number;
  peso_amostra_g: number;
  peso_19mm_g: number;
  peso_8mm_g: number;
  peso_4mm_g: number;
  peso_fundo_g: number;
  fdn_percentual_usado: number | null;
  fef: number;
  peNDF: number | null;
  percentual_19mm: number;
  percentual_8mm: number;
  percentual_4mm: number;
  percentual_fundo: number;
  aviso_divergencia: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

function numeroFinito(valor: unknown): number {
  const convertido = Number(valor);

  return Number.isFinite(convertido) ? convertido : 0;
}

function arredondarUmaDecimal(valor: number): number {
  return Math.round(valor * 10) / 10;
}

function formatarGramas(valor: number): string {
  return arredondarUmaDecimal(valor).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  });
}

export function calcularPennState(entrada: PennStateEntrada): PennStateResultado {
  const amostra = numeroFinito(entrada.peso_amostra_g);
  const peso19mm = numeroFinito(entrada.peso_19mm_g);
  const peso8mm = numeroFinito(entrada.peso_8mm_g);
  const peso4mm = numeroFinito(entrada.peso_4mm_g);
  const pesoFundo = numeroFinito(entrada.peso_fundo_g);

  const soma_fracoes = peso19mm + peso8mm + peso4mm + pesoFundo;
  const diferenca_g = arredondarUmaDecimal(amostra - soma_fracoes);

  // A base das porcentagens é a soma real das frações pesadas, não o peso da
  // amostra informada: é a metodologia do Particle Separator
  // (apps/web/src/lib/pennState.ts:46-49).
  const base = soma_fracoes;
  const percentual = (peso: number): number =>
    base > 0 ? arredondarUmaDecimal((peso / base) * 100) : 0;

  const percentual_19mm = percentual(peso19mm);
  const percentual_8mm = percentual(peso8mm);
  const percentual_4mm = percentual(peso4mm);
  const percentual_fundo = percentual(pesoFundo);

  // O fundo de peneira não entra no FEF (apps/web/src/lib/pennState.ts:56-57).
  const fef = arredondarUmaDecimal(percentual_19mm + percentual_8mm + percentual_4mm);

  const fdn = entrada.fdn_percentual;
  const peNDF =
    fdn === null || fdn === undefined || !Number.isFinite(Number(fdn))
      ? null
      : arredondarUmaDecimal((fef * Number(fdn)) / 100);

  const aviso_divergencia =
    diferenca_g !== 0
      ? `A soma das frações é ${formatarGramas(soma_fracoes)}g, enquanto o peso informado da amostra foi ${formatarGramas(
          amostra,
        )}g. Diferença de ${formatarGramas(diferenca_g)}g.`
      : null;

  return {
    soma_fracoes,
    diferenca_g,
    percentual_19mm,
    percentual_8mm,
    percentual_4mm,
    percentual_fundo,
    fef,
    peNDF,
    aviso_divergencia,
  };
}