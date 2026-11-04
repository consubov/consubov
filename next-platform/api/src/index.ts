import { API_CONFIG } from './config';
import { InMemoryLedger } from './ledger/in-memory-ledger';
import { createRouter } from './router';

export function createApiServer(
  port: number = API_CONFIG.port,
  hostname: string = API_CONFIG.host,
  customLedger?: InMemoryLedger
) {
  const ledger = customLedger || new InMemoryLedger();
  const fetchHandler = createRouter(ledger);

  const server = Bun.serve({
    port,
    hostname,
    fetch: fetchHandler
  });

  return {
    server,
    ledger,
    port: server.port,
    hostname: server.hostname,
    stop: () => server.stop(true)
  };
}

// Inicia automaticamente quando executado como script direto
if (import.meta.main) {
  const instance = createApiServer();
  console.log(`[API Mock] Servidor CONSUBOV rodando em http://${instance.hostname}:${instance.port}`);
}

export * from './config';
export * from './ledger/in-memory-ledger';
export * from './router';
