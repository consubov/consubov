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

## 5. Fila transacional em desenvolvimento — 2026-10-09 (bloco 4)

Implementado `apps/web/src/platform/adapters/IndexedDbAtomicCommandQueue.ts`: persistência nova com índice único de idempotência por tenant/user, reserva readwrite atômica, ACK/retry/conflito protegidos contra eventos antigos e recuperação pós-crash explicitamente autorizada, sem timeout de lease arbitrário. Os dados não são deletados automaticamente.

`apps/web/tests/atomic-command-queue.test.cjs`: **14 testes** adicionados com a devDependency já presente `fake-indexeddb`. `apps/web/pwa-fixtures/queue-atomic.spec.ts`: **5 cenários** de browser para duas abas, persistência offline binária, isolation e ACK após reconexão. O harness Node foi executado em **simulador local separado** (14/14 PASS), porém os testes com fake-indexeddb real e Chromium/WebKit seguem **NÃO EXECUTADOS** neste ambiente.

`task qa:offline:core`, `task qa:offline:browser`, `task qa:matrix` e VS Code Task registrados. **A FASE 7 NÃO ESTÁ OFFLINE READY:** faltam auth verificada, integração real, migração de seis DBs e sync/chaos/testes completos. Para detalhes: `docs/66-offline-atomic-queue.md`.
