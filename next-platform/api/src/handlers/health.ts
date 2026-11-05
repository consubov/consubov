import { API_CONFIG } from '../config';

const startTime = Date.now();

export function handleHealthRequest(): Response {
  const uptimeSeconds = (Date.now() - startTime) / 1000;

  const data = {
    status: 'ok',
    service: API_CONFIG.serviceName,
    version: API_CONFIG.version,
    environment: API_CONFIG.environment,
    uptime_seconds: Number(uptimeSeconds.toFixed(2)),
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
