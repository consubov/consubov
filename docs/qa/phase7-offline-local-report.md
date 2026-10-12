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


## Correcao independente de offline e revalidacao - 2026-10-12

**FASE 5:** a suite completa passou 111/111 em desktop/tablet/mobile, sem retries, no commit limpo 10230f043d6f45291248a266d1d4f4b1554bba3a. Duracao 8.8min; .qa/runs/20261012T132551Z-e2e-published-10230f043d6f-12558/result.json, exit 0. As 42 falhas historicas nao representam essa revisao. Check anterior foi reexecutado sem cache Turbo: API 539/539, Web 136/136, build e tipagem PASS. Isso ainda nao aprova o gate Lighthouse, mantido PENDING_LOCAL_BASELINE.

**FASE 7, implementacao entregue:** o inventario readonly agora tolera getters bloqueados de IndexedDB/localStorage, distingue armazenamento indisponivel de backup ausente, conserva o resultado dos outros bancos quando uma abertura falha e informa autoIncrement, keyPath e restricoes reais de cada indice. Nao consulta registros, nao escreve, nao infere tenant e nao migra dados.

Regressao reproduzida inicialmente em bancada isolada com fake-indexeddb 6.2.5 verdadeiro: 5 falhas/6; depois 11/11 PASS. Reexecutado no Codespace: inventario 11/11; suite PWA ampliada 22/22 em Chromium/WebKit (inclui 6 cenarios novos de inventario e os 16 existentes de fila/update); regressao Node 148/148; Web 136/136, tipagem e lint:changed exit 0. O lint registra 14 avisos de analise estatica, nao ocultados; nao equivalem a zero avisos.

Evidencias do candidato, base 10230f04 e dirty=true: .qa/runs/20261012T133442Z-offline-inventory-10230f043d6f-23501/result.json; .qa/runs/20261012T133444Z-pwa-upgrade-fixture-10230f043d6f-23569/result.json; .qa/runs/20261012T133558Z-regressions-10230f043d6f-26381/result.json; .qa/retomada-20261012/offline-verification.log e .exit=0. A fonte so foi alterada depois que a E2E anterior terminou.

**Limites:** no inventario, status=ok significa enumeracao concluida; nao certifica migracao. Antes de migrar, exigir contexto autorizado e avaliar error por banco, versoes, stores faltantes e localStorageStatus. localStorageStatus=unavailable nunca autoriza tratar backups como inexistentes. Fixture sintetica nao homologa o build legado de producao nem conclui as FASES 6/7.

Trabalho local independente segue permitido: integrar identidade validada e migracao retomavel preservando origens; concluir ensaio do build legado e desempenho sem afrouxar gates. Nenhuma base de cliente foi alterada. Sem CI hospedado, merge, deploy, banco remoto ou novo roadmap. Revisao pelo proprio executor, sem alegar revisor independente.
