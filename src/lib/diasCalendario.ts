/**
 * Diferença de dias por CALENDÁRIO no timezone America/Sao_Paulo.
 *
 * Mesmo padrão usado no SQL (`view_consumo_tempo_real`, `verificar_salgas_atrasadas()`):
 * ambas as datas são normalizadas para o início do dia em America/Sao_Paulo antes
 * de subtrair — evita erros causados por diferença bruta de instantes (horas).
 */

const TZ = "America/Sao_Paulo";

type DateInput = Date | string | number;

/** Retorna a data (YYYY-MM-DD) no timezone America/Sao_Paulo. */
export function dataLocalSP(input: DateInput): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Converte para o "meio-dia UTC" do dia-calendário SP, seguro para subtração. */
function diaIndex(input: DateInput): number | null {
  const iso = dataLocalSP(input);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

/**
 * Dias de calendário entre `de` e `ate` (ate - de), em America/Sao_Paulo.
 * Retorna null se alguma data for inválida.
 */
export function diasCalendarioSP(de: DateInput, ate: DateInput = new Date()): number | null {
  const a = diaIndex(de);
  const b = diaIndex(ate);
  if (a === null || b === null) return null;
  return b - a;
}
