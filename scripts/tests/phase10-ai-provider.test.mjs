import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalMockAIProvider } from '../../apps/web/src/platform/contracts/aiProvider.ts';

test('Fase 10 - AI Provider Port: LocalMockAIProvider processes requests in-memory without remote calls', async () => {
  const provider = new LocalMockAIProvider();
  assert.equal(provider.providerName, 'local-deterministic-mock');

  const response = await provider.analisarRetiro({
    retiroNome: 'Retiro São Lucas',
    observacoes: 'Consumo de sal regular; pasto com boa massa verde.',
    indicadores: {
      totalAnimais: 450,
      consumoMedioGastoKg: 0.08,
      pesoMedioKg: 385.4,
      gmdEstimadoKgDia: 0.65,
    },
    tenantId: 'tenant-pantanal-01',
  });

  assert.equal(response.isMock, true);
  assert.equal(response.provider, 'local-deterministic-mock');
  assert.ok(response.resumo.includes('Retiro São Lucas'));
  assert.ok(response.resumo.includes('450 cabeças'));
  assert.ok(response.tokensEstimados > 0);
  assert.ok(Array.isArray(response.recomendacoes) && response.recomendacoes.length >= 2);
  assert.equal(response.pontosAtencao.length, 0, 'Não deve emitir alertas para métricas saudáveis');
});

test('Fase 10 - AI Provider Port: triggers zootechnical alerts on low supplement or low GMD', async () => {
  const provider = new LocalMockAIProvider();

  const response = await provider.analisarRetiro({
    retiroNome: 'Retiro das Pedras',
    observacoes: 'Cochos com sobra de produto e sujeira acumulada.',
    indicadores: {
      totalAnimais: 200,
      consumoMedioGastoKg: 0.02, // Subconsumo crítico (< 0.05)
      gmdEstimadoKgDia: 0.15,    // Baixo GMD (< 0.3)
    },
  });

  assert.ok(response.pontosAtencao.some((p) => p.includes('subconsumo de suplemento')));
  assert.ok(response.pontosAtencao.some((p) => p.includes('GMD abaixo da meta')));
});

test('Fase 10 - AI Provider Port: handles empty observations gracefully', async () => {
  const provider = new LocalMockAIProvider();

  const response = await provider.analisarRetiro({
    retiroNome: 'Retiro Central',
    observacoes: '',
  });

  assert.ok(response.resumo.includes('Sem anotações anômalas'));
  assert.ok(response.timestamp);
});

