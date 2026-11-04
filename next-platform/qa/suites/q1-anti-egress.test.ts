import { describe, it, expect } from 'bun:test';
import { installNetworkGuard, AntiEgressViolationError } from '../harness/network-guard';

describe('Suíte Q1.6: Barreira Anti-Egress de Rede em Tempo de Execução', () => {
  it('deve interceptar e bloquear chamadas para endpoints externos', async () => {
    const uninstallGuard = installNetworkGuard();

    try {
      let threwExpectedError = false;
      try {
        await fetch('https://consubov.supabase.co/rest/v1/health');
      } catch (err) {
        if (err instanceof AntiEgressViolationError) {
          threwExpectedError = true;
        }
      }
      expect(threwExpectedError).toBe(true);

      let threwProductionError = false;
      try {
        await fetch('https://app.consubov.com.br/api/status');
      } catch (err) {
        if (err instanceof AntiEgressViolationError) {
          threwProductionError = true;
        }
      }
      expect(threwProductionError).toBe(true);
    } finally {
      uninstallGuard();
    }
  });

  it('deve permitir conexões locais herméticas (127.0.0.1 ou localhost)', async () => {
    const uninstallGuard = installNetworkGuard();

    try {
      // Cria um server local temporário para testar
      const localServer = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        fetch() {
          return new Response(JSON.stringify({ ok: true }));
        }
      });

      const res = await fetch(`http://127.0.0.1:${localServer.port}/ping`);
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.ok).toBe(true);

      localServer.stop(true);
    } finally {
      uninstallGuard();
    }
  });
});
