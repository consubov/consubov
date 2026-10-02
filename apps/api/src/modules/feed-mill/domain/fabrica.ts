import type { FabricaId } from "./identifiers";

/**
 * O QR da fábrica pode ser lido como o código impresso ou como o próprio
 * identificador da fábrica, e o valor lido é comparado sem espaços nas pontas.
 *
 * Sem código cadastrado o identificador da fábrica é a única referência aceita,
 * porque o código é opcional.
 * Origem: apps/web/src/components/fabrica/ProducaoTab.tsx:288-300.
 */
export function qrIdentificaFabrica(
  scanned: string | null | undefined,
  qrCode: string | null | undefined,
  fabricaId: FabricaId,
): boolean {
  const scannedTrim = (scanned || "").trim();
  if (!scannedTrim) return false;

  const referencia = (qrCode || fabricaId).trim();
  const alternativa = fabricaId.trim();

  return scannedTrim === referencia || scannedTrim === alternativa;
}
