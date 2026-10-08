# CONSUBOV — ROADMAP + PRD + HANDOFF — FASES 5, 6 e início da 7

**Data:** 2026-10-07  
**Execução:** 100% local para desenvolvimento/QA; GitHub Actions não é dependência.  
**Branch atual:** `work/fase5-6-7-pwa-local` (PR #43 draft)  
**Direção:** PWA mobile-first; Capacitor/WebNative congelado.

## Missão
Fechar a FASE 5 com evidência local, concluir a FASE 6 como PWA local-ready e iniciar a FASE 7 preservando integralmente o offline da PWA legada usada em campo.

A nova PWA deve substituir a instalação atual no mesmo origin/scope, via botão **Atualizar agora**, sem reinstalação e sem perda de IndexedDB, filas, fotos, snapshots, sessão offline ou backups.

## Regras inegociáveis
- Não depender de GitHub Actions para testes/QA.
- Não conectar Supabase/PostgreSQL remoto, executar migrations remotas, Vercel/deploy ou rotação de secrets.
- Não expandir `apps/mobile/`/Capacitor.
- Não apagar IndexedDB/localStorage operacional.
- Não mascarar teste falho.
- Validação física iOS/Android fica no gate pré-produção da FASE 9; FASE 6 usa Chromium + WebKit localmente.

## Baseline legado obrigatório

### Identidade PWA
Manter `id: "/"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`.

### Proteções de update da PWA atual
Portar sem regressão: precache atômico; geração atual + anterior; fallback para geração anterior; fallback offline amigável; trava de trabalho em andamento compartilhada com SW; popup/banner global `Atualizar agora`; cache-busting/versionamento; proteção contra loop; update não toca em dados IndexedDB/localStorage.

### Persistência offline legada
Preservar/migrar:
- `consubov-capataz` v7: lancamentos, pastos, retiro, ciclos, produtoAtivo, fazendaCache, config, observacoesOffline, pesagensPendentes, syncQueue, syncErrors, lastPdfs;
- `consubov-session` v1: auth_session, offline_data;
- `consubov-consultor-offline` v2: foto_queue, snapshots, text_mutations;
- `mais-arrobas-offline` v1: tables;
- `mais-arrobas-sync` v2: queue, acknowledged-inserts;
- `consubov-fotos-salga` v1;
- localStorage: `pending_backup`, `pending_backup_at`, `ma-offline-mode`.

Preservar UUIDs, FIFO, idempotência, blobs/fotos e fallback ArrayBuffer WebKit/iOS.

## Preparação local obrigatória

1. Confirmar `bun --version`; o repo declara `bun@1.4.0`.
2. Instalar:
```bash
bun install --frozen-lockfile
bunx playwright install chromium webkit firefox
cd apps/web
bun add -d @axe-core/playwright
cd ../..
```
3. VS Code:
```bash
code --install-extension ms-playwright.playwright
code --install-extension dbaeumer.vscode-eslint
```
4. Criar/atualizar `.vscode/extensions.json` recomendando essas duas extensões.

## BLOCO A — fechar FASE 5
- Reexecutar E2E após fixes tablet/logout; sem skip/flaky.
- Cobrir upload/foto quando testável.
- Integrar `@axe-core/playwright`.
- Validar dialogs, foco, contraste WCAG AA e estados de erro.
- Medir Lighthouse local e versionar thresholds derivados do baseline real.
- Executar coverage ratchet, lint changed, typecheck, build, bundle/secret guard, Edge/API smoke e `bun audit --audit-level=high`.
- Ajustar `scripts/run-phase5-local.sh` e expor `bun run quality:phase5:local`.
- Gerar `docs/qa/phase5-local-report.md`.

**Fechar FASE 5 somente com:** E2E 100% verde, axe sem blocker, Lighthouse baseline/thresholds, coverage ratchet, lint/typecheck/build, bundle/secret, Edge/API smoke e security local verdes.

## BLOCO B — concluir FASE 6

### P0 update legacy → next
Implementar mesma identidade/origin/scope, precache atômico, geração atual+anterior, fallback shell anterior, trava de operação crítica, popup/banner global, botão `Atualizar agora` e zero exclusão de dados operacionais.

### Harness local obrigatório
Criar teste E2E que serve fixture legacy no mesmo origin, registra SW antigo, semeia IndexedDB/localStorage, troca para build next, detecta update, clica `Atualizar agora`, confirma novo build, confirma dados intactos, força falha de asset e confirma fallback, repete com rede cortada e app fechado/reaberto.

Expor:
```bash
bun run quality:phase6:local
```

### PWA/capabilities
Completar manifest/safe areas/SW/offline shell/cache e capability detection/fallback para GPS, câmera, microfone, QR/barcode, arquivos/share, push, badges, clipboard, vibration, Wake Lock, orientação/fullscreen, conectividade, sensores, Media Session, WebRTC e contatos; Bluetooth/NFC/USB apenas opcionais.

### Cross-browser
Playwright: Chromium desktop, Chromium mobile Android-like, WebKit mobile Safari-like e Firefox smoke quando aplicável.

**Fechar FASE 6 somente com:** update legacy→next, rollback/fallback, zero-loss offline, Chromium+WebKit verdes, capabilities/fallbacks testados e `docs/qa/phase6-pwa-local-report.md`.

## BLOCO C — iniciar FASE 7

Criar `docs/62-offline-legacy-migration.md` com DB/store/version/keyPath/index/shape/regra de migração.

Implementar migration engine atrás de `LocalDatabase`: versionado, idempotente, retomável, marker por versão/user/tenant/device, nunca inferir tenant/user, preservar UUID/idempotency keys/blobs, não apagar legado antes de cópia+reconciliação.

Manter `navigator.storage.persist()`, monitorar quota, manter `pending_backup`, exportação emergencial e sessão/reference data offline.

Materializar Command Queue canônica com `command_id, tenant_id, user_id, device_id, command_type, aggregate_type, aggregate_id, payload, base_version, occurred_at_local, created_at_local, idempotency_key, correlation_id, attachment_refs, status, attempt_count, last_error`.

Automatizar caos local: sem rede, queda durante operação/upload, retry duplicado, timeout, restart com fila, upgrade com fila, upgrade interrompido, migration duplicada, troca user/tenant, conflitos simulados e blobs/fotos após restart.

Expor:
```bash
bun run quality:phase7:local
bun run quality:local
```
`quality:local` executa FASE 5 → 6 → 7 e falha no primeiro blocker real.

## QA obrigatório
- FASE 5: auditoria completa e relatório local.
- FASE 6: auditoria PWA + update/rollback/offline/cross-browser.
- FASE 7: entregar início material: migration engine + zero-loss tests + command queue/base local.
- Nada de flaky/skip para aprovar artificialmente.

## Documentação
Atualizar no mesmo trabalho: checklist repo + Notion, docs FASE 5/PWA, `docs/62-offline-legacy-migration.md`, relatórios QA, este arquivo e handoff de continuidade.

## Git
- QA não depende de push/PR/Actions.
- Commits locais pequenos/reversíveis.
- Sem deploy/remoto.
- Final: branch local limpa, commits organizados, `git status` limpo.
- Push/merge só quando solicitado.

## Proibido
Supabase remoto novo, migration remota, Vercel/deploy, lojas, rotação de secrets, delete de DB legado, `localStorage.clear()`, apagar pendência por conveniência, LWW genérico crítico, regra inventada, mascarar teste, declarar device físico homologado por emulação.

## Critérios de aceite
- [ ] FASE 5 QA LOCAL APROVADO.
- [ ] FASE 6 PWA LOCAL READY / QA LOCAL APROVADO.
- [ ] Upgrade antigo→novo no mesmo origin comprovado.
- [ ] Zero perda de offline.
- [ ] Fallback shell anterior comprovado.
- [ ] VS Code + browsers + axe preparados.
- [ ] Scripts quality:phase5/6/7:local e quality:local.
- [ ] FASE 7 iniciada com migration engine/testes.
- [ ] Repo + Notion atualizados.
- [ ] Nenhuma ação remota proibida.

## Relatório final do executor
```text
FASE 5: APROVADO/REPROVADO
- comandos
- testes x/x
- coverage
- axe
- Lighthouse
- security local

FASE 6: APROVADO/REPROVADO
- update legacy -> next
- offline shell
- rollback/fallback
- Chromium/WebKit
- capabilities
- preservação IndexedDB/localStorage

FASE 7: INICIADA
- migrations
- DBs/stores
- chaos tests
- command queue
- pendências

ARQUIVOS ALTERADOS
COMMITS LOCAIS
GIT STATUS
AÇÕES REMOTAS EXECUTADAS: NENHUMA
```

## HANDOFF
Começar pela FASE 5. Fechar os gates locais das FASES 5 e 6 antes da implementação pesada da FASE 7. Fixtures/inventário/testes da migração podem ser preparados em paralelo. O risco P0 é substituir a PWA instalada sem perder trabalho offline de campo.

## Adendo de execução 2026-10-08 — QA no VS Code, Go Task e avanço de fases

**Objetivo:** concluir o desenvolvimento das FASES 5–9 com automação local, sem consumir GitHub Actions hospedado, sem bloquear fases posteriores por testes que exigem aparelhos físicos e sem ocultar falhas críticas. Referência técnica: `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md`.

**Escopo:** configurar/usar Taskfile, Git Bash/WSL quando necessário, Bun, Node, Playwright, Axe/Lighthouse, checks de segurança, act/Docker opcional e relatório JSON/log por commit. Corrigir os testes automatizáveis e compatibilidade da PWA antiga→nova; avançar trabalhos independentes em paralelo sem declarar QA falso. Planejar homologação física em piloto pré-produção.

**Fora do escopo:** teste real no hardware sem dispositivo disponível; banco remoto, migrations reais, deploy, secrets, Vercel, lojas, rotação e limpeza de dados legados.

**Critérios de aceite:** `[ ]` extensões VS Code verificadas; `[ ] task doctor`; `[ ] task setup`; `[ ] task qa:phase5`; `[ ] task qa:phase6` com suite implementada; `[ ] task qa:phase7` com suite implementada; `[ ]` preservação de dados em upgrade legacy→next por navegador real/local; `[ ]` arquivos `result.json`/logs por SHA; `[ ]` relatório independente; `[ ]` backlog homologação física registrado; `[ ]` Notion/checklist/handoff sincronizados. Registrar resultados apenas após execução.

**Testes:** unit/contract, lint/typecheck/build, E2E Chromium/WebKit, Axe, Lighthouse com thresholds, API/Edge, scans, SW update, IndexedDB/filas/blobs/rollback/retry/tenant/auth, e `act` opcional. Nenhum teste inexistente pode retornar PASS.

**Documentação/QA:** registrar outputs em `.qa/`, sumários sanitizados em `docs/qa/`, auditoria `qualidade-visionario` e estado DEV LOCAL READY versus HOMOLOGAÇÃO REAL PENDENTE; atualizar Checklist Mestre Notion/repo e handoff. Não declarar QA APROVADO com P0 automatizável aberto.

**Git:** usar `work/fase5-6-7-pwa-local`, preservar status e trabalho de terceiros, commits pequenos, não fazer merge, force push, reset destrutivo, deploy ou operações externas sem autorização. Puxar atualização do branch antes de escrever em arquivos compartilhados.

**Proibições:** falsificar QA, marcar `[x]` sem evidência, pular teste de integridade offline, remover dados, rodar ambientes remotos, usar secrets reais em act, instalar dependência de produção por conveniência.

**Relatório final:** SHA/dirty, ferramentas e versões, tarefas executadas/exit codes, bugs/causas/fixes, evidências dos gates por fase, pendências físicas com roteiro, docs/checklist/notion atualizados, riscos P0 e ações externas executadas (esperado: nenhuma).

**Regra de sequência:** somente o gate físico pode ficar pendente sem bloquear implementação posterior. Trabalhos independentes avançam; fases não são rotuladas `DEV LOCAL READY` com QA local reprovado. Conexões/deploy permanecem sob autorização própria.
