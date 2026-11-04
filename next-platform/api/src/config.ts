export const API_CONFIG = {
  port: Number(process.env.PORT || 3333),
  host: process.env.HOST || '127.0.0.1',
  serviceName: 'consubov-mock-api',
  version: '0.1.0-incubated',
  environment: 'local_isolated_lab'
} as const;
