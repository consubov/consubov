import { handleRequest } from "./app";

type BunServer = {
  port: number;
};

type BunRuntime = {
  env: Record<string, string | undefined>;
  serve(options: {
    port: number;
    fetch(request: Request): Response | Promise<Response>;
  }): BunServer;
};

const runtime = (globalThis as typeof globalThis & { Bun?: BunRuntime }).Bun;

if (!runtime) {
  throw new Error("The Consubov API must run with Bun.");
}

const configuredPort = Number.parseInt(runtime.env.PORT ?? "3000", 10);

if (
  !Number.isInteger(configuredPort) ||
  configuredPort <= 0 ||
  configuredPort > 65535
) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = runtime.serve({
  port: configuredPort,
  fetch: handleRequest,
});

console.info(`Consubov API listening on http://127.0.0.1:${server.port}`);
