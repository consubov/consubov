// Motor de cálculo puro — Análise Penn State (Particle Separator).
// Sem UI, sem banco, sem PDF. Apenas funções testáveis.

export type PennStateInput = {
  peso_amostra_g: number;
  peso_19mm_g: number;
  peso_8mm_g: number;
  peso_4mm_g: number;
  peso_fundo_g: number;
  /** FDN da dieta em % (opcional). Sem ele, peNDF = null (nunca estimar). */
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

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const round1 = (v: number): number => Math.round(v * 10) / 10;

const fmtG = (v: number): string =>
  round1(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function calcularPennState(input: PennStateInput): PennStateResultado {
  const amostra = n(input.peso_amostra_g);
  const p19 = n(input.peso_19mm_g);
  const p8 = n(input.peso_8mm_g);
  const p4 = n(input.peso_4mm_g);
  const pFundo = n(input.peso_fundo_g);

  const soma_fracoes = p19 + p8 + p4 + pFundo;
  const diferenca_g = round1(amostra - soma_fracoes);

  // Base das porcentagens: SOMA REAL das frações pesadas (metodologia Penn State).
  const base = soma_fracoes;

  const pct = (v: number) => (base > 0 ? round1((v / base) * 100) : 0);

  const percentual_19mm = pct(p19);
  const percentual_8mm = pct(p8);
  const percentual_4mm = pct(p4);
  const percentual_fundo = pct(pFundo);

  // Fundo NÃO entra no FEF.
  const fef = round1(percentual_19mm + percentual_8mm + percentual_4mm);

  const fdn = input.fdn_percentual;
  const peNDF =
    fdn === null || fdn === undefined || !Number.isFinite(Number(fdn))
      ? null
      : round1((fef * Number(fdn)) / 100);

  const aviso_divergencia =
    diferenca_g !== 0
      ? `A soma das frações é ${fmtG(soma_fracoes)}g, enquanto o peso informado da amostra foi ${fmtG(
          amostra,
        )}g. Diferença de ${fmtG(diferenca_g)}g.`
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
