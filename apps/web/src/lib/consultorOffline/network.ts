export const CONSULTOR_NETWORK_TIMEOUT_MS = 30_000;
// Upload de fotos em campo (4G fraco) precisa de folga: 90s.
export const CONSULTOR_PHOTO_UPLOAD_TIMEOUT_MS = 90_000;
export const CONSULTOR_PHOTO_CONFIRM_TIMEOUT_MS = 60_000;
export const CONSULTOR_SYNC_ATTEMPTS = 3;

export function getErrorMessage(error: unknown): string {
  if (!error) return "erro desconhecido";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "erro desconhecido");
  return String(error);
}

export function withConsultorTimeout<T>(
  promise: PromiseLike<T>,
  etapa: string,
  ms = CONSULTOR_NETWORK_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${etapa}: tempo limite de ${Math.round(ms / 1000)}s excedido`)),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (error) => { window.clearTimeout(timer); reject(error); },
    );
  });
}

export async function fetchWithConsultorTimeout(
  input: RequestInfo | URL,
  etapa: string,
  init?: RequestInit,
  ms = CONSULTOR_NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new Error(`${etapa}: tempo limite de ${Math.round(ms / 1000)}s excedido`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function retryDelayMs(attempt: number): number {
  return Math.min(4_000, 700 * attempt);
}