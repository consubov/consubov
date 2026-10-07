/**
 * Entry point do app mobile — FASE 6.2
 *
 * Boot do app: inicializa adapters nativos e monta o PlatformProvider
 * com o mesmo conjunto de contratos que a Web consome. A UI do app
 * (React) é a mesma do apps/web — aqui apenas injetamos os adapters
 * nativos em vez dos adapters Web.
 *
 * Uso: em main.tsx (Capacitor) chama bootstrap() antes de renderizar <App/>.
 */
import { createPlatformAdapters, type PlatformAdapters } from "./adapters";
import type { PlatformProviderProps } from "@consubov/web/platform";

/** Inicializa adapters nativos. Chamado uma vez no boot. */
export function bootstrap(): PlatformAdapters {
  return createPlatformAdapters();
}

/** Re-export para tipagem do PlatformProvider. */
export type { PlatformProviderProps };