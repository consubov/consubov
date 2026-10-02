/**
 * Dia-calendário em America/Sao_Paulo.
 *
 * Diferença bruta de instantes erra por causa das horas: o mesmo dia pode dar 0
 * ou 1 dia dependendo da hora (diasCalendario.ts:1-7). Por isso toda
 * comparação de data de pesagem passa por aqui.
 */
const TZ = "America/Sao_Paulo";

export type EntradaData = Date | string | number;

/** `YYYY-MM-DD` no fuso America/Sao_Paulo; string vazia se a data for inválida. */
export function dataLocalSaoPaulo(entrada: EntradaData): string {
  const data = entrada instanceof Date ? entrada : new Date(entrada);

  if (Number.isNaN(data.getTime())) return "";

  return data.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Índice do dia-calendário, seguro para subtração sem passar por horas. */
function indiceDia(entrada: EntradaData): number | null {
  const iso = dataLocalSaoPaulo(entrada);
  if (!iso) return null;

  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia) / 86400000;
}

/** Dias de calendário (`ate - de`); `null` se alguma data for inválida. */
export function diasCalendarioSP(de: EntradaData, ate: EntradaData): number | null {
  const inicio = indiceDia(de);
  const fim = indiceDia(ate);

  if (inicio === null || fim === null) return null;

  return fim - inicio;
}