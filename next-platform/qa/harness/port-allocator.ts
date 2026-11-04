import { createServer } from 'net';

export async function allocateAvailablePort(preferredPort: number = 3334): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', () => {
      // Se porta preferencial estiver ocupada, pede porta aleatória ao sistema
      const fallbackServer = createServer();
      fallbackServer.unref();
      fallbackServer.on('error', reject);
      fallbackServer.listen(0, '127.0.0.1', () => {
        const address = fallbackServer.address();
        if (address && typeof address === 'object') {
          const port = address.port;
          fallbackServer.close(() => resolve(port));
        } else {
          fallbackServer.close(() => resolve(3339));
        }
      });
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => resolve(preferredPort));
      }
    });
  });
}
