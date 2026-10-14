import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScaleRawString, LocalSimulatedScaleDevice } from '../../apps/web/src/platform/contracts/scaleDevice.ts';

test('Fase 10 - Scale Parser: parses Tru-Test protocol string with stability', () => {
  // Leitura estável típica da Tru-Test: ST,GS,+00482.5,KG
  const reading = parseScaleRawString('ST,GS,+00482.5,KG', 'tru-test');
  assert.ok(reading !== null);
  assert.equal(reading.weightKg, 482.5);
  assert.equal(reading.isStable, true);
  assert.equal(reading.protocol, 'tru-test');
  assert.equal(reading.unit, 'kg');

  // Leitura instável típica: US,GS,+00480.0,KG
  const unstable = parseScaleRawString('US,GS,+00480.0,KG', 'tru-test');
  assert.ok(unstable !== null);
  assert.equal(unstable.weightKg, 480.0);
  assert.equal(unstable.isStable, false);
});

test('Fase 10 - Scale Parser: parses Coimma protocol string', () => {
  // Leitura Coimma padrão: P= 512,5kg
  const reading = parseScaleRawString('P= 512,5kg', 'coimma');
  assert.ok(reading !== null);
  assert.equal(reading.weightKg, 512.5);
  assert.equal(reading.isStable, true);

  // Instabilidade sinalizada por '?'
  const unstable = parseScaleRawString('P= ? 510,0kg', 'coimma');
  assert.ok(unstable !== null);
  assert.equal(unstable.isStable, false);
});

test('Fase 10 - Scale Parser: generic ASCII parser handles raw numbers and noise', () => {
  const reading = parseScaleRawString('PESO: 420.0 KG\r\n', 'generic-ascii');
  assert.ok(reading !== null);
  assert.equal(reading.weightKg, 420.0);
  assert.equal(reading.isStable, true);

  const unstable = parseScaleRawString('~420.5kg', 'generic-ascii');
  assert.ok(unstable !== null);
  assert.equal(unstable.isStable, false);
});

test('Fase 10 - Scale Parser: rejects garbage, negative values or out-of-bounds weights', () => {
  assert.equal(parseScaleRawString(''), null);
  assert.equal(parseScaleRawString('   '), null);
  assert.equal(parseScaleRawString('SEM DADOS SERIAL'), null);
  assert.equal(parseScaleRawString('-15.0'), null, 'Peso negativo deve ser descartado');
  assert.equal(parseScaleRawString('99999.0'), null, 'Peso acima do limite biológico (>3500kg) deve ser descartado');
});

test('Fase 10 - Simulated Scale Device: connects, broadcasts readings and disconnects cleanly', async () => {
  const device = new LocalSimulatedScaleDevice();
  assert.equal(device.isConnected(), false);

  const connected = await device.connect();
  assert.equal(connected, true);
  assert.equal(device.isConnected(), true);

  const received = [];
  const unsubscribe = device.onReading((r) => received.push(r));

  device.emitWeight(450.0, true);
  device.emitWeight(455.5, false);

  assert.equal(received.length, 2);
  assert.equal(received[0].weightKg, 450.0);
  assert.equal(received[0].isStable, true);
  assert.equal(received[1].weightKg, 455.5);
  assert.equal(received[1].isStable, false);

  unsubscribe();
  device.emitWeight(460.0);
  assert.equal(received.length, 2, 'Listener removido não deve receber leituras subsequentes');

  await device.disconnect();
  assert.equal(device.isConnected(), false);
});

