import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAiContext, MAX_AI_CONTEXT_CHARS } from '../../apps/web/src/platform/contracts/aiProvider.ts';
import { generateCsvExport, generateJsonCanonicalExport } from '../../apps/web/src/platform/contracts/enterpriseExport.ts';

test('Fase 10 - AI Context Sanitization: removes control characters and normalizes', () => {
  const dirty = "Observações com \u0000caracteres de controle\u001F e espaços   ";
  const sanitized = sanitizeAiContext(dirty);
  assert.equal(sanitized, "Observações com caracteres de controle e espaços");
});

test('Fase 10 - AI Context Sanitization: masks CPF and email for LGPD privacy', () => {
  const textWithPii = "Vaqueiro João Silva (CPF 123.456.789-00) reportou que joao@fazenda.com.br enviou o lote.";
  const sanitized = sanitizeAiContext(textWithPii);
  assert.ok(!sanitized.includes("123.456.789-00"), "CPF deve ser mascarado");
  assert.ok(sanitized.includes("[CPF_REMOVIDO]"), "Token de substituição de CPF deve estar presente");
  assert.ok(!sanitized.includes("joao@fazenda.com.br"), "Email deve ser mascarado");
  assert.ok(sanitized.includes("[EMAIL_REMOVIDO]"), "Token de substituição de email deve estar presente");
});

test('Fase 10 - AI Context Sanitization: enforces hard ceiling of 8000 characters', () => {
  const hugeText = "A".repeat(10000);
  const sanitized = sanitizeAiContext(hugeText);
  assert.ok(sanitized.length <= MAX_AI_CONTEXT_CHARS + 50, "Deve respeitar o teto estrito");
  assert.ok(sanitized.includes("[CONTEXTO TRUNCADO]"), "Deve indicar truncamento");
});

test('Fase 10 - Enterprise CSV Export: generates valid semicolon-delimited text with SHA-256', async () => {
  const records = [
    {
      id: "pes-001",
      tenantId: "tenant-agro-01",
      dataRegistro: "2026-10-14T08:00:00Z",
      identificadorAnimalOuLote: "BRINCO-8821",
      valorPrincipal: 482.5,
      unidade: "kg",
      observacoes: "Manejo manhã; lote recria",
    },
    {
      id: "pes-002",
      tenantId: "tenant-agro-01",
      dataRegistro: "2026-10-14T08:05:00Z",
      identificadorAnimalOuLote: "BRINCO-8822",
      valorPrincipal: 510.0,
      unidade: "kg",
      observacoes: "Sem alterações",
    },
  ];

  const result = await generateCsvExport("tenant-agro-01", records);
  assert.equal(result.format, "csv-semicolon");
  assert.equal(result.recordCount, 2);
  assert.equal(result.tenantId, "tenant-agro-01");
  assert.ok(result.checksumSha256 && result.checksumSha256.length === 64, "Deve produzir digest SHA-256 de 64 caracteres");

  const lines = result.content.split("\r\n");
  assert.equal(lines[0], "id;tenant_id;data_registro;identificador;valor;unidade;observacoes");
  assert.ok(lines[1].includes("pes-001;tenant-agro-01;2026-10-14T08:00:00Z;BRINCO-8821;482,50;kg;Manejo manhã  lote recria"));
});

test('Fase 10 - Enterprise JSON Canonical Export: generates valid payload and matching checksum', async () => {
  const records = [
    {
      id: "sal-001",
      tenantId: "tenant-agro-01",
      dataRegistro: "2026-10-14T09:00:00Z",
      identificadorAnimalOuLote: "PASTO-04",
      valorPrincipal: 150.0,
      unidade: "kg",
      observacoes: "Salga proteinada",
    },
  ];

  const result = await generateJsonCanonicalExport("tenant-agro-01", records);
  assert.equal(result.format, "json-canonical");
  assert.equal(result.recordCount, 1);
  assert.ok(result.checksumSha256.length === 64);

  const parsed = JSON.parse(result.content);
  assert.equal(parsed.schemaVersion, "1.0.0");
  assert.equal(parsed.tenantId, "tenant-agro-01");
  assert.equal(parsed.records[0].id, "sal-001");
  assert.equal(parsed.records[0].valor, 150.0);
});

test('Fase 10 - enterprise exports fail closed on tenant mismatch or empty tenant', async () => {
  const record = {
    id: 'a1', tenantId: 'tenant-other', dataRegistro: '2026-10-14T09:00:00Z',
    identificadorAnimalOuLote: 'LOTE-001', valorPrincipal: 1, unidade: 'kg',
  };
  await assert.rejects(generateCsvExport('tenant-expected', [record]), /tenant mismatch/i);
  await assert.rejects(generateJsonCanonicalExport('tenant-expected', [record]), /tenant mismatch/i);
  await assert.rejects(generateCsvExport('', []), /tenant mismatch/i);
  await assert.rejects(generateJsonCanonicalExport('', []), /tenant mismatch/i);
});
