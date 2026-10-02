/** Zonas do relatório de visita (apps/web/src/lib/photoNumbering.ts:14). */
export const VISITA_ZONAS = ["introducao", "desenvolvimento", "conclusao"] as const;

export type VisitaZona = (typeof VISITA_ZONAS)[number];

/** A partir desta ordem o tópico é da zona de conclusão (photoNumbering.ts:29). */
export const ORDEM_ZONA_CONCLUSAO = 1001;

/** A partir desta ordem o tópico é da zona de desenvolvimento (photoNumbering.ts:30). */
export const ORDEM_ZONA_DESENVOLVIMENTO = 5;

/**
 * Zona do tópico: a zona gravada tem precedência; sem zona gravada, a ordem
 * decide — `>= 1001` é conclusão, `5..1000` é desenvolvimento e qualquer
 * anterior é introdução (apps/web/src/lib/photoNumbering.ts:27-32).
 */
export function zonaDaOrdem(
  ordem: number,
  zona?: VisitaZona | null,
): VisitaZona {
  if (zona) return zona;
  if (ordem >= ORDEM_ZONA_CONCLUSAO) return "conclusao";
  if (ordem >= ORDEM_ZONA_DESENVOLVIMENTO) return "desenvolvimento";

  return "introducao";
}