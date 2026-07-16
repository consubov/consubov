/**
 * Numeração global de fotos por visita.
 *
 * A ordem de numeração segue a ordem que o PDF final renderiza:
 *
 * Rotina:
 *   1) Tópicos introdutórios (ordem 1..3) — cada um com suas fotos
 *   2) Tópicos customizados (ordem 5..1000)
 *   3) Pastos (na ordem exibida) — cada um com até 5 fotos
 *   4) Tópicos de encerramento (ordem 1001+)
 *
 * Confinamento:
 *   1) Currais (na ordem `ordem`) — cada um com suas fotos
 *   2) Blocos introdutórios / conclusão não têm fotos anexadas via tópicos.
 *
 * Fábrica:
 *   1) Tópicos customizados (ordem 5..1000)
 *   2) Tópicos de encerramento (1001+)
 *
 * A função retorna um `Record<photoId, number>` puramente para exibição/render
 * — não persiste nada.
 */

export interface FotoRefLike {
  id: string;
  ordem: number;
}

export interface TopicoLike {
  id: string;
  ordem: number;
  fotos: FotoRefLike[];
}

export interface PastoOrCurralLike {
  id: string;
  fotos: FotoRefLike[];
}

function sortFotos(fs: FotoRefLike[]) {
  return [...fs].sort((a, b) => a.ordem - b.ordem);
}

export function computeRotinaPhotoNumbering(
  topicos: TopicoLike[],
  pastos: PastoOrCurralLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  const fixos = sorted.filter(t => t.ordem <= 3);
  const customs = sorted.filter(t => t.ordem >= 5 && t.ordem <= 1000);
  const footer = sorted.filter(t => t.ordem >= 1001);
  for (const t of fixos) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const t of customs) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const p of pastos) for (const f of sortFotos(p.fotos)) map[f.id] = n++;
  for (const t of footer) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  return map;
}

export function computeConfinamentoPhotoNumbering(
  currais: PastoOrCurralLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  for (const c of currais) for (const f of sortFotos(c.fotos)) map[f.id] = n++;
  return map;
}

export function computeFabricaPhotoNumbering(
  topicos: TopicoLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  for (const t of sorted) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  return map;
}
