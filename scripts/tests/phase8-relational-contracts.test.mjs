/**
 * Phase 8 Relational Contracts Test Suite
 * Compares and verifies TypeScript types in apps/web/src/integrations/supabase/types.ts,
 * command envelopes in apps/web/src/platform/offline/commandPolicy.ts,
 * and domain contracts in apps/api against PostgreSQL relational schemas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDdlScript } from '../qa/sql-ddl-validator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const typesTsPath = path.join(repoRoot, 'apps/web/src/integrations/supabase/types.ts');
const commandPolicyPath = path.join(repoRoot, 'apps/web/src/platform/offline/commandPolicy.ts');
const syncQueueDomainPath = path.join(repoRoot, 'apps/api/src/modules/sync/domain/queue.ts');
const upMigrationPath = path.join(
  repoRoot,
  'supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql'
);

/**
 * Helper to extract table column names from types.ts
 */
function extractColumnsFromTypesTs(typesContent, tableName) {
  // Regex pattern matching: tableName: {\n Row: {\n (colName: type\n)+ }
  const tableBlockRegex = new RegExp(
    `\\b${tableName}:\\s*\\{\\s*Row:\\s*\\{([\\s\\S]*?)\\}\\s*Insert:`,
    'm'
  );
  const match = typesContent.match(tableBlockRegex);
  if (!match) return null;

  const rowBlock = match[1];
  const columns = {};
  const lineRegex = /^\s*([a-zA-Z0-9_]+)(\??):\s*([^;\n]+)/gm;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(rowBlock)) !== null) {
    const colName = lineMatch[1];
    const isOptional = lineMatch[2] === '?';
    const typeSignature = lineMatch[3].trim();
    columns[colName] = { isOptional, typeSignature };
  }
  return columns;
}

test('TypeScript definitions in types.ts exist and contain 130+ public tables', () => {
  assert.ok(fs.existsSync(typesTsPath), 'apps/web/src/integrations/supabase/types.ts must exist');
  const content = fs.readFileSync(typesTsPath, 'utf8');

  const match = content.match(/Tables:\s*\{([\s\S]*?)\n\s*Views:/);
  assert.ok(match, 'Tables block must exist in types.ts');

  const tableMatches = [...match[1].matchAll(/^\s{6}([a-zA-Z0-9_]+):\s*\{/gm)];
  assert.ok(tableMatches.length >= 130, `Expected at least 130 tables, found ${tableMatches.length}`);
});

test('public.atomic_command_log columns match LocalCommand interface 1:1', () => {
  const upSql = fs.readFileSync(upMigrationPath, 'utf8');
  const ddlResult = validateDdlScript(upSql);
  const sqlTable = ddlResult.catalog.tables['public.atomic_command_log'];
  assert.ok(sqlTable, 'atomic_command_log table must exist in DDL');

  const commandPolicySource = fs.readFileSync(commandPolicyPath, 'utf8');
  assert.ok(commandPolicySource.includes('export type LocalCommand<T = unknown>'), 'LocalCommand type must be exported');

  // Verify property to column mapping
  const mapping = [
    { tsProp: 'commandId', sqlCol: 'command_id', expectedType: 'uuid' },
    { tsProp: 'idempotencyKey', sqlCol: 'idempotency_key', expectedType: 'text' },
    { tsProp: 'tenantId', sqlCol: 'tenant_id', expectedType: 'uuid' },
    { tsProp: 'userId', sqlCol: 'user_id', expectedType: 'uuid' },
    { tsProp: 'deviceId', sqlCol: 'device_id', expectedType: 'text' },
    { tsProp: 'kind', sqlCol: 'kind', expectedType: 'text' },
    { tsProp: 'createdAt', sqlCol: 'created_at', expectedType: 'timestamp with time zone' },
    { tsProp: 'payload', sqlCol: 'payload', expectedType: 'jsonb' },
    { tsProp: 'status', sqlCol: 'status', expectedType: 'text' },
    { tsProp: 'attemptCount', sqlCol: 'attempt_count', expectedType: 'integer' },
  ];

  for (const { tsProp, sqlCol, expectedType } of mapping) {
    assert.ok(
      commandPolicySource.includes(`${tsProp}:`),
      `LocalCommand must have property "${tsProp}"`
    );
    const col = sqlTable.columns[sqlCol];
    assert.ok(col, `atomic_command_log must have column "${sqlCol}"`);
    assert.equal(col.dataType, expectedType, `Column "${sqlCol}" type mismatch`);
    assert.equal(col.isNotNull, true, `Column "${sqlCol}" should be NOT NULL`);
  }
});

test('Legacy Capataz lancamentos columns in types.ts correspond to domain contract', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');
  const cols = extractColumnsFromTypesTs(typesContent, 'lancamentos');
  assert.ok(cols, 'lancamentos table must be present in types.ts');

  const expectedFields = [
    'id',
    'fazenda_id',
    'retiro_id',
    'pasto_id',
    'ciclo_id',
    'num_animais',
    'num_sacos',
    'cocho_cheio',
    'origem',
    'dias_no_pasto',
    'foto_cocho_url',
    'created_at',
  ];

  for (const field of expectedFields) {
    assert.ok(cols[field], `lancamentos must contain field "${field}"`);
  }
});

test('Legacy Capataz pesagens and observacoes columns match types.ts', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');

  const pesagensCols = extractColumnsFromTypesTs(typesContent, 'pesagens');
  assert.ok(pesagensCols, 'pesagens table must exist');
  assert.ok(pesagensCols['id']);
  assert.ok(pesagensCols['lote_id']);
  assert.ok(pesagensCols['evento_id']);
  assert.ok(pesagensCols['total_pesado']);
  assert.ok(pesagensCols['pesos']);

  const obsCols = extractColumnsFromTypesTs(typesContent, 'observacoes');
  assert.ok(obsCols, 'observacoes table must exist');
  assert.ok(obsCols['id']);
  assert.ok(obsCols['fazenda_id']);
  assert.ok(obsCols['retiro_id']);
  assert.ok(obsCols['pasto_id']);
  assert.ok(obsCols['resolvido']);
});

test('Legacy fotos_salga columns in types.ts match contract', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');
  const fotosCols = extractColumnsFromTypesTs(typesContent, 'fotos_salga');
  assert.ok(fotosCols, 'fotos_salga table must exist in types.ts');

  assert.ok(fotosCols['id']);
  assert.ok(fotosCols['lancamento_id']);
  assert.ok(fotosCols['fazenda_id']);
  assert.ok(fotosCols['pasto_id']);
  assert.ok(fotosCols['caminho']);
  assert.ok(fotosCols['tipo']);
});

test('Mais-Arrobas leituras_balancao_pecuarista columns in types.ts match contract', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');
  const balancaoCols = extractColumnsFromTypesTs(typesContent, 'leituras_balancao_pecuarista');
  assert.ok(balancaoCols, 'leituras_balancao_pecuarista table must exist in types.ts');

  assert.ok(balancaoCols['id']);
  assert.ok(balancaoCols['pesagem_lote_id']);
  assert.ok(balancaoCols['ordem']);
  assert.ok(balancaoCols['peso_individual']);
  assert.ok(balancaoCols['peso_total']);
  assert.ok(balancaoCols['quantidade_animais']);
});

test('Domain sync contracts in apps/api reflect PostgreSQL topological hierarchy', () => {
  const queueSource = fs.readFileSync(syncQueueDomainPath, 'utf8');

  // Verify priority order
  assert.ok(queueSource.includes('visitas_tecnicas: 0'), 'visitas_tecnicas must be Level 0');
  assert.ok(queueSource.includes('visita_pastos: 1'), 'visita_pastos must be Level 1');
  assert.ok(queueSource.includes('visita_currais: 1'), 'visita_currais must be Level 1');
  assert.ok(queueSource.includes('visita_topicos: 1'), 'visita_topicos must be Level 1');
  assert.ok(queueSource.includes('avaliacoes_score: 2'), 'avaliacoes_score must be Level 2');
  assert.ok(queueSource.includes('visita_fotos: 3'), 'visita_fotos must be Level 3');
  assert.ok(queueSource.includes('visita_topico_fotos: 3'), 'visita_topico_fotos must be Level 3');

  // Verify PostgreSQL FK dependency error detection
  assert.ok(queueSource.includes('23503'), 'isDependencyError must check PostgreSQL error code 23503');
  assert.ok(queueSource.includes('foreign key'), 'isDependencyError must check "foreign key"');
});

test('Visitas técnicas schema in types.ts matches topological parent contract', () => {
  const typesContent = fs.readFileSync(typesTsPath, 'utf8');
  const visitasCols = extractColumnsFromTypesTs(typesContent, 'visitas_tecnicas');
  assert.ok(visitasCols, 'visitas_tecnicas table must exist in types.ts');

  assert.ok(visitasCols['id']);
  assert.ok(visitasCols['status']);
  assert.ok(visitasCols['tipo']);
  assert.ok(visitasCols['hora_inicio']);
});
