# Relatório Técnico Local: FASE 7 (Offline & Sincronização)

**Data-base:** 2026-10-09  
**Branch:** `work/fase5-6-7-pwa-local`  
**Status auditado:** `FASE 7 EM ANDAMENTO — inventário e fundamentos, OFFLINE LOCAL READY NÃO VALIDADO`

## 1. Inventário de Bases Legadas (`legacyOfflineInventory.ts`)
O inventário somente leitura das seis bases IndexedDB e chaves do localStorage foi validado e testado por testes isolados (`legacy-offline-inventory.test.cjs`):
- `consubov-capataz` (v7)
- `consubov-session` (v1)
- `consubov-consultor-offline` (v2)
- `mais-arrobas-offline` (v1)
- `mais-arrobas-sync` (v2)
- `consubov-fotos-salga` (v1)
- `localStorage`: chaves como `pending_backup`, `pending_backup_at`, `ma-offline-mode`.

## 2. Padrões Arquiteturais para a FASE 7
- **Migration Engine:** Planejado para migrações versionadas, idempotentes e retomáveis, sem destruição prévia de bases antes da confirmação de cópia e ACK de sincronização.
- **Command Queue Canônica:** Estruturação de campos para enfileiramento offline (`command_id`, `tenant_id`, `user_id`, `device_id`, `command_type`, `aggregate_type`, `aggregate_id`, `payload`, `base_version`, `occurred_at_local`, `created_at_local`, `idempotency_key`, `correlation_id`, `attachment_refs`, `status`, `attempt_count`, `last_error`).
- **Sync Engine:** Simulação e testes de resiliência a quedas de conexão, repetição de chaves de idempotência e isolamento rigoroso por tenant/user.

## 3. Próximos Passos
- Execução de testes de caos local e integração com adapters simulados quando o ambiente de browser estiver totalmente liberado de políticas restritivas de loopback.

## 4. Reconciliação independente — 2026-10-09

`apps/web/src/platform/adapters/IndexedDbLocalDatabase.ts` e `apps/web/src/platform/offline/commandPolicy.ts` são **componentes incrementais isolados** para o novo banco local e o ciclo de comando idempotente; não consomem filas legadas nem autorizam writes pelo backend. O inventário readonly não migra linhas, fotos nem anexos. **Não existe ainda evidência de sync engine integrado, transactional queue multiaba, migration engine idempotente nem de `task qa:phase7` PASS**. Nenhum status DEV READY substitui esses gates.

O cenário Playwright das seis bases legadas foi adicionado, mas não rodado em navegador nesta auditoria. Prerequisitos de teste futuro: Chromium/WebKit, transações/retentativas/ACK e conflitos por tenant, crash/restart, Blob/ArrayBuffer, persistência offline rural e atualização legada→nova. Não apagar as bases legadas até integridade e reconciliação auditadas.
