## 2026-10-29 — INC-011 gate CI de PWA (PR #79)

- [x] Codigo do gate de build/SW/assets, workflow e testes de politica de versao incluidos na branch de trabalho (evidencia: commits/PR; nao equivale a CI executado).
- [x] Gate `PWA Release Safety Gate` PASS no SHA de codigo `ef82234ee77f0efa7250a9920d5ef25836ed989a` (runs 40925246608 e 40925254853). Vitest **19/19 PASS**; build, SW/version.json, precache 341 assets, manifesto, instalador e HTTP local PASS.
- [x] Playwright Chromium com perfil persistente isolado **3/3 PASS**: consentimento, fallback com asset ausente e seis bases de dados offline/Blob preservados.
- [ ] Apos esta atualizacao documental, confirmar checks no novo HEAD; QA em dispositivo fisico real e homologacao com usuario seguem separados.
- [ ] Reconciliar `main` com hotfix de producao, configurar status obrigatorio em release Vercel se autorizado, e validar smoke no host apos deploy.
- [ ] F12 GLOBAL NO-GO permanece; nenhum deploy/migration/secret/SQL remoto nesta tarefa.

---

# CONSUBOV - Checklist Mestre

## 2026-10-22 — Preparacao v1.155.0 e API sem localhost

- Versao de codigo elevada a `1.155.0` (legado atualmente `1.154.0`); fallback de API `127.0.0.1:3000` removido de codigo e de `.env.example`.
- Cliente de API nega requisicoes sem `VITE_API_BASE_URL` com `API_NOT_CONFIGURED` (503), sem trafego de rede. URLs remotas explicitas mantidas.
- Testes locais isolados Node 22: 3/3 PASS; **matriz completa e E2E nao executados** — nao liberar troca de producao.
- Apenas os dois Apps da Vercel `suporteagrodigital` receberam URL/chave publishable do Supabase **no Preview**, nunca no Production nesta etapa. Nenhum banco, RLS, dado, chaves administrativas ou dominio antigo alterados.
- Relatorio: `docs/qa/qa-versao-api-preview-2026-10-22.md`. 107 tabelas sem RLS exigem isolamento testado antes de habilitar acesso publico. API nova nao esta operacionalmente conectada sem testes de negocio.

---


## Homologação Integral Local Consolidada (Fases 0 a 10) — 2026-10-19 (DEV LOCAL READY)

- [x] **Sincronização e Consolidação Git:** Repositório sincronizado com `origin/work/fase5-6-7-pwa-local`, stashes históricos preservados integralmente e consolidação de branches para apenas `main` e `work/fase5-6-7-pwa-local` em worktree única.
- [x] **Remediações de Convergência Integral (Zero Alteração Visual):**
  1. `apps/web/pwa-fixtures/queue-chaos.spec.ts`: tipagem estrita `ChaosFixtureWindow.__bcReceived` sem uso de `any` (`lint:changed` 0 erros).
  2. `apps/web/src/platform/contracts/aiProvider.ts`: higienização de caracteres de controle ASCII via `charCodeAt` compatível com `no-control-regex` e 6/6 testes da FASE 10.
  3. `Taskfile.yml` e `scripts/run-phase6-local.sh`: build direto `bun run --cwd apps/web build` evitando mesclagem de artefatos antigos do cache Turbo em `apps/web/dist/assets` (337/337 precache assets exatos) e `--test-concurrency=4` em `qa:regressions`.
  4. `scripts/tests/playwright-listener-integrity.test.mjs`: timeout de subprocesso ajustado para `30_000` ms para cold start no Windows.
  5. `apps/web/pwa-fixtures/legacy-inventory.spec.ts` e `apps/web/playwright.pwa.config.ts`: `Connection: close` + `server.closeAllConnections()` e `retries: 1` para resiliência de perfil persistente no Windows NTFS.
- [x] **Matriz Integral 13/13 Gates Aprovada em Árvore Limpa (`workingTreeDirty: false`, `sourceUnchanged: true`):**
  - `qa:regressions`: 477/477 PASS (`exitCode: 0`)
  - `qa:check`: API 543/543, Web 197/197, typecheck e build PASS (`exitCode: 0`)
  - `qa:phase5`: E2E Playwright 171/171, Axe 0 violações, 6/6 Lighthouse reais, SAST/Gitleaks v8.30.1, Edge 122/122, HTTP 5/5 PASS (`exitCode: 0`)
  - `qa:pwa:build-preflight` (337/337), `qa:offline:core` (61/61), `qa:offline:browser` (22/22), `qa:offline:inventory` (11/11), `qa:pwa:upgrade-fixture` (44/44) PASS (`exitCode: 0`)
  - `qa:phase6` (PWA Chromium/WebKit + SW + Capabilities), `qa:phase7` (143/143 Offline-First + Migração 6 bases + Caos), `qa:phase8` (29/29 PostgreSQL DDL/RLS Dry-Run), `qa:phase9` (64/64 Carga 1.000+ cmds + Snapshot Rehearsal), `qa:phase10` (29/29 SyncVet/Relatto/IA/Balança/Export SHA-256) PASS (`exitCode: 0`)
  - `qa:preprod:local-gates`: PASS (`exitCode: 0`)
- [ ] **HOMOLOGAÇÃO REAL PENDENTE:** Validação física em aparelhos Android/iOS em campo (curral/fazenda), PostgreSQL staging/produção isolado e periféricos físicos (balanças/RFID) permanecem condicionados à janela operacional presencial.

## Reparos de regressao e seguranca auditados no Codespace — 2026-10-14

- A branch atual recebeu um commit de cinco ajustes aditivos: IndexedDB factory de teste, buffer Git para diff amplo, teste estrutural RLS, correção de import da fixture Playwright para caminho local e exclusão da policy permissiva `tenant_isolation_atomic_command_log` na migration FASE 8. A política remanescente exige `tenant_id` e `user_id = auth.uid()` em leitura/gravação. **Sem migration remota executada.**
- Evidências do Codespace **antes desse commit, checkout `e84b6d1` `dirty=true`**: `task qa:regressions` **477/477 PASS exit 0** após `git fetch --no-tags origin b6ff985fc9e47a1a994b97a433db7931d9957378`; `.qa/runs/20261014T174408Z-regressions-e84b6d116edf-25490/result.json`. `security-signal-classification.test.mjs` **21/21 PASS**. Playwright listener com patch local **3/3 PASS**. `qa:phase8` e `qa:phase10` **PASS exit 0** (`.qa/runs/20261014T174902Z-phase8-e84b6d116edf-35940/result.json`, `.qa/runs/20261014T174906Z-phase10-e84b6d116edf-36161/result.json`). Testes do banco sao dry-run simulados; FASE 10 usa mocks.
- O hash historico `b6ff985` existe no GitHub mas nao estava no clone Codespace (repo nao shallow), por isso 17 testes nao puderam usar fixtures. Restaurado apenas o objeto via `git fetch`, sem checkout, merge ou branch nova; **preparacao de clones futuros precisa documentar este preflight**, mantendo teste offline apos bootstrap.
- `git commit` local (assinatura obrigatoria) falhou `403 Author is invalid` duas vezes. **Assinatura nao foi desligada**; arquivos publicados pela integração autenticada GitHub. Reconciliar checkout por comparacao de hashes do conteudo publicado antes de qualquer `git restore` e `git merge --ff-only`. Stashes antigos mantidos.
- [x] Gates completos FASES 5–10 e `task qa:matrix` **executados e aprovados com checkout limpo no commit definitivo em 2026-10-19**. Homologacao fisica, RLS real em PostgreSQL/staging separado, backup/rollback e producao permanecem pendentes.

## Correções de compatibilidade Node 22 publicadas em 2026-10-14 — QA completo revalidado em 2026-10-19

- Correção publicada de `scripts/tests/playwright-listener-integrity.test.mjs`: carrega configuração Playwright TypeScript real usando `node --experimental-strip-types` em subprocesso isolado com timeout, sem bypass de `forbidOnly`, `reuseExistingServer` ou porta ocupada.
- Correção publicada de `scripts/run-phase10-local.sh`: as 4 invocações de testes de contratos TypeScript agora usam `node --experimental-strip-types --test`, reexecutada e aprovada na FASE 10 (30/30 verificações PASS).
- Após sincronização segura, executados `task qa:regressions`, `task qa:phase5`, `task qa:phase6` a `task qa:phase10` e `task qa:matrix` em checkout limpo, com Gitleaks v8.30.1 SHA-256 pinado. Supabase de produção permanece intacto.


## Revisao da seguranca de exportacoes FASE 10 — 2026-10-14 (QA A EXECUTAR)

- [x] Na branch de trabalho, corrigido `apps/web/src/platform/contracts/enterpriseExport.ts`: CSV e JSON recusam mistura de tenants ou tenant de destino vazio antes de emitir conteudo; SHA-256 deixa de produzir fallback de hash ficticio quando WebCrypto esta indisponivel.
- [x] Teste negativo adicionado a `scripts/tests/phase10-contracts-integrity.test.mjs` para os dois formatos e ausencia de tenant; **alteracoes nao executadas no Codespace no novo SHA `55f0d144`**.
- [ ] Reexecutar gates FASE10, `qa:check`, `qa:regressions`, FASE5 e matriz integral em SHA limpo. Scanner Linux foi corrigido no commit anterior `70b6648`, mas ainda nao foi medido em CI/Codespace neste estado.

## Auditoria da retomada 2026-10-14 — correcoes de QA Linux publicadas (NAO APROVADAS)

- [x] Confirmado no GitHub que `main` e ancestral da branch `work/fase5-6-7-pwa-local`: 130 commits de desenvolvimento a frente e **PR #43 draft**, sem qualquer check remoto (total=0). Nao criar novo PR/branch.
- [x] Backup remoto `codespace-probable-acorn-v6vvq9rrvjjgcw6w` possui **7 commits exclusivos** divergentes. Preservar e auditar esses commits antes de qualquer exclusao: nao reduzir ramas apagando historico nao integrado.
- [x] Corrigida de modo estrito a selecao de binario Gitleaks em `scripts/qa/run-security-local.mjs` e a fixture `scripts/tests/security-local-integrity.test.mjs`: Windows x64 e Linux x64, hashes SHA-256 imutaveis e exigencia real de versao 8.30.1. No Codespace foi validado `gitleaks_8.30.1_linux_x64.tar.gz` do release oficial: archive `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`, binario `88f91962aa2f93ac6ab281d553b9e125f5197bbbce38f9f2437f7299c32e5509`. **A correção publicada ainda NAO tem QA local reexecutado**.
- [x] Gates locais no checkout anterior **dirty=true**: `qa:check` PASS (Web 197/197), FASE 6 PASS (44/44 browsers Chromium/WebKit), FASE 7 PASS, FASE 8 PASS dry-run, FASE 9 PASS synthetic, FASE 10 PASS mocks. Referir artefatos e hashes registrados no Checklist Mestre no Notion (nao atribuir ao novo commit).
- [ ] `qa:regressions` ultimo resultado **421/477 PASS, 56 FAIL**, antes dos patches publicados; um erro TypeScript no teste `scripts/tests/playwright-listener-integrity.test.mjs` permanece no checkout remoto e precisa de correção e reexecucao `qa:regressions` completa. A ultima tentativa de editar esse arquivo estava apenas no Codespace com seis alteracoes `dirty=true`; preservar esse trabalho sem `reset`/force.
- [ ] Renovar acesso ao Codespace, revisar `git status --short`/`git diff`/`git stash list`/`git worktree list`, sincronizar com cuidado (arquivos locais dirty), executar `qa:regressions`, `qa:phase5`, `qa:matrix` e gates FASES 6–10 no commit definitivo limpo.
- [ ] Corrigir validacao `tenantId` por registro no exportador FASE10, remover fallback pseudo-SHA-256, homologar RLS em PostgreSQL isolado, testes de campo/rollback e suite no SHA final. **SEM autorizacao para passar `main` ou deploy enquanto houver blockers P0/P1.**
 de Execucao

## FASE 5 — CONCLUIDA LOCALMENTE / QA APROVADO — 2026-10-14

- [x] **5.1–5.11 / WEB READY LOCAL:** `task qa:phase5` integral PASS, comando/logger/resultado 0/0/0; `.qa/runs/20261014T055726Z-phase5-6cf987874a7c-349/result.json` e log. Web196/196, API543/543, E2E171/171, Edge122/122, HTTP5/5, SW32/32, produtor de auditorias12/12; lint incremental, tipos, build, coverage progressivo, bundle, seguranca e seis Lighthouse reais PASS.
- [x] **Integridade da evidencia:** SHA inicial/final `6cf987874a7c6bf20c1bb9243cfb4c36a7331600`, dirty preservado, `sourceUnchanged=true`; fingerprint inicial/final `6c67de890b6fbd78f848fc2103a8ef50cba74dce7ac7f044c60841fc36aacb32`. Codigo conferido novamente antes de encerrar a documentacao.
- [x] **Revisao independente e documentacao:** `.qa/task3-phase5-closure-approval-review.md` aprovado; [relatorio permanente com itens 5.1–5.11, metricas e limites](docs/qa/phase5-local-report.md), checklist e handoff atualizados.
- [ ] **Homologacao fisica/producao:** permanecem pendentes. Notion/PR ao vivo indisponiveis, espelhamento administrativo pendente. Sem commit/push/merge/deploy/banco remoto autorizado ou executado neste fechamento.

Este bloco e o estado vigente da FASE 5. Entradas anteriores de falha/pendencia abaixo sao historicas e foram superadas pelo run final identificado acima. Resultados da FASE 6 de outro executor sao preservados e exigem sua propria conferencia de escopo antes da continuidade sequencial.

**Limite da revisao aprovada:** tres arquivos novos `LegacyMigrationEngine` (implementacao e testes, FASE 7) foram acrescentados por outro executor depois do gate e da conferencia da fonte. Permanecem preservados e nao testados por este aceite; ver `.qa/task3-final-documentation-verification.json`. O PASS pertence ao fingerprint registrado, sem aprovacao automatica do checkout posterior.

## FASE 6 — PWA Local Ready (Gate oficial aprovado — 2026-10-14)

- [x] **Expansão de BrowserCapabilities:** Interface e função `detectBrowserCapabilities` expandidas em `apps/web/src/platform/adapters/BrowserLocationProvider.ts` com detecção passiva e resiliente de câmera, microfone, share, badging, wakeLock, webrtc, quota, BarcodeDetector e fallback passivo ZXing (`barcodeFallbackZxing: !barcodeDetector`). Testes unitários com 100% de sucesso (15/15 PASS) em `BrowserLocationProvider.test.ts`.
- [x] **Orquestrador de Gate Local:** `scripts/run-phase6-local.sh` implementado e registrado em `package.json` sob `"quality:phase6:local"`, orquestrando de ponta a ponta:
  1. `check-pwa-build.mjs`: validação estática de escopo, id, start_url e manifest (1/1 PASS).
  2. Suíte de integridade de Service Worker e precache atômico fail-closed (43/43 PASS).
  3. Suíte de inspeção e segurança das 6 bases legadas (11/11 PASS).
  4. Testes de consentimento em runtime e matriz passiva de capabilities (18/18 PASS).
  5. Testes Playwright em navegadores reais Chromium e WebKit na mesma origem com perfil persistente (34/34 PASS).
- [x] **Execução e Registro Oficial:** `task qa:phase6` executado com status **PASS** e `sourceUnchanged: true`, gerando o registro sanitizado em `.qa/runs/20261014T044724Z-phase6-6cf987874a7c-405/result.json` (exitCode: 0, 107 testes executados, 0 skips, 0 retries).
- [x] **Relatório Técnico Sanitizado:** Publicado em `docs/qa/phase6-pwa-local-report.md`.
- [ ] **HOMOLOGAÇÃO REAL PENDENTE:** Validação física em aparelhos móveis reais de campo (iOS Safari e Android Chrome com câmera de hardware, escaneamento de brinco bovino e modo avião contínuo) catalogada para execução no piloto da FASE 9, sem bloquear o avanço das FASES 7 e 8.

## FASE 7 — Offline-First & Sincronização Local (Gate oficial aprovado — 2026-10-14)

- [x] **LegacyMigrationEngine:** Implementada engine de migração retomável, idempotente e não-destrutiva em `apps/web/src/platform/migration/LegacyMigrationEngine.ts`:
  1. Migração não-destrutiva de todas as 6 bases legadas (`consubov-capataz`, `consubov-session`, `consubov-consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `consubov-fotos-salga`) e chaves do `localStorage` (`pending_backup`, `pending_backup_at`, `ma-offline-mode`) com transações estritamente `readonly` nas origens (zero deleção, zero mutação).
  2. Rastreamento granular por checkpoints persistidos em `IndexedDbLocalDatabase` (`migration_state`) com paginação por cursores `IDBKeyRange.lowerBound` permitindo retomada imediata pós-crash sem reprocessamento.
  3. Mapeamento dual determinístico: pendências de campo mapeadas para `LocalCommand` no `IndexedDbAtomicCommandQueue` com `status: "pending"`, `attemptCount: 0` e `idempotencyKey` determinística (`urn:consubov:...`); dados de histórico e referência persistidos no `IndexedDbLocalDatabase`.
  4. Preservação bit-a-bit de binários (`Blob` e `ArrayBuffer`) com tipos MIME e comprimentos em bytes idênticos.
- [x] **LocalQueueDrainer & Coordenação de Caos:** Implementado em `apps/web/src/platform/offline/LocalQueueDrainer.ts`:
  1. Drenagem em lote com circuit-breaker imediato na primeira falha de rede/timeout para economizar bateria e proteger I/O rural.
  2. Eleição de aba líder via Web Locks (`navigator.locks.request("consubov:sync-leader:...")`) garantindo que apenas uma aba drene comandos por vez sem disputa ou duplicidade.
  3. Mensageria cross-tab reativa via `BroadcastChannel("consubov-vnext-sync")` (`COMMAND_ENQUEUED`, `SYNC_STATUS_CHANGED`, `COMMAND_ACKED`, `COMMAND_CONFLICT`).
  4. Fake transport programável (`FakeOfflineCommandTransport`) para simulação de latência, queda de rede, Lost ACK e conflitos 409 sem tocar em rede externa.
- [x] **Suítes de Testes Automatizados (143/143 PASS):**
  1. Suíte de inventário e segurança legada: `apps/web/tests/legacy-offline-inventory.test.cjs` e `legacy-offline-safety.test.cjs` (11/11 PASS).
  2. Suíte de storage vNext, CAS e fila atômica: 6 suítes Node com `fake-indexeddb` (61/61 PASS).
  3. Suíte de migração e caos Node: `apps/web/tests/legacy-migration-engine.test.cjs` e `local-queue-chaos.test.cjs` cobrindo 7 cenários de migração e 5 eixos de caos (12/12 PASS).
  4. Suíte Playwright E2E em navegadores reais: `queue-atomic.spec.ts` e `queue-chaos.spec.ts` em Chromium e WebKit reais cobrindo Web Locks, concorrência de 2 abas, `setOffline(true)`, crash/close de aba em voo e retenção de foto de 2MB (32/32 PASS).
  5. Ensaio de snapshot e reconciliação local: `scripts/tests/local-snapshot-rehearsal.test.mjs` (26/26 PASS).
- [x] **Orquestrador de Gate Local & Execução:** `scripts/run-phase7-local.sh` implementado e registrado no `package.json` sob `"quality:phase7:local"`. Executado com sucesso via `task qa:phase7`, registrando status **PASS**, exit code 0 e `sourceUnchanged: true` em `.qa/runs/20261014T063443Z-phase7-6cf987874a7c-2014/result.json`.
- [x] **Relatório Sanitizado:** Publicado em `docs/qa/phase7-offline-local-report.md`.
- [ ] **HOMOLOGAÇÃO REAL PENDENTE:** Validação física em dispositivos móveis reais sob condições rurais sem sinal de internet (piloto de campo da FASE 9), sem bloquear o início da FASE 8 (PostgreSQL Local Dry-Run).

## FASE 8 — PostgreSQL Local Dry-Run & Contratos (Gate oficial aprovado — 2026-10-14)

- [x] **Matriz de Origem-Destino Relacional:** Criado `docs/70-matriz-origem-destino-postgresql.md` com mapeamento exaustivo de todas as 6 bases legadas (`consubov-capataz`, `session`, `consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `fotos-salga`) e comandos da FASE 7 para o schema relacional PostgreSQL (`lancamentos`, `pesagens`, `observacoes`, `fotos_salga`, `leituras_balancao_pecuarista`, `visitas_tecnicas`, etc.), especificando tipos, PKs, FKs e isolamento por tenant.
- [x] **Schema Canônico e Migrações Idempotentes:**
  1. `supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql` (UP) implementando DDL idempotente da tabela canônica `public.atomic_command_log`, constraints únicas de idempotência (`uq_atomic_commands_tenant_idempotency` e `uq_atomic_commands_tenant_command`), índices de performance e Row Level Security (RLS) ativado com política de isolamento estrito por tenant.
  2. `supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql` (DOWN) implementando rollback limpo e reversível de todos os objetos criados.
- [x] **Suíte Hermética de Validação Dry-Run (29/29 verificações verdes):**
  1. `scripts/qa/sql-ddl-validator.mjs`: validador estático de DDL PostgreSQL (parse sintático, tipos canônicos, PKs, integridade de FKs e sintaxe de RLS).
  2. `scripts/qa/migration-idempotency-runner.mjs`: runner de ciclo criptográfico UP -> DOWN -> UP comparando hashes SHA-256 do catálogo de schema (100% de idempotência, reversibilidade e determinismo).
  3. `scripts/tests/phase8-ddl-schema-integrity.test.mjs`: 12 testes de integridade do schema SQL (12/12 PASS).
  4. `scripts/tests/phase8-relational-contracts.test.mjs`: 8 testes de contratos comparando tipos TypeScript em `apps/web/src/integrations/supabase/types.ts` e regras de dependência em `apps/api/src/modules/sync/domain/queue.ts` com o DDL relacional (8/8 PASS).
  5. `scripts/tests/phase8-relational-rls-dryrun.test.mjs`: 6 testes de simulação relacional in-memory validando rejeição de FK órfã (código PostgreSQL 23503), exclusão em cascata (`CASCADE`), unicidade de idempotência (código PostgreSQL 23505), isolamento estrito multi-tenant e rejeição de injeção trans-tenant via RLS `WITH CHECK` (6/6 PASS).
- [x] **Orquestrador de Gate Local & Execução:** `scripts/run-phase8-local.sh` implementado e registrado em `package.json` sob `"quality:phase8:local"` e em `Taskfile.yml` sob `qa:phase8`. Executado com sucesso via `task qa:phase8`, registrando status **PASS**, exitCode 0 e `sourceUnchanged: true` em `.qa/runs/20261014T094201Z-phase8-6cf987874a7c-539/result.json`. Integrado também ao `scripts/qa/run-matrix.mjs` com aprovação comprovada.
- [x] **Relatório Técnico Sanitizado:** Publicado em `docs/qa/phase8-postgresql-local-report.md`.
- [ ] **HOMOLOGAÇÃO REAL PENDENTE:** A migração server-side para ambiente de produção/staging remoto requer autorização administrativa expressa e janela operacional conforme FASE 9; nenhum comando ou credencial remota foi utilizado na FASE 8.

## FASE 9 — Pré-Produção, Carga, Runbooks & Homologação Local (Gate oficial aprovado — 2026-10-14)

- [x] **Documentação de Governança, Runbooks & Homologação:**
  1. `docs/71-runbook-operacional-consubov.md`: Runbook operacional completo para deploy, migração controlada de banco de dados, verificação de integridade pós-deploy e monitoramento de saúde do sistema.
  2. `docs/72-plano-rollback-contingencia.md`: Procedimentos detalhados de contingência, reversão imediata de release e migração (DOWN scripts), retenção de snapshots e chaveamento seguro de tráfego.
  3. `docs/73-relatorio-carga-reconciliacao-local.md`: Especificação e relatório de simulação de carga multi-tenant (1.000+ comandos atômicos), métricas de throughput, latência e reconciliação estrutural de dados.
  4. `docs/74-roteiro-homologacao-fisica-campo.md`: Roteiro de campo para pilotos reais (dispositivos móveis offline, sincronização em lote e leitura de brincos).
- [x] **Simulador de Carga & Reconciliação Determinística:**
  1. `scripts/qa/load-simulation-local.mjs`: gerador determinístico multi-tenant de 1.000+ comandos atômicos (`pesagem_animal`, `lancamento_cocho`, `foto_cocho`), fila atômica com CAS (`SimulatedAtomicQueue`), drenagem concorrente com pool de workers assíncronos, verificação de integridade referencial relacional, idempotência estrita por tenant e reconciliação estrutural de snapshots via SHA-256 (prova de zero perda).
  2. `scripts/tests/phase9-load-reconciliation.test.mjs`: 12 testes automatizados cobrindo carga, concorrência, idempotência, isolamento multi-tenant, estabilidade de memória sem vazamentos, integridade referencial, detecção de divergências e conformidade estrita LGPD (zero PII) (12/12 PASS).
  3. `scripts/tests/local-snapshot-rehearsal.test.mjs`: 26 testes de ensaio de snapshot e reconciliação verificando integridade de dados e restauração segura (26/26 PASS).
- [x] **Orquestrador de Gate Local & Execução:**
  1. `scripts/run-phase9-local.sh` implementado e registrado no `package.json` sob `"quality:phase9:local"` e no `Taskfile.yml` sob `qa:phase9` (e incluído em `qa:all`).
  2. Executado com sucesso via `task qa:phase9`, registrando status **PASS**, exitCode 0 e `sourceUnchanged: true` em `.qa/runs/20261014T102133Z-phase9-6cf987874a7c-2002/result.json` com 64/64 verificações aprovadas (incluindo testes de carga, concorrência, ensaios de snapshot, testes adversariais e reversibilidade DDL).
- [x] **Relatório Técnico Sanitizado:** Publicado em `docs/qa/phase9-preprod-local-report.md`.
- [ ] **HOMOLOGAÇÃO REAL PENDENTE:** Pilotos físicos em campo (dispositivos móveis reais em ambiente de fazenda/curral sem internet) catalogados segundo `docs/74-roteiro-homologacao-fisica-campo.md`. Nenhuma operação remota contra Supabase ou nuvem foi autorizada ou realizada no ciclo local.


## Handoff Codex local / QA de retomada — 2026-10-13

- [x] Handoff especifico para Codex local criado em `instructions/active/HANDOFF-CODEX-LOCAL-FASES5-9-2026-10-13.md`, ligado ao PRD unico das FASES 5–9, sem nova branch ou PR. Sao 3 branches remotas (main, trabalho e backup), com **PR #43 draft** como unico PR aberto.
- [x] Codespace `special garbanzo` realizou fast-forward para `f15fa4bc3725e8de9c089b01e4edf9ed1dff7a75` com arvore limpa, mantendo quatro stashes. **Isto nao sincroniza automaticamente o computador local.**
- [x] `task qa:regressions`: 191/191 PASS, exit 0, SHA limpo `f15fa4bc`; `.qa/runs/20261013T192749Z-regressions-f15fa4bc3725-22980/result.json`.
- [x] `task qa:pwa:upgrade-fixture`: 34/34 PASS, exit 0, Chromium/WebKit no SHA limpo `f15fa4bc`; `.qa/runs/20261013T192834Z-pwa-upgrade-fixture-f15fa4bc3725-24443/result.json`. Teste sintetico, nao migracao real.
- [x] **Codex no VS Code do responsavel:** clone/origin confirmados; fetch + pull `--ff-only` exit 0, HEAD local/remoto `0fc8ccecb23b7070fb6cadf38727afc3d229865b`, arvore limpa e cinco stashes preservados. Evidencia: `docs/qa/codex-local-retomada-2026-10-13.md`; nao aprova fases.
- [ ] `task qa:phase5` integral **nao executado** na ultima tentativa via navegador (ferramenta bloqueou chamada), FASES 6/7 integrais e matrix ainda pendentes. Nao marcar WEB/PWA/OFFLINE READY nem liberar o PR.
- [ ] Revisar preservacao da branch de backup antes de propor sua exclusao; nada foi apagado.

## Verificacao real de monorepo e PWA no SHA 396bf2ff — 2026-10-13

- [x] `task qa:check` no checkout limpo `396bf2ff8411a47343e517683c168891c1b99f7b`: exit 0, API 539/539, Web 171/171, typecheck/build PASS, artefato `.qa/runs/20261013T190510Z-check-396bf2ff8411-6289/result.json` com `workingTreeDirty=false`.
- [x] `task qa:offline:core` 61/61; `task qa:pwa:smoke` 25/25; `task qa:phase5:contracts` 10/10; `task qa:preprod:rehearsal` 26/26, todos exit 0.
- [x] `task qa:offline:browser`: Chromium 11/11 + WebKit 11/11, total 22/22, exit 0; confirmados dois tabs, blobs, escopo de tenant, ACK e idempotencia em fixtures locais.
- [x] `task qa:pwa:build-preflight` exit 0: **349 assets construidos = 349 precache**.
- [ ] `task qa:regressions` no SHA `396bf2ff8411a47343e517683c168891c1b99f7b`: anterior 191/191 PASS em `e0f66b0c`, nao repetido no SHA atual.
- [ ] `task qa:preprod:local-gates` **NAO APROVADO**: processo saiu 201, output detalhado nao recuperado; gate exige QA_MATRIX_REPORT completo + FASES 5/6/7 PASS no mesmo SHA.
- [ ] QA integral de FASE 5, FASE 6, FASE 7, atualização de PWA entre versões, Lighthouse/a11y e homologacao real. Nao chamar a aplicacao de pronta para producao.
- [x] Relatorio com evidencias e limites em `docs/qa/qa-real-monorepo-2026-10-13.md`; cuatro stashes preservados. Nenhum outro repositorio alterado.


## FASE 6 — desbloqueio real da tipagem do teste GPS — 2026-10-13

- [x] `task doctor` no Codespace real: PASS, exit 0. Bun 1.4.0, Go Task 3.54.0, Bash/Git/Node disponiveis, sem exigir Docker/act.
- [x] `task qa:regressions` 191/191, exit 0, em `e0f66b0c` limpo; arquivo `.qa/runs/20261013T185600Z-regressions-e0f66b0c5ac3-2243/result.json`.
- [x] Falha RED reproduzida no check: `BrowserLocationProvider.test.ts:49`, TS2322. Corrigida exclusivamente a tipagem de getter da fixture, preservando o fluxo de GPS.
- [x] GREEN em checkout dirty de `681c9144`: `bun run typecheck` Web, Vitest GPS 12/12, `task qa:check` (tipagem, build API/Web e Web 171/171), `bunx eslint` do teste, todos com exit 0 e blob testado `477952d3743b5048ad07c5afdbca0d8ab0134513`.
- [ ] Revalidar `task qa:check` e regressions no novo SHA com arvore limpa apos commit, sem contar `dirty=true` como QA de release.
- [ ] Gates FASE 5–7 integrados, navegador Chromium/WebKit, tenancy e homologacao fisica permanecem pendentes. Ver `docs/qa/gps-provider-typecheck-2026-10-13.md`.


## Gates locais: verificacao isolada e impedimento do Codespace — 2026-10-13

- [x] Revalidacao independente do blob publicado da fila legada: `f77442eb94dee91b1e7f897942f024b807cbcf44`, Node 10/10 PASS e TS strict/noEmit isolado exit 0.
- [x] Documentado o impedimento de automacao: extension host remoto intermitente, timeout WebSocket, clipboard bloqueado. GUI de Git sem pull pendente, porem SHA local sem confirmacao de terminal.
- [ ] `task doctor` no Codespace: execucao/exit NAO verificados.
- [ ] `task qa:regressions`, `task qa:check`, Vitest Web, QA navegador offline e regressao API: NAO executados neste lote.
- [ ] Verificar SHA/dirty no unico Codespace, conservar stashes e registrar evidencia QA completa do HEAD; nenhuma fase integral aprovada.
- [ ] Revisar futuramente o backup `codespace-probable-acorn-v6vvq9rrvjjgcw6w` antes de eventual remocao. Nao tocar em main/ambientes remotos.


## Codespace CONSUBOV — alertas Act/Run resolvidos no workspace (2026-10-13)

- [x] Confirmados alertas de `act` ausente e nenhum runtime Docker: foram emitidos pela extensao Act/Run opcional, nao pelo aplicativo.
- [x] `Act/Run - GitHub Actions Visual locally` v2.11.0 desativada via `Desabilitar (Workspace)` exclusivamente no Codespace ativo, com reload.
- [x] Verificacao pos-reload: VS Code `Nenhum Problema` (0 erros e 0 avisos), Centro de Notificacoes vazio; indicador de ambiente obsoleto no terminal nao aparece. Sem testes de aplicacao neste lote.
- [ ] Tests de app / monorepo ainda pendentes no checkout mais recente; preservacao de stashes e fast-forward antes de rodar `task qa:check` e demais gates. Evitar CI hospedado e banco remoto.


## Ajuste na retomada da mesma conta apos aborto — 2026-10-13

- [x] RED reproduzido em teste Node: ao desmontar/reabrir tela rapidamente, a nova instancia podia compartilhar a promise abortada, deixando item seguinte sem sync.
- [x] Agora a trava registra tambem o AbortSignal da tentativa; requisição da mesma conta com sinal antigo abortado aguarda a finalizacao e abre uma nova rodada. O mesmo usuario com sinal vigente ainda compartilha a mesma promise sem duplicar.
- [x] Testes Node isolados **10/10 PASS**, TypeScript strict/noEmit exit 0, fonte candidata validada por hash Git `f77442eb94dee91b1e7f897942f024b807cbcf44`. Vitest no repositorio ainda nao executado por indisponibilidade do Codespace.
- [ ] Testes integrados e multiabas, RBAC server-side e homologacao; nenhuma fase integral aprovada.


## FASE 7 — isolamento por conta na Conferência (2026-10-13)

- [x] Reproduzido cruzamento de registros de usuários diferentes (RED 2/3); código corrigido para apenas o userId ativo, sem flush anônimo; abort de novos envios no cleanup.
- [x] Node 9/9 e TypeScript estrito isolado PASS; testes Vitest adicionais publicados, execução integrada PENDENTE.
- [ ] Executar `task qa:check`, `task qa:regressions`, Vitest Web, Chromium/WebKit e testes de auth/tenant; validar multiaba/ACK no backend antes de declarar FASE 7 pronta.


## FASE 7 - fila legada de Conferencia (2026-10-13)

- [x] Lote isolado de preservacao local: mesmo UUID no primeiro insert/retry, single-flight de sync na mesma guia, remocao apenas de IDs com ACK explicito sem sobrescrever registros novos, JSON danificado nao substituido silenciosamente.
- [x] Regressao RED 3/4 (tres falhas), GREEN Node 5/5 e TypeScript strict isolado exit 0; testes Vitest versionados (NAO EXECUTADOS no repo).
- [ ] QA integrado do checkout (Vitest, Taskfile, E2E Chromium/WebKit), sincronizacao multiabas com sessao/tenant, ACK perdido e idempotencia backend; sem aprovacao integral da FASE 7.
- [ ] Browser-MTS: transporte de clique/terminal intermitente; `act` opcional e Docker ausentes causam alertas na extensao Act/Run, sem falha confirmada no app. Registrar diagnostico em docs/qa/conferencia-legacy-sync-2026-10-13.md.


## Lote GPS da FASE 6 — 2026-10-13

- [x] Codigo implementado e publicado no commit `8a8538c5`: capabilities sem prompt, provider GPS com fallback/timeout e auditoria unica da Conferencia (contrato legado preservado).
- [x] Testes isolados Node 12/12 PASS apos RED (7 falhas esperadas); TypeScript isolado estrito PASS. Nao equivalem a QA completo de app.
- [ ] Vitest integrado, `task qa:check`, regressao completa e Playwright Chromium/WebKit no Codespace, pendentes de execucao/registro.
- [ ] QR fisico e homologacao de dispositivo, em gate posterior; nao bloquear desenvolvimento local independente.
- [ ] Gate integral FASE 6 ainda **NAO aprovado**. Handoff e matrizes: `docs/60-browser-capabilities.md`, `docs/qa/gps-conferencia-local-2026-10-13.md`.


## Codespace apos FF - 2026-10-13

- [x] FF local de b9ecba3d ate f9611b48, sem alterar main. PRD GPS reaplicado (5 linhas de planejamento), stashes mantidos.
- [ ] Codigo GPS/Conferencia, browser QA e homologacao fisica ainda pendentes; este lote e so documental.

## Sincronizacao e handoff - 2026-10-13

- [x] Branches historicas removidas; somente `main` e `work/fase5-6-7-pwa-local` existem no GitHub. Um PR aberto: #43 (draft), sem merge.
- [x] Publicado runbook de pull local e continuidade segura: `docs/68-sincronizacao-local-e-agentes.md`; README e AGENTS alinhados a PWA/IndexedDB.
- [ ] Codespace ainda nao confirmado sincronizado: ultimo snapshot mostrava 1 PRD local modificado e 52 commits atras. Preservar alteracao antes de fast-forward.
- [ ] QA integral das fases, homologacao e merge PR #43 seguem pendentes; documentacao nao altera gates.

## Estado consolidado em 2026-10-13

Branch ativa: `work/fase5-6-7-pwa-local`. PR #43 draft. Este painel consolida a reconciliacao Git; nao altera escopo, criterios de aceite ou resultados das fases.

## Planejamento integral preservado - leitura obrigatoria

- Snapshot completo imediatamente anterior: [checklist preservado](docs/archive/CHECKLIST_antes_reconciliacao_ramos_2026-10-13.md), mesmo blob `564b90abd1fa36150f8b31be586124a8543cc7f5`. Contem o historico, vinculos, resultados e planejamento anteriores a esta consolidacao.
- Criterios originais completos: [arquivo integral de 2026-10-09](docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md). Ler o capitulo da fase antes de implementar.
- PRD unico: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`.
- Handoff: `CONSUBOV_HANDOFF_CONTINUIDADE.md`; Notion ao vivo: `3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9`.

## Git - reconciliacao autorizada

- [x] Historicos `quality/fase5-web-ready-20261005`, `feature/phase6-app-shell` e `main` incorporados como pais do merge `41a1f9f1a3728a3f4cf393c6520587bd45cab3a0`: 50 commits anteriores preservados, sem reescrita.
- [x] Resolucao seguindo PWA/IndexedDB, mantendo o codigo funcional de `b9ecba3d`; experimentos nativos ficam somente no historico. Backend, rotas e layouts ja incorporados nao foram substituidos por versoes antigas.
- [x] Recuperada a documentacao da direcao PWA e incorporada a regra para novos ZIPs, sem remover arquivos ja versionados.
- [x] Exclusao efetiva das branches historicas `quality/fase5-web-ready-20261005` e `feature/phase6-app-shell`; GitHub reconsultado: apenas `main` e a branch ativa permanecem, com 1 PR aberto (#43, draft). Commits historicos preservados na branch ativa.
- [ ] Sincronizacao segura do Codespace quando Browser-MTS voltar; preservar PRD local e demais alteracoes existentes.
- [ ] Aceite e merge do PR #43 na `main`. Esta reconciliacao nao executa esse merge nem libera producao.

## Estado das fases - sem alteracao de aceite

| Fase | Estado | Pendencia principal |
| --- | --- | --- |
| 0-4 | DEV LOCAL READY / QA APROVADO | Validadas em `qa:regressions` (477/477), `qa:check` (API 543/543, Web 197/197) e `qa:phase5` |
| 5 | WEB READY LOCAL / QA APROVADO | Gate integral PASS (171/171 E2E, Axe 0, 6/6 Lighthouse); homologação física separada |
| 6 | DEV LOCAL READY (Gate `task qa:phase6` PASS) | Homologação física no piloto de campo (FASE 9) |
| 7 | DEV LOCAL READY (Gate `task qa:phase7` PASS) | 143/143 PASS (migração 6 bases, fila atômica, Web Locks e caos); homologação física em campo |
| 8 | DEV LOCAL READY (Gate `task qa:phase8` PASS) | 29/29 PASS (DDL/RLS dry-run e idempotência UP->DOWN->UP); staging/remoto exige janela própria |
| 9 | DEV LOCAL READY (Gate `task qa:phase9` PASS) | 64/64 PASS (carga 1.000+ cmds, snapshot rehearsal e runbooks); piloto físico pendente |
| 10 | DEV LOCAL READY (Gate `task qa:phase10` PASS) | 29/29 PASS (SyncVet, Relatto, IA, Balança e Export SHA-256); hardware físico pendente |


## Regras de continuidade

PWA React/Vite e IndexedDB continuam vigentes. Preservar origem/manifest, consentimento de update, seis bases legadas, UUIDs e idempotencia. Nenhum resultado de fixture aprova automaticamente migracao real, isolamento backend ou uma fase inteira.

Executar testes locais relevantes sem depender do GitHub Actions. Nao apresentar contagens antigas como reexecucao atual. Pendencia fisica nao impede desenvolvimento independente; testes automatizaveis de dados, tenant e seguranca nao sao dispensados. Sem banco remoto, deploy, rotacao de secrets ou alteracao de producao nesta tarefa.

Relatorio: [reconciliacao Git e limites](docs/qa/git-branch-reconciliation-2026-10-13.md). O historico detalhado continua nos snapshots preservados; nenhum item foi marcado como concluido apenas porque seus commits foram integrados.

## Correcoes verificadas da FASE 5 nesta retomada

- [x] Portabilidade Windows das fixtures lint/restauracao corrigida, sem skips:30/30 focados e `task qa:regressions`193/193 PASS,exit0,dirty=true; `.qa/runs/20261013T214138Z-regressions-0fc8ccecb23b-981/result.json`. ESLint local instalado9.32.0,sem download no runner. Revisao independente CONSUBOV-T1-REVIEW APPROVED.
- [x] Regressao real da assercao de fila ilegivel reproduzida9/10 e corrigida somente no teste: mensagem exata,rejeicao obrigatoria,zero inserts/escritas e bytes preservados. Web completa171/171 PASS,exit0,dirty=true; `.qa/task1b-full-web-result.json` e log; cinco negativos falharam corretamente. Revisao independente CONSUBOV-T1b-REVIEW APPROVED. Producao/frontend visual intactos.
- [x] Extensoes VSCode necessarias confirmadas instaladas:Task1.0.1,Playwright1.1.19,ESLint3.0.34. Browsers instalados por task setup; nao houve reinstalacao desnecessaria.
- [x] Scanner LOCAL Gitleaks8.30.1 preparado somente em `.qa/tools`,SHA256 oficial verificado e version exit0. Scanner instalado nao equivale a scan executado ou seguranca aprovada.
- [ ] Check integral apos ultimo fix e QA completo FASE5:ultima rodada raiz teve typecheck/build/API539/539 PASS,Web170/171 FAIL; Web isolada corrigida171/171 nao substitui gate raiz. Gate ainda pendente.
- [ ] Integridade de recorder/matriz,listener proprio,SAST/secret scan local,bundle validado,Axe autenticado,Lighthouse integral e aceite FASES6-9 permanecem em execucao sequencial. Nenhuma fase aprovada somente por estes testes.

## FASE 5 - checkpoint Codex local no candidato a581ca9c
- [x] `task qa:regressions` 215/215, zero skips, exit 0, sourceUnchanged=true; `.qa/runs/20261013T220831Z-regressions-0fc8ccecb23b-59/result.json`.
- [x] `task qa:check` sem cache: typecheck/build API/Web, API 539/539 e Web 171/171, exit 0, sourceUnchanged=true; `.qa/runs/20261013T221158Z-check-0fc8ccecb23b-1385/result.json`. Candidato dirty=true, HEAD/finalCommit0fc8cce; nao equivale a revisao publicada limpa.
- [x] Recorder/matriz: comando/logger e fonte/indice/HEAD comprovados em 39/39 testes; revisao independente aprovada. Fingerprint a581ca9cff96e1d9ffb08da0bd38b51e160ac83a74e96d7e91a2f0ad62db4ba8 estavel nos dois gates; esta atualizacao documental ocorre apos os testes.
- [ ] FASE 5 integral, browsers/E2E, listeners proprios, bundle validado, scans locais, Axe autenticado/Lighthouse; Notion/PR ao vivo nao acessiveis. Nenhuma fase/producão aprovada apenas por este checkpoint.

- [x] Retomada local FASE5: integridade de listener do QA comprovada por REDs reais,revisao independente e regressao234/234 PASS,0skip,exit0,fonte estavel dirty em0fc8cce. Evidencia .qa/runs/20261013T223128Z-regressions-0fc8ccecb23b-1738/result.json; docs/qa/codex-local-retomada-2026-10-13.md. Nao constitui aceite integral/Notion/publicacao.

- [ ] FASE5 aceite integral local: rodada real2026-10-13 REPROVADA no lint17errors,apesar de API539/Web171/build/typecheckPASS. Evidencia `.qa/runs/20261013T224026Z-phase5-0fc8ccecb23b-1651/result.json`; `docs/qa/phase5-local-report.md`. Proximo corrigirtipos e reexecutar,sem relaxar gates; Notion ainda pendente.
- [x] Integridade bundleQA:validacao fail-closed,lista completa/top20,somas/omitidos;133/133focados,reviewT2cAPPROVED e raiz367/367PASS. `.qa/runs/20261013T223920Z-regressions-0fc8ccecb23b-804/result.json`,dirtyfonteestavel,naoaceitefase.

## FASE 5 — revisões locais antes do gate integrado

- [x] Correções de upload/acessibilidade no escopo existente verificadas: 27/27 casos novos, smoke 138/138 e 15/15 casos finais de erro, exit 0 e sem skips. Revisão independente aprovada; `.qa/task3-ui-report.md`. O último fortalecimento dos testes ainda será coberto pelo gate integrado. Verificações manuais do Axe permanecem registradas, sem certificado de leitor de tela.
- [x] Correções do scanner e da privacidade do recorder verificadas em fixtures: 84/84, exit 0, sem skips, oito hashes estáveis e revisão independente aprovada; `.qa/task3-security-current-final-verification.json`. O scan real do checkout ainda será executado; a classificação de metadados do histórico não é um scan de conteúdo.
- [x] Produtor Lighthouse isolado: 9/9 fixtures reais de browser PASS e revisão aprovada. Checker dos seis originais: 37/37 PASS e revisão aprovada. `.qa/task3-performance-report.md` e `.qa/task3-lh-budget-report.md`; nenhuma métrica dessas fixtures foi usada para criar orçamento da aplicação.
- [ ] Nova integração do Taskfile/recorder/runner: executar QA global com fonte congelada, scan real, Axe, seis medições reais e todos os demais gates da FASE 5. Orçamento continua pendente; árvore dirty, sem commit/push autorizado. FASES 6–9 ainda não iniciadas nesta retomada; FASE 6 tem apenas preparação de leitura.

## FASE 5 — contenção final do chamador e nova fonte congelada

- [x] Regressões globais da integração anterior: 441/441 PASS, sem skips, exit 0, dirty=true, fonte inicial/final `56321a9fcf817f4bbf86aac22b7e45d587bdb09b8caad4cb9efb753639df0427`; `.qa/runs/20261014T001619Z-regressions-0fc8ccecb23b-1438/result.json`. Integridade browser 9/9 PASS em `.qa/runs/20261014T001621Z-lighthouse-fixtures-0fc8ccecb23b-1450/result.json`, inclusive cache herdado incorreto. Estes resultados precedem o ajuste final abaixo.
- [x] Falha real de saída herdada fora de `.qa` reproduzida e corrigida antes do primeiro mkdir/log: probe original 1/1 GREEN, alvos 13/13 e propagação de falha de segurança 1/1, exit 0, sem skips. Revisão independente aprovada: `.qa/task3-caller-output-report.md` e `.qa/task3-root-integration-independent-review.md`. O guard existente foi exportado e reutilizado; comportamento do browser/proxy preservado.
- [ ] Revalidar a nova revisão global, executar scan real e gate integral com fonte congelada. Baseline real/commit autorizado/Notion/piloto físico continuam pendentes; nenhum PASS antigo certifica este ajuste final.

## Escopo reiterado pelo responsável — todas as fases restantes

- [x] Inventário canônico de fases restantes consultado: além de 5–9, FASE 10 contém SyncVet, Relatto, campanhas, IA, integrações empresariais e equipamentos; Planejamentos posteriores continuam preservados nos documentos próprios; nenhuma implementação desses blocos ocorreu nesta retomada.
- [ ] Executar a sequência e os incrementos locais autorizados, mantendo pendências concretas de produto, permissões, privacidade, scoring, provedores e hardware explícitas. Pedido amplo não define regras ausentes nem autoriza remoto/deploy/secrets; opção nativa/SQLite permanece histórica. Primeiro fechar o bloco local FASE 5 e seguir para a 6.

## FASE 6 — PWA Local Ready (Substituição Legado → Novo sem Perda — Remediação Consolidada)
- [x] Detecção passiva estrita de capacidades em `BrowserLocationProvider.ts`: tipagem de função (`typeof ... === "function"`) para `share`, `badging`, `wakeLock` e `webrtc`, eliminando falsos positivos com `null`, primitivos ou objetos não invocáveis. Vitest 32/32 PASS.
- [x] Teardown resiliente no Windows em `persistentTest.ts`: flags `--disable-logging` e `--log-level=3` no Chromium, fechamento ordenado de abas, `context.close()` tolerante a race conditions de traces e `safeRemoveProfile` com até 5 retries e backoff incremental contra locks NTFS (`chrome_debug.log`).
- [x] Desativação de traces transitórios em `playwright.pwa.config.ts` (`trace: "off"`), mantendo capturas visuais via `screenshot: "only-on-failure"`.
- [x] Exportação hermética de `PLAYWRIGHT_BROWSERS_PATH` em `scripts/run-phase6-local.sh` garantindo execução correta isolada e via runner.
- [x] Gate oficial `task qa:phase6` executado com 100% PASS (124/124 testes) sem skips ou retries; saída oficial registrada em `.qa/runs/20261014T053844Z-phase6-6cf987874a7c-688/result.json` com `status: "PASS"`, `commandExitCode: 0`, `exitCode: 0` e `sourceUnchanged: true`. Relatório: `docs/qa/phase6-pwa-local-report.md`.
- [ ] Homologação em dispositivos físicos de campo (iOS Safari e Android Chrome com câmera de hardware, escaneamento de brinco bovino e ausência de sinal rural) permanece pendente para o piloto da FASE 9; desenvolvimento das FASES 7 e 8 liberado localmente.

## FASE 10 — Pós-produção, Módulos Congelados & Expansões (DEV LOCAL READY)
- [x] Documentação e especificação canônica elaborada em `docs/75-fase10-pos-producao-modulos-expansoes.md` cobrindo os 6 blocos canônicos (SyncVet, Relatto, Campanhas, IA, Integrações Empresariais e Equipamentos/Balanças).
- [x] 10.1 SyncVet: integridade física das 23 rotas e páginas em `apps/web/src/pages/`, manifest dedicado `public/manifest-syncvet.json` e auditoria com GPS passivo (`syncvetAuditoria.ts`). Vitest repositórios 5/5 PASS.
- [x] 10.2 Relatto: manifest dedicado `public/manifest-relatto.json`, relatórios PDF locais vetorizados e hierarquia de visitas técnicas em 4 níveis.
- [x] 10.3 Campanhas: delimitação de privacidade e consentimento explícito (opt-in) por pecuarista sob isolamento estrito de tenant.
- [x] 10.4 IA: desacoplamento de Lovable AI via contrato `AIProviderPort` (`aiProvider.ts`), implementação de `LocalMockAIProvider` in-memory com sanitização LGPD de PII (CPFs/emails) e teto de 8.000 chars. Suíte 3/3 PASS.
- [x] 10.5 Integrações Empresariais: contrato `EnterpriseExportPort` (`enterpriseExport.ts`), geração determinística de CSV (ponto-e-vírgula pt-BR) e JSON canônico com digest SHA-256 e webhooks idempotentes. Suíte 5/5 PASS.
- [x] 10.6 Dispositivos/Equipamentos: contrato `ScaleDevicePort` e `RfidReaderPort` (`scaleDevice.ts`), parser determinístico Tru-Test, Coimma e ASCII com detecção de estabilidade e simulador local `LocalSimulatedScaleDevice`. Suíte 5/5 PASS.
- [x] Gate oficial `task qa:phase10` executado com 100% PASS (29/29 verificações), exitCode: 0, status: PASS e `sourceUnchanged: true` em `.qa/runs/20261014T105216Z-phase10-6cf987874a7c-435/result.json`. Relatório: `docs/qa/phase10-pos-producao-report.md`.
- [ ] Homologação física com balanças e bastões RFID reais em curral catalogada como `HOMOLOGAÇÃO REAL PENDENTE` para pilotos presenciais de campo.






## Checkpoint local — sincronizacao e fechamento FASE5 em andamento

- [x] Pull FF correto e preservacao verificavel de48paths locais: HEAD/origin b4eb7f1f29e688c9e0abcd5d863337a1dda9ef2b,5stashes antigos+1backup mantidos,sem staging/commit/push; `.qa/safe-sync-1791939896250/result.json`.
- [x] Correcoes API de tipo e coletor local:53 testes,tipagem/ESLint focados e5 controles negativos PASS; revisao independente `.qa/task3-api-secret-independent-review.md`.
- [ ] Classificacao exata de4sinais publicos/ficticios:18+3 controles PASS; tres controles de agregacao,autorizacao explicita exigida pela revisao automatica e scan integral ainda pendentes. Nenhum segredo novo pode ser ignorado.
- [ ] FASE5 integral/baseline real/aprovacao atuais; FASE6 possui especificacao local,sem implementacao iniciada antes deste fechamento. nenhuma etapa posterior à FASE 10 é acompanhada por este checklist.

- [x] Check completo local em b4eb7f1f, fonte dirty estavel: API543/Web171, tipagem/build e cache0 PASS; `.qa/runs/20261014T010744Z-check-b4eb7f1f29e6-536/result.json`. Anterior aos ultimos controles/documentacao; nao equivale a FASE5 integral atual.
- [x] Autorizacao explicita do responsavel para SOMENTE4classificacoes exatas e testes finais registrada em `.qa/task3-exact-signal-explicit-approval.md`; preserva rawscanner e falha para desconhecidos. Scan e gate integral atuais permanecem pendentes.

- [x] Reg468/468/0skip em b4eb,fingerprint estável9d2cd: `.qa/runs/20261014T011727Z-regressions-b4eb7f1f29e6-160/result.json`.
- [ ] FASE5 integral atual: rodada132/138 E2E FAIL preservada; correções de ciclo de vida/contraste em validação, próximo gate171casos. Primeiro medir/revisar seis Lighthouse no build atualizado e depois repetir integral; não reutilizar métricas/contagens anteriores como aceite atual.

- [x] Correções E2E/contraste focadas17/17 PASS,0retry/skip/flaky; linkescuro9.07/claro11.25; lint0erros14avisos/typecheckPASS. `.qa/task3-e2e-lifecycle-final-verification.json`; integral171casos ainda pendente.
- [x] Build pós-correção de contraste349assets/precache/cache0 PASS, `.qa/runs/20261014T015135Z-pwa-build-b4eb7f1f29e6-353/result.json`; sem provar upgrade/migração.


- [x] BaselineLighthouse local medida6originais/revisada/orçamento não regressivo inicial aprovado; `.qa/task3-lh-measured-baseline-review.md`, fonte histórica b4ebdirtyFP8ed013; home56mediana/LCP6.3s continua fraca, nãoaprovarCWV/aparelho/produção.
- [x] FF documental49paths preservados/7stashes: HEAD/origin6cf987874a7c6bf20c1bb9243cfb4c36a7331600; `.qa/safe-sync-1791943903529/result.json`; planos12/13bloqueados não iniciados.
- [ ] Gate integral FINAL da FASE5 em6cf com171casos e seis relatórios novos comparados aos limites aprovados; sem aceitar snapshot antigo. Fonte/documentos congelados durante execução.

- [x] Gate integral 6cf executado com fonte estável:171/171 E2E,API543/Web171,Edge122/122,HTTP5,Axe/scans/build PASS; `.qa/runs/20261014T021512Z-phase5-6cf987874a7c-1040/result.json` retém FAIL exclusivamente no Lighthouse login. Execução não equivale a aceite da fase.
- [x] Problemas de concorrência/limpeza do precache reproduzidos em fonte real:RED3/6, pico349 e348 writers pendentes; pool4+drain GREEN7/7. `.qa/task3-perf-sw-pool-{red,green}.json`. Prova VM parcial, sem homologação offline ou performance.
- [ ] FASE5 QA APROVADO/WEB READY: falta nova medição real/instalação íntegra e gate integral após correção; limites72/275 do login preservados.

### Checkpoint mais recente — FASE5 local em verificacao (2026-10-14)

- [x] Instalacao real do SW e reload offline:349 assets +2 shells completos em duas origens, Entrar visivel sem rede; `.qa/task3-perf-sw-pool-runtime-result.json`. Corrige a interpretacao do probe antigo; nao equivale a upgrade legado/FASE6.
- [x] Executor Lighthouse Windows: RED/GREEN nativo e10/10 fixtures PASS, fonte estavel30cc1038; `.qa/runs/20261014T032011Z-lighthouse-fixtures-6cf987874a7c-951/result.json`.
- [ ] FASE5 QA APROVADO/WEB READY LOCAL: ultima coleta integral de metricas interrompida4/6; dois login mostraram98a11y e ao menos um era LoadingScreen. Reproducao isolada confirmou Login real100a11y, mas55performance/5991msLCP/299msTBT. Correcao minima do carregamento do Login em verificacao; falta gate integral atualizado. Limites aprovados preservados.
- [ ] Revalidacao final FASE5: rodada040504 FAIL,151 testes Web PASS/sete workers com timeout e alteracoes concorrentes de GPS (sourceUnchanged=false). Limitacao Vitest a2workers em verificacao; testes e limites preservados. Evidencia detalhada em docs/qa/phase5-local-report.md.

- [x] Vitest Windows validado com pool threads/maxWorkers2:42arquivos/174testes PASS,0erros,fonte estavel; `.qa/runs/20261014T043318Z-web-unit-6cf987874a7c-1254/result.json`. Gate integral FASE5 ainda pendente.

### Evidencia adicional FASE5 — 2026-10-14 05:16 UTC

- [x] Leitura da sessao fria sem criar DB vazio quando ausencia confirmada;5regressoes PASS com fonte estavel em `.qa/runs/20261014T051301Z-auth-session-6cf987874a7c-508/result.json`, revisao independente delimitada.
- [ ] Aceite integral FASE5: HOME budgets e captura do formulario Login ainda aguardam nova medicao apos correcao. Coleta parcial045224 NAO aprovou a fase. Ver `docs/qa/phase5-local-report.md`; nenhuma marca de outra fase substitui este requisito sequencial.

### Candidato final FASE5 — 2026-10-14 05:27 UTC

- [x] Seis navegacoes frias HOME/Login dentro dos budgets intactos e formulario comprovado por capturas completas/LCP: `.qa/runs/20261014T052000Z-phase5-built-audits-6cf987874a7c-70/result.json`; checker exit0 `.qa/task3-cold-counter-budget-console.log`.
- [x] Prova local nativa SW do build atual337assets+2shells e reload offline sem rede: `.qa/task3-current-sw-probe-result.json`, fonte/dist estaveis em duas origens.
- [x] FASE5 WEB READY LOCAL: gate integral `.qa/runs/20261014T055726Z-phase5-6cf987874a7c-349/result.json` PASS com fonte estavel e revisao independente aprovada. Evidencia definitiva e limites no bloco vigente deste checklist e em `docs/qa/phase5-local-report.md`.