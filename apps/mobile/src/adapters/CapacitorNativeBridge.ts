/**
 * CapacitorNativeBridge — FASE 6.1/6.2/6.6
 * Contrato: apps/web/src/platform/contracts/index.ts :: NativeBridge
 *   interface NativeBridge { invoke<T>(method: string, args?: any): Promise<T> }
 *
 * Roteamento de métodos para implementações concretas. Não existe um plugin
 * Capacitor genérico de "invoke": a ponte é uma tabela de handlers registrados
 * no app nativo. Este adapter é o ponto de extensão onde o app mobile registra
 * os handlers (ver registerNativeHandler) e a Web chama invoke("metodo", args).
 *
 * Regras: método desconhecido falha com erro tipado (nunca retorna silencioso
 * `null as T`, o que mascararia bugs de contrato nos consumidores Web).
 */

export interface NativeBridge {
  invoke<T>(method: string, args?: any): Promise<T>;
}

export class UnknownNativeMethodError extends Error {
  readonly code = "UNKNOWN_NATIVE_METHOD";
  constructor(readonly method: string) {
    super(`Método nativo não registrado: ${method}`);
    this.name = "UnknownNativeMethodError";
  }
}

export type NativeHandler = (args?: any) => Promise<unknown>;

const handlers = new Map<string, NativeHandler>();

/** Registra (ou substitui) um handler nativo. Usado pelo boot do app mobile. */
export function registerNativeHandler(method: string, handler: NativeHandler): void {
  handlers.set(method, handler);
}

export function clearNativeHandlers(): void {
  handlers.clear();
}

export function listNativeHandlers(): string[] {
  return [...handlers.keys()].sort();
}

export function createCapacitorNativeBridge(): NativeBridge {
  return {
    async invoke<T>(method: string, args?: any): Promise<T> {
      const handler = handlers.get(method);
      if (!handler) throw new UnknownNativeMethodError(method);
      return (await handler(args)) as T;
    },
  };
}