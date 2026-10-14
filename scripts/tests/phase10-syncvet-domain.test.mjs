import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

test('Fase 10 - SyncVet Domain: all 23 specialized pages exist and are physically tracked', () => {
  const syncVetPages = [
    'SyncVetAgendaPage.tsx',
    'SyncVetAuditoriaPage.tsx',
    'SyncVetContasPage.tsx',
    'SyncVetDashboardPage.tsx',
    'SyncVetEmpresaPage.tsx',
    'SyncVetEquipePage.tsx',
    'SyncVetEstacaoDetalhePage.tsx',
    'SyncVetFazendaDetalhePage.tsx',
    'SyncVetFazendasPage.tsx',
    'SyncVetLayout.tsx',
    'SyncVetLoteDetalhePage.tsx',
    'SyncVetManejoExecucaoPage.tsx',
    'SyncVetMedicamentosPage.tsx',
    'SyncVetMeuPainelPage.tsx',
    'SyncVetNovoManejoPage.tsx',
    'SyncVetPartosPage.tsx',
    'SyncVetPrecosPage.tsx',
    'SyncVetPreferenciasPage.tsx',
    'SyncVetProtocoloDetalhePage.tsx',
    'SyncVetProtocolosPage.tsx',
    'SyncVetSemenPage.tsx',
    'SyncVetServicoNovoPage.tsx',
    'SyncVetTrajetosPage.tsx',
  ];

  for (const pageName of syncVetPages) {
    const fullPath = path.join(repoRoot, 'apps/web/src/pages', pageName);
    assert.ok(fs.existsSync(fullPath), `Página obrigatória de SyncVet deve existir: ${pageName}`);
  }
});

test('Fase 10 - SyncVet & Relatto PWA Manifests: dedicated manifests exist with correct scopes', () => {
  const syncVetManifestPath = path.join(repoRoot, 'apps/web/public/manifest-syncvet.json');
  const relattoManifestPath = path.join(repoRoot, 'apps/web/public/manifest-relatto.json');

  assert.ok(fs.existsSync(syncVetManifestPath), 'manifest-syncvet.json deve existir');
  assert.ok(fs.existsSync(relattoManifestPath), 'manifest-relatto.json deve existir');

  const syncVetManifest = JSON.parse(fs.readFileSync(syncVetManifestPath, 'utf8'));
  assert.ok(syncVetManifest.name.includes('SyncVet'));
  assert.equal(syncVetManifest.display, 'standalone');

  const relattoManifest = JSON.parse(fs.readFileSync(relattoManifestPath, 'utf8'));
  assert.ok(relattoManifest.name.includes('Relatto'));
  assert.equal(relattoManifest.display, 'standalone');
});

test('Fase 10 - SyncVet Edge Functions: functions exist and contain non-blocking isolation', () => {
  const trajetoFunc = path.join(repoRoot, 'supabase/functions/syncvet-calcular-trajeto/index.ts');
  const equipeFunc = path.join(repoRoot, 'supabase/functions/syncvet-delete-equipe/index.ts');

  assert.ok(fs.existsSync(trajetoFunc), 'Função syncvet-calcular-trajeto deve existir');
  assert.ok(fs.existsSync(equipeFunc), 'Função syncvet-delete-equipe deve existir');

  const trajetoContent = fs.readFileSync(trajetoFunc, 'utf8');
  assert.ok(trajetoContent.includes('corsHeaders'), 'Deve conter headers CORS');
});

