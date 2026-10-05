import { routes } from './routes';
import { jsonResponse } from './http';

describe('API routes', () => {
  test('sync lancamento endpoint returns 501', async () => {
    const route = routes.find(r => r.path === '/api/v1/sync/lancamento' && r.method === 'POST');
    expect(route).toBeDefined();
    const resp = await route!.handler(new Request('http://localhost/api/v1/sync/lancamento', { method: 'POST' }), 'req-1', 'corr-1') as Response;
    expect(resp.status).toBe(501);
    const body = await resp.json();
    expect(body.message).toMatch(/not yet implemented/i);
  });

  test('close month endpoint returns 501', async () => {
    const route = routes.find(r => r.path === '/api/v1/sync/close-month' && r.method === 'POST');
    expect(route).toBeDefined();
    const resp = await route!.handler(new Request('http://localhost/api/v1/sync/close-month', { method: 'POST' }), 'req-2', 'corr-2') as Response;
    expect(resp.status).toBe(501);
    const body = await resp.json();
    expect(body.message).toMatch(/not yet implemented/i);
  });
});
