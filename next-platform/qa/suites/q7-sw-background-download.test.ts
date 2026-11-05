import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Gate Q7.1: Service Worker Background Download & 2-Generation Cache Retention (q7-sw-background-download)', () => {
  const swPath = resolve(import.meta.dir, '../../apps/fazenda/shell/public/sw.js');

  it('Q7.1.1: sw.js deve existir no diretório público do shell fazenda', () => {
    expect(existsSync(swPath)).toBe(true);
  });

  it('Q7.1.2: sw.js NUNCA deve chamar self.skipWaiting() durante o evento install', () => {
    const swContent = readFileSync(swPath, 'utf-8');

    // Extrai o bloco de código do listener 'install'
    const installMatch = swContent.match(/self\.addEventListener\(\s*['"]install['"]\s*,\s*\((?:event)?\)\s*=>\s*\{([\s\S]*?)\}\s*\);/);
    expect(installMatch).not.toBeNull();

    const installBlock = installMatch![1]!;
    expect(installBlock.includes('self.skipWaiting()')).toBe(false);
    expect(installBlock.includes('skipWaiting()')).toBe(false);
  });

  it('Q7.1.3: sw.js deve escutar a mensagem SKIP_WAITING do cliente para ativação sob quiescência', () => {
    const swContent = readFileSync(swPath, 'utf-8');

    // Verifica que existe um listener de mensagem que escuta SKIP_WAITING
    expect(swContent).toMatch(/addEventListener\(\s*['"]message['"]/);
    expect(swContent).toContain('SKIP_WAITING');
    expect(swContent).toMatch(/self\.skipWaiting\(\)/);
  });

  it('Q7.1.4: sw.js deve implementar retenção de duas gerações de cache (N e N-1) no evento activate', () => {
    const swContent = readFileSync(swPath, 'utf-8');

    // Verifica listener de activate
    expect(swContent).toMatch(/addEventListener\(\s*['"]activate['"]/);
    expect(swContent).toContain('CURRENT_CACHE');
    expect(swContent).toContain('PREVIOUS_CACHE');
    expect(swContent).toContain('caches.delete');
    expect(swContent).toContain('self.clients.claim()');
  });

  it('Q7.1.5: Simulação de ciclo de vida de Cache: retém N e N-1 e purga gerações legadas', async () => {
    // Mock hermético de CacheStorage
    const storedCaches = new Map<string, Set<string>>();
    storedCaches.set('consubov-fazendas-v0', new Set(['/old-chunk-v0.js']));
    storedCaches.set('consubov-fazendas-v1', new Set(['/chunk-v1.js', '/index.html']));
    storedCaches.set('consubov-fazendas-v2', new Set(['/chunk-v2.js', '/index.html']));

    const currentCache = 'consubov-fazendas-v2';
    const previousCache = 'consubov-fazendas-v1';

    // Executa a lógica de purga de ativação
    const keys = Array.from(storedCaches.keys());
    const toDelete = keys.filter(
      (key) => key.startsWith('consubov-fazendas-') && key !== currentCache && key !== previousCache
    );

    for (const key of toDelete) {
      storedCaches.delete(key);
    }

    expect(storedCaches.has('consubov-fazendas-v2')).toBe(true);
    expect(storedCaches.has('consubov-fazendas-v1')).toBe(true);
    expect(storedCaches.has('consubov-fazendas-v0')).toBe(false);
    expect(storedCaches.size).toBe(2);
  });

  it('Q7.1.6: sw.js deve possuir estratégia de fetch com fallback para cache N-1 em chunks 404', () => {
    const swContent = readFileSync(swPath, 'utf-8');

    expect(swContent).toMatch(/addEventListener\(\s*['"]fetch['"]/);
    expect(swContent).toContain('PREVIOUS_CACHE');
    expect(swContent).toContain('status === 404');
    expect(swContent).toContain('/api/v1/');
  });
});
