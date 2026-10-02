import { dataLocalSaoPaulo, diasCalendarioSP } from "./calendario";
import type { PesagemId } from "./identity";

/**
 * Dia de calendário entre duas pesagens; `null` quando não há dias positivos
 * (pecuaristaData.ts:10-13). GMD não é calculado para pesagens do mesmo dia.
 */
export function diasEntrePesagens(
  dataAnterior: string,
  dataAtual: string,
): number | null {
  const dias = diasCalendarioSP(dataAnterior, dataAtual);

  return dias != null && dias > 0 ? dias : null;
}

/** Pesagem anterior candidata a fornecer o peso base do GMD. */
export type PesagemAnteriorCandidata<TPeso> = {
  readonly pesagemLoteId: PesagemId;
  readonly dataPesagem: string | null;
  readonly peso: TPeso;
};

/**
 * Escolhe a pesagem anterior de maior `data_pesagem` estritamente anterior ao dia
 * da pesagem atual, excluindo a própria pesagem atual
 * (pecuaristaData.ts:16-25).
 *
 * O corte é por dia-calendário e a ordenação por instante: duas pesagens no
 * mesmo dia podem sair na ordem bruta das horas. É o comportamento do cliente e
 * foi mantido como está.
 */
export function escolherPesoAnterior<TPeso>(
  linhas: readonly PesagemAnteriorCandidata<TPeso>[],
  dataAtual: string,
  pesagemAtualId?: PesagemId,
): PesagemAnteriorCandidata<TPeso> | null {
  const diaAtual = dataLocalSaoPaulo(dataAtual);
  if (!diaAtual) return null;

  const anteriores = linhas
    .filter((linha) => linha.pesagemLoteId !== pesagemAtualId)
    .filter((linha) => !!linha.dataPesagem)
    .filter(
      (linha) =>
        dataLocalSaoPaulo(linha.dataPesagem as string) < diaAtual,
    )
    .sort(
      (a, b) =>
        new Date(b.dataPesagem as string).getTime() -
        new Date(a.dataPesagem as string).getTime(),
    );

  return anteriores[0] ?? null;
}

/**
 * GMD individual: `(peso - pesoAnterior) / dias`; `null` sem peso anterior ou sem
 * dias positivos (PecuaristaPesagemExecPage.tsx:424-427,
 * maGmdResync.ts:44-48).
 *
 * O GMD de projeção não entra aqui: a fonte dele é a função `gmd_do_pasto` no
 * banco e o aplicativo não recalcula (gmdConfigurado.ts:3-6).
 */
export function calcularGmdIndividual(input: {
  pesoAtualKg: number;
  pesoAnteriorKg: number | null;
  dias: number | null;
}): number | null {
  if (input.pesoAnteriorKg == null) return null;
  if (!input.dias || input.dias <= 0) return null;

  return (input.pesoAtualKg - input.pesoAnteriorKg) / input.dias;
}

/**
 * GMD do lote sem identificação: mesma fórmula sobre o peso médio
 * (maGmdResync.ts:68-72, PecuaristaPesagemExecPage.tsx:576-582).
 *
 * O peso anterior só vem de pesagens com quantidade de animais maior que zero
 * (PecuaristaPesagemExecPage.tsx:522, :571; maGmdResync.ts:62).
 */
export function calcularGmdLote(input: {
  pesoMedioAtualKg: number;
  pesoMedioAnteriorKg: number | null;
  dias: number | null;
}): number | null {
  return calcularGmdIndividual({
    pesoAtualKg: input.pesoMedioAtualKg,
    pesoAnteriorKg: input.pesoMedioAnteriorKg,
    dias: input.dias,
  });
}