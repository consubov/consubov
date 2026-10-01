import type jsPDF from "jspdf";

/**
 * Coleta, durante a renderização, (a) a posição de cada foto numerada e
 * (b) a posição de cada texto "Imagem N", para depois aplicar os links internos
 * por cima do conteúdo já renderizado (sem re-renderizar nada).
 */
export interface MentionRef {
  numero: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class PhotoLinkCollector {
  private targets = new Map<number, { page: number; y: number }>();
  private refs: MentionRef[] = [];

  /** Registra onde a foto N foi desenhada (primeira ocorrência vence). */
  setTarget(numero: number, page: number, y: number) {
    if (numero == null || this.targets.has(numero)) return;
    this.targets.set(numero, { page, y });
  }

  /** Registra a área de um texto "Imagem N" para receber o link. */
  addRef(ref: MentionRef) {
    this.refs.push(ref);
  }

  /** Segunda passada: adiciona as anotações de link usando o mapa de posições. */
  apply(doc: jsPDF) {
    if (this.refs.length === 0) return;
    const current = (doc as any).getCurrentPageInfo?.()?.pageNumber ?? 1;
    for (const r of this.refs) {
      const t = this.targets.get(r.numero);
      if (!t) continue;
      try {
        doc.setPage(r.page);
        doc.link(r.x, r.y, r.w, r.h, { pageNumber: t.page, top: Math.max(0, t.y - 10) } as any);
      } catch { /* link é opcional */ }
    }
    try { doc.setPage(current); } catch { /* noop */ }
  }
}

let active: PhotoLinkCollector | null = null;

export function setActivePhotoLinks(c: PhotoLinkCollector | null) {
  active = c;
}

export function getActivePhotoLinks(): PhotoLinkCollector | null {
  return active;
}

export function currentPage(doc: jsPDF): number {
  return (doc as any).getCurrentPageInfo?.()?.pageNumber ?? 1;
}
