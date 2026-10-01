/**
 * Menções a fotos dentro de textos (tópicos, currais, pastos).
 * Marcador salvo no banco: [[foto:N]] — N é o número sequencial global da foto na visita.
 * Renderização: "Imagem N" (chip no app, texto com link interno no PDF).
 */

export const FOTO_MENTION_PATTERN = "\\[\\[foto:(\\d+)\\]\\]";

export function fotoMarker(numero: number): string {
  return `[[foto:${numero}]]`;
}

/** Converte todos os marcadores em texto legível "Imagem N". */
export function mentionsToText(text: string | null | undefined): string {
  return String(text ?? "").replace(new RegExp(FOTO_MENTION_PATTERN, "g"), (_m, n) => `Imagem ${n}`);
}

/** Lista (única, em ordem de aparição) dos números mencionados no texto. */
export function extractMentions(text: string | null | undefined): number[] {
  const re = new RegExp(FOTO_MENTION_PATTERN, "g");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text ?? "")))) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

export function hasMentions(text: string | null | undefined): boolean {
  return new RegExp(FOTO_MENTION_PATTERN).test(String(text ?? ""));
}

/** Insere o marcador na posição do cursor, cuidando dos espaços ao redor. */
export function insertMentionAt(
  text: string | null | undefined,
  caret: number,
  numero: number,
): { text: string; caret: number } {
  const base = String(text ?? "");
  const pos = Math.max(0, Math.min(caret ?? base.length, base.length));
  const before = base.slice(0, pos);
  const after = base.slice(pos);
  const marker = fotoMarker(numero);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const suffix = after && !/^\s/.test(after) ? " " : "";
  const inserted = `${prefix}${marker}${suffix}`;
  return { text: before + inserted + after, caret: pos + inserted.length };
}
