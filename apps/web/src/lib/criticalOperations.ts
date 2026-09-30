import { useEffect, useState } from "react";

/**
 * Registry of "critical operations" that must NOT be interrupted by an
 * automatic PWA reload (e.g. salga sendo preenchida, conferência em andamento,
 * mortalidade sendo registrada, sincronização ativa).
 *
 * The SW auto-update flow (src/lib/swRegistration.ts) consults this registry
 * before activating a waiting Service Worker or reloading the page.
 */

const active = new Set<string>();
const listeners = new Set<(count: number) => void>();
let counter = 0;

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(active.size);
    } catch {
      /* noop */
    }
  });
}

export function beginCriticalOperation(label = "op"): string {
  const id = `${label}-${++counter}-${Date.now()}`;
  active.add(id);
  notify();
  return id;
}

export function endCriticalOperation(id: string): void {
  if (active.delete(id)) notify();
}

export function hasCriticalOperations(): boolean {
  return active.size > 0;
}

export function onCriticalOperationsDrained(cb: () => void): () => void {
  const handler = (count: number) => {
    if (count === 0) cb();
  };
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}

/**
 * React hook: marca uma operação como crítica enquanto `active` for true.
 * O auto-reload do PWA aguarda essas operações terminarem.
 */
export function useCriticalOperation(isActive: boolean, label = "op"): void {
  useEffect(() => {
    if (!isActive) return;
    const id = beginCriticalOperation(label);
    return () => endCriticalOperation(id);
  }, [isActive, label]);
}

/**
 * React hook: true enquanto existir alguma operação crítica em andamento
 * (ex.: visita do consultor aberta). Usado para não interromper o usuário
 * com banners/reloads de atualização ao voltar do segundo plano.
 */
export function useHasCriticalOperations(): boolean {
  const [active, setActive] = useState(hasCriticalOperations());
  useEffect(() => {
    const handler = (count: number) => setActive(count > 0);
    listeners.add(handler);
    setActive(hasCriticalOperations());
    return () => {
      listeners.delete(handler);
    };
  }, []);
  return active;
}
