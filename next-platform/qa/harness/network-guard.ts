export class AntiEgressViolationError extends Error {
  constructor(url: string) {
    super(`[VIOLAÇÃO DE ANTI-EGRESS] Tentativa de conexão externa bloqueada para: ${url}. O laboratório opera em isolamento estrito.`);
    this.name = 'AntiEgressViolationError';
  }
}

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export function installNetworkGuard(): () => void {
  const originalFetch = globalThis.fetch;

  const guardedFetch: any = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlString = typeof input === 'string' 
      ? input 
      : input instanceof URL 
        ? input.toString() 
        : (input as Request).url;

    try {
      const parsed = new URL(urlString);
      if (!ALLOWED_HOSTS.has(parsed.hostname)) {
        throw new AntiEgressViolationError(urlString);
      }
    } catch (err) {
      if (err instanceof AntiEgressViolationError) throw err;
      // URLs relativas ou locais continuam
    }

    return originalFetch(input, init);
  };

  // Preserva propriedades adicionais de fetch como preconnect
  Object.assign(guardedFetch, originalFetch);
  globalThis.fetch = guardedFetch;

  // Retorna função para restaurar fetch
  return () => {
    globalThis.fetch = originalFetch;
  };
}
