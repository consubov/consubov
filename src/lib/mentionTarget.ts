/**
 * Registro em memória do campo de texto ativo (para menções de foto)
 * e das fotos numeradas visíveis na tela (para rolar/destacar ao clicar num chip).
 */

import { useSyncExternalStore } from "react";

export interface MentionTarget {
  /** Identificador estável do campo (ex.: `topico:<id>`). */
  id: string;
  /** Rótulo curto exibido na confirmação (ex.: "Texto do tópico"). */
  label?: string;
  /** Insere o marcador da foto na posição atual do cursor. */
  insert: (numero: number) => void;
}

let activeTarget: MentionTarget | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function setActiveMentionTarget(t: MentionTarget) {
  activeTarget = t;
  emit();
}

export function clearActiveMentionTarget(id?: string) {
  if (!id || activeTarget?.id === id) {
    activeTarget = null;
    emit();
  }
}

export function getActiveMentionTarget(): MentionTarget | null {
  return activeTarget;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useActiveMentionTarget(): MentionTarget | null {
  return useSyncExternalStore(subscribe, getActiveMentionTarget, () => null);
}

/* ---------- Registro de fotos numeradas na tela ---------- */

const photoEls = new Map<number, HTMLElement>();

export function registerPhotoElement(numero: number, el: HTMLElement | null): () => void {
  if (numero == null || !el) return () => {};
  photoEls.set(numero, el);
  return () => {
    if (photoEls.get(numero) === el) photoEls.delete(numero);
  };
}

/** Rola até a foto N e a destaca brevemente. Retorna false se não estiver na tela. */
export function scrollToPhoto(numero: number): boolean {
  const el = photoEls.get(numero);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-offset-2");
  el.style.setProperty("--tw-ring-color", "#C9A84C");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-offset-2");
  }, 1800);
  return true;
}
