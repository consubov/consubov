/**
 * Numeração global de fotos por visita — sequência única e contínua.
 * A ordem segue exatamente o que o PDF final renderiza.
 */

export interface FotoRefLike {
  id: string;
  ordem: number;
}

export interface TopicoLike {
  id: string;
  ordem: number;
  zona?: "introducao" | "desenvolvimento" | "conclusao";
  fotos: FotoRefLike[];
}

export interface PastoOrCurralLike {
  id: string;
  fotos: FotoRefLike[];
}

function sortFotos(fs: FotoRefLike[]) {
  return [...fs].sort((a, b) => a.ordem - b.ordem);
}

function zonaOf(t: TopicoLike): "introducao" | "desenvolvimento" | "conclusao" {
  if (t.zona) return t.zona;
  if (t.ordem >= 1001) return "conclusao";
  if (t.ordem >= 5 && t.ordem <= 1000) return "desenvolvimento";
  return "introducao";
}

/**
 * Rotina: intro topicos → pastos → dev topicos → conclusao topicos
 * (mesma ordem do PDF de rotina)
 */
export function computeRotinaPhotoNumbering(
  topicos: TopicoLike[],
  pastos: PastoOrCurralLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  const intro = sorted.filter(t => zonaOf(t) === "introducao");
  const dev = sorted.filter(t => zonaOf(t) === "desenvolvimento");
  const conc = sorted.filter(t => zonaOf(t) === "conclusao");
  for (const t of intro) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const p of pastos) for (const f of sortFotos(p.fotos)) map[f.id] = n++;
  for (const t of dev) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const t of conc) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  return map;
}

/**
 * Confinamento: intro topicos → currais → dev topicos → conclusao topicos
 */
export function computeConfinamentoPhotoNumbering(
  currais: PastoOrCurralLike[],
  topicos?: TopicoLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  const sorted = [...(topicos || [])].sort((a, b) => a.ordem - b.ordem);
  const intro = sorted.filter(t => zonaOf(t) === "introducao");
  const dev = sorted.filter(t => zonaOf(t) === "desenvolvimento");
  const conc = sorted.filter(t => zonaOf(t) === "conclusao");
  for (const t of intro) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const c of currais) for (const f of sortFotos(c.fotos)) map[f.id] = n++;
  for (const t of dev) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const t of conc) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  return map;
}

/**
 * Fábrica: apenas tópicos (na ordem intro → dev → conclusao).
 */
export function computeFabricaPhotoNumbering(
  topicos: TopicoLike[],
): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  const sorted = [...topicos].sort((a, b) => a.ordem - b.ordem);
  const intro = sorted.filter(t => zonaOf(t) === "introducao");
  const dev = sorted.filter(t => zonaOf(t) === "desenvolvimento");
  const conc = sorted.filter(t => zonaOf(t) === "conclusao");
  for (const t of intro) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const t of dev) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  for (const t of conc) for (const f of sortFotos(t.fotos)) map[f.id] = n++;
  return map;
}
