# CONSUBOV — ROADMAP + PRD + HANDOFF ÚNICO — FASES 5 A 9
Data-base: 2026-10-09
Prioridade: execução local no VS Code / Go Task, evidências auditáveis, zero dependência do GitHub Actions hospedado
Branch: work/fase5-6-7-pwa-local
PR ativo: #43, draft, contra main
Referência da auditoria: docs/qa/auditoria-local-2026-10-09.md
Este documento é uma ORDEM DE EXECUÇÃO para o próximo executor e também seu PRD/handoff.

## 1. Missão e fonte de verdade

Concluir o máximo possível das FASES 5 (qualidade Web), 6 (PWA), 7 (offline/sincronização), 8 (infraestrutura/migração — SOMENTE preparo e testes locais), 9 (preparação do piloto/produção — SOMENTE documentação, simulações e testes locais), de maneira incremental, sem regressões na aplicação já em uso.

Antes de editar, ler: CONSUBOV_HANDOFF_CONTINUIDADE.md e CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md das Fontes do Projeto quando disponíveis, AGENTS.md, CONSUBOV_CHECKLIST_MESTRE.md, docs/README.md, instructions/README.md e PRDs/handoffs ativos. Conferir o Checklist Mestre ao vivo no Notion: https://app.notion.com/p/3ec8e0bd0f4d816d9bb5d807e8e2cdc9. Evitar refazer tarefas já atribuídas; preservar alterações não commitadas e checar agentes paralelos.

A execução local de QA não depende de push nem do GitHub Actions. Não iniciar runners remotos. Docker + act são opcionais para reproduzir apenas um job e não substituem testes reais do app.

## 2. Estado factual auditado em 2026-10-09

- Repositório correto: **mmatteuus/consubov**; confirmar o remoto com git remote -v.
- Branch única de trabalho: work/fase5-6-7-pwa-local. PR #43 draft. Branches quality/fase5-web-ready-20261005 e feature/phase6-app-shell são históricas/congeladas; não trabalhar nelas.
- FASES 0–4 têm fechamento histórico/documental; não foram reexecutadas nesta auditoria.
- FASE 5: qualidade parcial implementada, mas QA LOCAL AINDA NÃO APROVADO; bloqueios: Bun/check/E2E/Axe/Lighthouse/security integral não executados no HEAD, Lighthouse budget exige baseline real aprovado.
- FASE 6: PWA-base presente, manifest id/start_url/scope em "/"; Service Worker corrigido para HTML da geração instalada até consentimento, precache de JS/CSS/fonts de rotas lazy e instalação atômica. **Upgrade no navegador old→new com dados offline reais anonimizados ainda não foi comprovado**.
- FASE 7: inventário readonly de seis bases legadas e chaves localStorage adicionado. Migration engine, Command Queue e Sync Engine definitivos NÃO foram implementados/provados.
- FASE 8: preparar schema/adapters/migrations de ensaio, docs e testes locais é permitido. Conectar Supabase/PostgreSQL remoto ou migrar é proibido sem autorização explícita.
- FASE 9: preparar runbooks, backup/rollback, observabilidade, carga local e roteiro piloto é permitido. Deploy, Vercel, publicação, testes com usuários reais em produção requerem autorização.
- Na auditoria isolada: **25 testes Node passaram de 25**. Também passaram verificações isoladas de sintaxe de Bash/JS e typecheck do inventário. Isso NÃO equivale a Bun/Vitest/Playwright completo, build Vite, Lighthouse/Axe real nem QA geral.
- O Chromium disponível no ambiente de auditoria bloqueou localhost com ERR_BLOCKED_BY_ADMINISTRATOR; não aceitar esta tentativa como validação de browser.
- Go Task e VS Code Task já foram instalados pelo responsável; faltam comprovações de ambiente Bun/Playwright do executor.

## 3. Preparação local do VS Code: executar sem esperar outro serviço

Abrir o repositório no VS Code e reabrir o terminal após alterações de PATH. Usar PowerShell para verificar comandos e Git Bash/WSL para os scripts Bash. O agente pode instalar ferramentas **no próprio computador** quando faltarem; não reinstalar o que já funciona.

    git status --short --branch
    git remote -v
    git rev-parse HEAD
    task --version
    bun --version
    node --version
    bash --version

Se for necessário no Windows, instalar via winget (somente as ausentes):
    winget install -e --id Git.Git
    winget install -e --id OpenJS.NodeJS.LTS
    winget install -e --id Oven-sh.Bun

O repo declara Bun 1.4.0: conferir versão real e lockfile; sem upgrades arbitrários. Extensões VS Code recomendadas: task.vscode-task (já instalada), ms-playwright.playwright, dbaeumer.vscode-eslint. O agente pode instalar extensões ausentes via terminal:
    code --install-extension ms-playwright.playwright
    code --install-extension dbaeumer.vscode-eslint

Executar a partir da raiz:
    task doctor
    task setup
    task qa:regressions
    task qa:offline:inventory
    task qa:check
    task qa:phase5

Os comandos existentes também podem ser disparados pelo painel VS Code Tasks (Terminal → Executar Tarefa). Ver docs/qa/QA-LOCAL-VSCODE-GO-TASK.md. Se Bash não executar em PowerShell, usar Git Bash; se o script Linux exigir ambiente Linux, usar WSL2/Ubuntu + VS Code Remote-WSL, documentando instalações. Não usar Codespaces/GitHub Actions como substitutos.

Opcional para emular workflow local: instalar Docker Desktop + act somente se isso trouxer ganho; rodar task qa:act. Isso não consome minutos remotos, mas não reproduz todos os scanners nem comprova PWA em aparelhos reais.

## 4. Qualidade: como registrar e provar resultados

Cada comando Go Task gera .qa/runs/<execução>/output.log e result.json com SHA, horário, status, exit code e indicação dirty. A FASE 5 também gera .qa/phase5-*/ com relatórios Lighthouse e logs HTTP.

- Não subir .qa, .env, tokens, backups reais, fotos, dados pessoais ou dumps de clientes ao GitHub/Notion.
- Produzir resumo sanitizado em docs/qa/ com comandos, versões, SHA, números de testes, falhas e links locais relativos.
- Não converter falhas em PASS com skips, continue-on-error, retries artificiais, ajuste de thresholds sem medição ou testes superficiais.
- Se a working tree estiver dirty, registrar diff e repetir testes após os commits pertinentes. Se existir trabalho local divergente, parar antes de sobrescrever.
- Atualizar Checklist Mestre do repositório e Notion apenas para itens efetivamente comprovados. Distinguir IMPLEMENTADO, TESTADO LOCAL, QA LOCAL APROVADO, HOMOLOGAÇÃO REAL PENDENTE e PRODUCTION READY.
- Aplicar auditoria qualidade-visionario quando disponível; nenhum gate passa com P0 material aberto.

## 5. FASE 5 — concluir WEB READY LOCAL (prioridade imediata)

### Escopo
Revalidar Bun, unit/contract, integração API/Web/Edge, E2E Playwright, responsividade, autorização/tenant mismatch, coverage ratchet, lint changed, typecheck/build, bundle budget, dist secrets, dependency audit, Axe/WCAG, Lighthouse e API HTTP/OpenAPI. Corrigir causas raiz, preservar dívida histórica registrada sem ampliar regressões.

### Trabalho concreto
1. Rodar task qa:phase5 após task setup. Corrigir primeiro problemas de ambiente, depois falhas de código.
2. Garantir Playwright Chromium desktop/tablet/mobile e WebKit quando aplicável, sem depender de GitHub runner. Reexecutar todos os cenários após fixes de logout/tablet; última evidência antiga de 30/48 não prova estado atual.
3. Axe automatizado nas rotas principais, labels, foco, contraste e estados de erro; resolver violações bloqueantes. Fixar dependência de QA via procedimento de lockfile se necessário.
4. Rodar Lighthouse em home/login; medir LCP/CLS/TBT/score em ambiente reproduzível. O arquivo scripts/web-lighthouse-budget.json está intencionalmente PENDING_LOCAL_BASELINE e NÃO aprova até haver medição, thresholds justificáveis e commit de baseline real com hash de 40 caracteres.
5. Corrigir eventuais problemas de portabilidade scripts/run-phase5-local.sh sob Windows Git Bash/WSL e verificar encerramento de processos, logs e exit codes.
6. Completar cenários de upload/foto e autorização/tenant no escopo, sem supor serviços remotos. Falsos asserts de apenas "heading visível" não equivalem a fluxo funcional.
7. Executar testes de security locais sem secrets reais; tratar high/critical encontrados e registrar decisão de exceção aprovada se impossível corrigir nesta etapa.

### Aceite/QA
- [ ] task qa:phase5 PASS no mesmo SHA das evidências.
- [ ] 100% dos E2E obrigatórios verdes e sem flakiness não tratada.
- [ ] Axe sem violações bloqueantes; Lighthouse baseline medido e aprovado sem métricas nulas.
- [ ] Coverage, lint, build, typecheck, bundle, secrets, API/Edge, dependency/security PASS.
- [ ] docs/qa/phase5-local-report.md detalhado e Checklist/Notion sincronizados.
- [ ] FASE 5 rotulada WEB READY LOCAL apenas após QA revisor aprovar evidências.

## 6. FASE 6 — concluir PWA LOCAL READY

### Requisito P0: substituir PWA legada no mesmo app instalado
A versão atual é PWA em uso nas fazendas, com persistência offline extensa. A nova versão NÃO pode exigir reinstalação ou descartar o trabalho offline. Manter origin, manifest id/start_url/scope, update explícito "Atualizar agora", controle contra operações críticas, atomicidade do SW, geração anterior para fallback e dados IndexedDB/localStorage intocados durante atualização.

### Trabalho concreto
1. Auditar apps/web/public/sw.js e apps/web/vite.config.ts dos commits de 2026-10-09; corrigir se o build integrado revelar falha, quota ou precache excessivo. Não substituir a estratégia por limpeza destrutiva.
2. Implementar harness **Playwright browser real LOCAL** para servir PWA legada e nova na **mesma origem**, instalar SW antigo, semear IndexedDB/filas/blobs de fixtures anonimizadas, interromper rede, aplicar build novo pelo botão, reabrir e comparar IDs, conteúdo binário, comandos pendentes, backup e origem/tenant. Não usar staging/produção real.
3. Incluir teste de app fechado/interrupção durante install, falha de chunk lazy, rollback de shell, atualização repetida e storage quota.
4. Garantir que update não recarregue enquanto lançamento/pesagem/foto/visita ou operações críticas estiverem ativas; clique explicito aplica quando seguro.
5. Validar Web APIs por feature detection/fallbacks: câmera, GPS, microfone, QR/barcode, share/arquivos, push/badges, wake lock, WebRTC e conectividade. Recursos opcionais (Bluetooth, NFC, USB) não podem ser requisito sem suporte.
6. Acrescentar projetos Playwright WebKit Safari-like (não igual a teste físico iPhone), Chromium mobile/desktop; usar Firefox smoke onde útil. Testar permissões negadas e serviço indisponível.
7. Criar/ativar script raiz quality:phase6:local que executa todos os testes de browser/PWA, não apenas SW isolado; então task qa:phase6.

### Aceite/QA
- [ ] Atualização old→new mesma origem e mesma instalação, sem perda nem duplicação comprovadas em Chromium e WebKit locais.
- [ ] Shell/fallback/versionamento precache validados, incluindo interrupções.
- [ ] Capability detection e UX standalone compatíveis.
- [ ] task qa:phase6 PASS e docs/qa/phase6-pwa-local-report.md entregue.
- [ ] **HOMOLOGAÇÃO REAL PENDENTE** para iPhone/Android/campo; isso NÃO impede desenvolver FASE 7/8, mas impede liberar a clientes sem piloto.

## 7. FASE 7 — offline-first / sincronização (desenvolvimento local)

### Estado comprovado
Existe inventário readonly em apps/web/src/lib/legacyOfflineInventory.ts, docs/62-offline-legacy-migration.md e testes locais; **não existe migração de produção implementada/comprovada**. Inventário de bases legadas:

- consubov-capataz v7 (lancamentos/pesagensPendentes/syncQueue/erros/config/lastPdfs e demais stores verificados).
- consubov-session v1 (auth_session, offline_data).
- consubov-consultor-offline v2 (foto_queue, snapshots, text_mutations).
- mais-arrobas-offline v1 (tables).
- mais-arrobas-sync v2 (queue, acknowledged-inserts).
- consubov-fotos-salga v1 (fotos, feitos).
- localStorage: pending_backup, pending_backup_at, ma-offline-mode.

Confirmar os nomes e chaves exatos em docs/62 e no código antes de implementar.

### Trabalho concreto
1. Confirmar schema real/store/keyPath/index de todas as bases e variantes já instaladas. Não inferir que dados de usuários ou tenants diferentes podem ser combinados.
2. Implementar LocalDatabase compatível com o legado, migration engine versionado, idempotente/retomável e sem excluir base antiga antes de prova de cópia, reconciliação e ACK de sync. Planejar atomicidade, marcadores, rollback e recuperação sem inventar retenção.
3. Preservar fila de comandos, IDs/UUID, idempotency keys, anexos Blob/ArrayBuffer WebKit, ordem de operação e redundância pending_backup. Proibir indexedDB.deleteDatabase/localStorage.clear no fluxo de update.
4. Command Queue canônica: command_id, tenant_id, user_id, device_id, command_type, aggregate_type, aggregate_id, payload, base_version, occurred_at_local, created_at_local, idempotency_key, correlation_id, attachment_refs, status, attempt_count, last_error.
5. Criar sync push/pull através de fake adapters locais, cursor/checkpoints, ACK estável, retry com mesma key após timeout, tombstones, isolamento user/tenant, conflito explícito (sem LWW genérico em estoque/pesagem/transferência).
6. Simular falta/retorno de internet, duplicidade, corrupção recuperável, concorrência, quota baixa, logout/troca tenant, crash/restart e upload interrompido; garantir nenhuma perda/duplicação. Testar update local com grandes filas/fotos.
7. Criar quality:phase7:local e executar task qa:phase7; documentação/status de cada item, sem marcação genérica [x].

### Aceite/QA
- [ ] Migração de fixtures representativas idempotente, retomável e segura.
- [ ] Fila e sincronização fake persistem/recuperam trabalho corretamente sem internet.
- [ ] Zero vazamento entre tenants/users, zero duplicação crítica, anexos conservados.
- [ ] task qa:phase7 PASS e docs/qa/phase7-offline-local-report.md entregue.
- [ ] OFFLINE LOCAL READY somente após evidência; homologação rural física permanece pendente até piloto.

## 8. FASE 8 — infraestrutura remota/migração, somente preparação LOCAL

### Escopo permitido agora
- Criar matriz origem→destino baseada exclusivamente em artefatos do repo e dados anonimizados autorizados; registrar pontos PENDENTES sobre remoto.
- Preparar schemas/migrations PostgreSQL de ensaio **em banco LOCAL isolado**, contratos de API e repos com autenticação/tenancy server-side; testar SQL e rollback/reconciliação.
- Implementar fake/test adapters e testes com PostgreSQL local/docker se instalável; validar índices, constraints, FK, transação, idempotência, conflitos e políticas RLS simuladas ou locais.
- Preparar export/import dry-run, verificações de contagem/consistência, SHA/IDs, backup/restore local e documentação de migração/rollback.
- Elaborar plano de staging, segurança, secret management, métricas e custo sem provisionar servidores reais.

### Proibido até autorização explícita
Conectar ao Supabase/PostgreSQL remoto (inclusive leitura administrativa não autorizada), migrations remotas, Vercel, publicar secrets, rotacionar credenciais, deploy e alterações de usuários reais.

### Aceite de preparação local
- [ ] Docs/PRD de schema e migração local revisados.
- [ ] Testes de contratos/SQL/tenancy/idempotência no local verdes.
- [ ] Scripts de ensaio e rollback documentados, nenhum acesso remoto.
- [ ] Riscos e acesso futuro necessários listados sem inventar fatos.

## 9. FASE 9 — pré-produção, somente preparação LOCAL

Preparar, sem fazer deploy:
- roteiro de homologação real Android/iOS: instalação PWA atual → "Atualizar agora" → nova instalada, câmera/QR/GPS, background/resume, internet rural, dados pendentes e não duplicação;
- runbook de release/feature flag/kill switch, backup/restore, rollback da PWA e do schema, janela de migração e reconciliação, observabilidade/alertas, logs sanitizados, incidentes e comunicação ao cliente;
- smoke HTTP/OpenAPI, ensaios locais de carga/retry/concorrência, trilha auditável de tenant e segurança;
- checklist de autorização expressa para conectar staging/produção e executar migrações/deploy/release;
- plano de piloto controlado com critérios de abortar/reverter se qualquer operação offline se perder.

Testes **físicos** pendentes não travam implementar fases seguintes; NÃO marcar PRODUCTION READY ou publicar clientes antes do piloto real, backup/restore, validação de segurança, gate local e autorização.

## 10. Exclusões, limites de arquitetura e segurança

Não expandir Capacitor/WebNative/apps/mobile (pós-produção). Não ampliar SyncVet, Relatto, campanhas ou IA sem novo escopo. Nada de regras pecuárias, fórmulas, roles, duração de sessão, retenção de dados ou políticas de conflito inventadas. Não armazenar segredo no cliente, não afrouxar autenticação/RBAC/RLS e não usar banco de cliente para testes locais. Testes físicos não justificam pular testes automatizáveis P0.

## 11. Governança Git e coexistência de múltiplos executores

- Usar work/fase5-6-7-pwa-local; não trabalhar em main ou branches congeladas. Inspecionar git status, diff e outros executores antes de tocar em Taskfile, package.json/lockfile, sw.js, manifest, local database ou checklist.
- Preferir commits locais pequenos e reversíveis; não reset --hard, force push, rebase destrutivo, excluir branches/PRs nem merge sem autorização.
- O QA é LOCAL e independe de push. Resultados locais devem ser capturados antes da eventual sincronização autorizada do trabalho remoto.
- Qualquer alteração funcional atualiza documentação permanente, PRD/handoff e Checklist Mestre do repositório e Notion no mesmo bloco, somente com fatos comprovados.
- Não marcar fase concluída se só houver teste isolado/fixture ou se o app não foi testado em browser para comportamento de browser.

## 12. Entrega final obrigatória do executor

Entregar relatório Markdown sanitizado, com:

    BRANCH E SHA EXATO
    GIT STATUS E ALTERAÇÕES NÃO COMMITADAS
    SISTEMA OPERACIONAL / BUN / NODE / TASK / PLAYWRIGHT / BROWSERS
    GATES EXECUTADOS E RESULTADOS (COMANDO, EXIT CODE, TEMPO, LOG)
    FASE 5: QA LOCAL APROVADO OU REPROVADO + PENDÊNCIAS
    FASE 6: PWA LOCAL READY OU NÃO VALIDADO + UPGRADE ZERO LOSS
    FASE 7: OFFLINE LOCAL READY OU PARCIAL + MIGRAÇÕES/FILAS
    FASE 8: PREPARO LOCAL ENTREGUE, ACESSO REMOTO NÃO FEITO
    FASE 9: RUNBOOK/PILOTO DOCUMENTADO, DEPLOY NÃO FEITO
    HOMOLOGAÇÃO REAL PENDENTE (COM ROTEIRO E RISCOS)
    ARQUIVOS ALTERADOS E COMMITS LOCAIS
    CHECKLIST REPO + NOTION ATUALIZADOS COM EVIDÊNCIA
    AÇÕES EXTERNAS EXECUTADAS: NENHUMA, SALVO AUTORIZAÇÃO EXPRESSA

Anexar relatórios de .qa/runs sem dados sensíveis e resumo em docs/qa/. Em caso de falha, identificar causa, corrigir e reexecutar; se algo depender exclusivamente de teste físico, registrar para pré-produção e continuar desenvolvendo trabalho independente. Quando terminar, informar se CONSUBOV_HANDOFF_CONTINUIDADE.md das Fontes do Projeto precisa ser substituído para a próxima conversa (SIM para mudança relevante).

## 13. Ordem de início — executar agora

1. Ler fontes/Notion; sincronizar branch sem sobrescrever trabalho local.
2. Preparar VS Code e executar: task doctor → task setup → task qa:regressions → task qa:offline:inventory → task qa:phase5.
3. Resolver bloqueios FASE 5, registrar baseline Lighthouse real e QA local.
4. Implementar harness PWA old→new completo e gates FASE 6; executar em Chromium/WebKit.
5. Implementar migrations/Command Queue/fake Sync e testes FASE 7.
6. Avançar preparação **local** FASES 8/9 em paralelo onde não houver P0 acoplado.
7. Consolidar evidências, relatórios, checklist do repo, Notion e handoff; parar antes de deploy/migração remota/merge.

Fim do handoff.
## 14. Adendo de execução acelerada — 2026-10-09, bloco 2

Este adendo **não cria outra branch nem outro PRD paralelo**: atualiza a execução existente no PR #43. Conferir estado real no Notion e `git status` antes de tocar nos arquivos compartilhados.

**Novos componentes existentes (não duplicar):** `IndexedDbLocalDatabase` scoped numa nova DB, `commandPolicy` com retry/ACK/tenant, guarda de ativação SW e timeout, fixture PWA sintética de upgrade, preflight de build, matriz de testes independente e preflight local de pré-produção. Consultar `docs/63-offline-vnext-foundations.md`, `docs/64-fase8-9-local-readiness.md` e `docs/qa/auditoria-local-2026-10-09.md`.

**Fazer nesta ordem, mas avançar tarefas independentes em paralelo:**
1. Executar no VS Code `task doctor`, `task setup`, `task qa:regressions` (Node), `task qa:pwa:build-preflight`, `task qa:pwa:upgrade-fixture` e `task qa:matrix`; instalar browsers/extensões locais necessários.
2. Resolver os gates automatizáveis da FASE 5 e medir/aprovar orçamento Lighthouse por SHA real. E2E logout/tablet e escaneamento devem ser repetidos, sem alegar resultados históricos.
3. Expandir fixture sintética para upgrade **da versão legada real**, preservando **todas** as seis bases/filas, anexos binários e localStorage; testar mesma origem em Chromium/WebKit com dados fictícios e rollback.
4. FASE 7: integrar o novo adapter com identidade de tenant/user validada e completar transações multiabas, migration engine idempotente, fila durável com ACK confirmado e fake sync; não apagar legado, não inventar conflito LWW.
5. FASE 8: elaborar/testar schema/migration local e dry-runs com fixtures; FASE 9: ensaiar runbook, rollback e pré-produção **local** sem deploy. `task qa:preprod:local-gates` exige os três gates aprovados e não substitui homologação real.
6. Registrar relatórios sanitizados `.qa` por SHA, atualizar checklist Git/Notion + este handoff e informar explicitamente problemas abertos.

**Escopo excluído:** Capacitor/nativo, remote Postgres/Supabase, Vercel, migrations remotas, dados reais, deploy, merge, secrets e reescrita de histórico. **Ações proibidas:** force push/reset, falso PASS, testes pulados, limpeza de dados legados ou operação de produção.

**Critérios de aceite:** [ ] FASE 5 QA local integral; [ ] FASE 6 browser upgrade legacy→nova zero-loss; [ ] FASE 7 fila/migrations/tenant/idempotência/caos local; [ ] FASE 8 dry-run local; [ ] FASE 9 runbook/piloto documentado; [ ] documentação, Notion e relatórios por SHA; [ ] QA revisado; [ ] nenhuma operação externa irreversível. Homologação física antes da publicação segue pendente deliberadamente.

**Testes obrigatórios:** Node regressões, TypeScript/Bun/Vitest, Playwright Chromium/WebKit, Axe/Lighthouse, coverage/bundle/secrets, multiabas/offline/retry/ACK/Blob, fake server e rollback. Sem encerrar fase apenas com testes sintéticos.

**Regras Git:** branch ativa existente, commits pequenos reversíveis, preservar trabalho local e conflitos com outros agentes, sem merge/release/force push sem autorização. **Relatório final:** SHA/dirty; comandos/exits/logs; por fase implementação + QA + risco; evidência offline zero-loss; atividades independentes concluídas; alterações na documentação/checklist/Notion; ações externas (esperado: nenhuma); próxima tarefa livre. **Handoff:** sincronizar `CONSUBOV_HANDOFF_CONTINUIDADE.md` ao final de cada bloco.

## 15. Adendo 2026-10-09 (bloco 3) — tarefas já realizadas, não duplicar

Este é o mesmo PRD/handoff do PR #43, sem criação de novo agente/branch. Antes de editar em paralelo, comparar `git status`, SHA e arquivos atribuídos.

**Executado e versionado:** correção de `forceRefresh` para nunca eliminar caches/SW offline, banner de atualização via ativação segura, regressões Node adicionais, fixture Playwright para preservação de **todas as seis bases legadas por nome com dados sintéticos** (não executada em Chromium/WebKit), coordenador local `localSyncRound.ts` com ACK idempotente, conflitos sem LWW e retry com mesma chave, relatorios READY indevidos corrigidos, tarefas Go Task sincronizadas. **72/72 testes Node isolados PASS**, typecheck estrito do módulo de sync PASS e parse TS da fixture PASS. Isso não equivale aos gates completos.

**Ordem de execução livre e segura (local, VS Code):**
1. `task qa:regressions` em checkout limpo, registrar SHA e relatórios. `task qa:offline:core` agora inclui coordenador local.
2. `task qa:pwa:build-preflight` e `task qa:pwa:upgrade-fixture`; corrigir problemas reais (incluindo WebKit) até passarem. Depois, ampliar o teste para **build legada real** sem acessar produção; não declarar zero-loss somente por fixtures.
3. Implementar **adapter persistente** de `AtomicCommandQueue` com transações IDB readwrite de claim/ACK/release sem race multiaba, testes fake IndexedDB + browser + worker/restart. Integrar `localSyncRound` somente após o adapter ser validado.
4. Criar migration engine idempotente/retomável de todas as bases, espelho local de filas e arquivos com reconciliação e ACK; nada de `deleteDatabase`/limpeza do legado. Checar isolamento tenant/user, rollback e erros de quota. Somente então tentar `task qa:phase7`.
5. Completar `task qa:phase5`, Axe/Lighthouse reais e o budget medido, segurança/bundle e E2E. A matriz `task qa:matrix` deve registrar faltas independentemente, jamais falsificar PASS.
6. FASES 8 e 9 podem ter testes **locais** independentes; sem conexão/infraestrutura externa. Registrar status no Checklist Mestre Git/Notion, atualizar documentação/QA/PRD/handoff no mesmo bloco.

**Aceite inalterado:** zero perda offline comprovada na substituição legada→nova, QA locais íntegros FASES 5–7, documentação e checklist sincronizados, autorização de produção e homologação física antes do release. **Exclusões:** Capacitor, produção, banco remoto, Vercel, migrations/deploy, IAM/secrets, rebase/force push. **Relatório final:** status/sha/dirty, testes e logs sanitizados, falhas, pendências e próximas ações. Para nova conversa sincronizar handoff das Fontes.

## 16. Adendo de handoff — 2026-10-09 (bloco 4)

**Não duplicar:** `IndexedDbAtomicCommandQueue.ts` já implementa o contrato `AtomicCommandQueue` do `localSyncRound.ts` em banco novo. `atomic-command-queue.test.cjs` contém 14 cenários fake-indexeddb; `queue-atomic.spec.ts` contém 5 cenários Playwright (Chromium/WebKit), já incluídos em `qa:pwa:upgrade-fixture` e em `qa:offline:browser`. Go Task e VS Code atualizados.

**Evidências locais aqui:** 14/14 testes PASS em **simulador temporário de IndexedDB**, compilação TypeScript estrita PASS, YAML 18 tarefas válido, parsing de testes/browser PASS. **NÃO houve teste com o pacote verdadeiro fake-indexeddb nem execução de navegador** por ambiente restrito. FASES 5–7 permanecem QA NÃO APROVADO. Nenhuma migração ou integração legada executada.

**Ordem de trabalho do próximo executor (local no VS Code):**
1. Ler Checklist Mestre Notion/repo e conferir SHA + alterações locais. `task setup` instala `fake-indexeddb`, já declarado, e Playwright browsers. Executar `task qa:offline:core`, `task qa:offline:browser` e `task qa:pwa:upgrade-fixture`, corrigindo regressões reais. Testes de navegador físico não são condição para desenvolver fases independentes, mas obrigatórios antes de publicar.
2. Ligar **somente no novo fluxo autorizado** o adapter `IndexedDbAtomicCommandQueue` ao `localSyncRound`, com sessão autenticada e tenant validado; criar testes de dupla aba com WebKit real e API fake, ACK e ordenação. `recoverUnconfirmed` só após confirmação explícita de não haver transmissor ativo; nunca inventar lease de conflito pecuário.
3. Implementar migration engine segura, versionada e retomável das seis bases legadas **com schema real verificado**, preservando filas/Blobs sem apagar origem, dados falsos, dedupe, reconciliação, repetição, rollback e erros de quota.
4. Continuar os gates independentes FASE 5/6 no Go Task e iniciar preparo local dos FASES 8/9 apenas sem remoto. Registrar QA por SHA e manter Notion/checklist/PRD/handoff/documentação sincronizados.

**Aceite:** [ ] real fake-indexeddb PASS; [ ] Playwright Chromium+WebKit PASS; [ ] fila autenticada+sync fake integrada; [ ] migration engine de todas seis DBs verde; [ ] FASE5/6 completos e PWA legada→nova zero-loss; [ ] QA revisor; [ ] autorização expressa para qualquer remoto/release. **Exclusões/ações proibidas:** merge/reset/force push, CI hospedado, apagar dados offline, remote Supabase/PostgreSQL, Vercel, migrations remotas, deploy, secrets. **Relatório final:** branch SHA/dirty, testes reais e falhas, riscos, docs/Notion, ações executadas e próximas etapas. Fonte de detalhes: `docs/66-offline-atomic-queue.md`. Substituir Handoff das Fontes ao final.

## Continuidade UTC 2026-10-12 - acessibilidade e gates independentes

Nao criar outro PRD/branch. Reutilizar o runner `scripts/qa/run-a11y-local.mjs` e `e2e/public-a11y.spec.ts`; Chrome de sistema/Selenium nao sao dependencias. Falhas observadas antes das correcoes; sem desativar regras. O budget Lighthouse permanece pendente e e verificado depois de Edge/HTTP, mantendo FAIL agregado. Evidencias e limites em `docs/qa/phase5-local-report.md`, checklist e handoff atualizados.

Prioridade: validar revisao publicada, otimizar/medir baseline sem reducao artificial de criterios, concluir scanners locais; continuar upgrade legado real, capacidades e migracao/sync autenticado em tarefas independentes. Escopo, aceite, QA, exclusoes e regras Git anteriores permanecem integrais. Sem CI hospedado, dados reais, banco remoto, deploy, merge ou alteracao de historico. Relatorio final por SHA/dirty/exits e atualizacao Notion obrigatorios.


## Retomada verificada - 2026-10-12 13h UTC

Lote de acessibilidade anterior revisado e reexecutado antes da publicacao. Nova correcao: o gate recusa backend remoto, credenciais na URL e caminhos/query antes de instalar ou executar ferramentas. Regressao observada RED (6 falhas/7), depois GREEN 7/7, sem contato com os destinos de teste.

Verificacao do candidato em a9288e03, dirty=true e fonte estavel durante a rodada: Node 142/142; runner Chromium 2/2; acessibilidade publica Playwright 9/9 sem retries; check completo, build/tipagem e Web 136/136 PASS, sem cache Turbo. Exit agregado 0: .qa/retomada-20261012/verification.exit. Registros .qa/runs/20261012T131820Z-regressions-a9288e0394db-6554/result.json, .qa/runs/20261012T131853Z-public-a11y-revalidated-a9288e0394db-8132/result.json e .qa/runs/20261012T131941Z-check-a9288e0394db-9097/result.json.

Revisao estatica feita pelo mesmo executor, sem revisor independente. O oramento Lighthouse permanece PENDING_LOCAL_BASELINE; nao ha aceite integral das fases. Trabalho local independente de PWA/offline continua; nenhum banco remoto, dado real, CI hospedado, merge ou deploy. Atualizar evidencias apos sincronizar o commit.


## Correcao independente de offline e revalidacao - 2026-10-12

**FASE 5:** a suite completa passou 111/111 em desktop/tablet/mobile, sem retries, no commit limpo 10230f043d6f45291248a266d1d4f4b1554bba3a. Duracao 8.8min; .qa/runs/20261012T132551Z-e2e-published-10230f043d6f-12558/result.json, exit 0. As 42 falhas historicas nao representam essa revisao. Check anterior foi reexecutado sem cache Turbo: API 539/539, Web 136/136, build e tipagem PASS. Isso ainda nao aprova o gate Lighthouse, mantido PENDING_LOCAL_BASELINE.

**FASE 7, implementacao entregue:** o inventario readonly agora tolera getters bloqueados de IndexedDB/localStorage, distingue armazenamento indisponivel de backup ausente, conserva o resultado dos outros bancos quando uma abertura falha e informa autoIncrement, keyPath e restricoes reais de cada indice. Nao consulta registros, nao escreve, nao infere tenant e nao migra dados.

Regressao reproduzida inicialmente em bancada isolada com fake-indexeddb 6.2.5 verdadeiro: 5 falhas/6; depois 11/11 PASS. Reexecutado no Codespace: inventario 11/11; suite PWA ampliada 22/22 em Chromium/WebKit (inclui 6 cenarios novos de inventario e os 16 existentes de fila/update); regressao Node 148/148; Web 136/136, tipagem e lint:changed exit 0. O lint registra 14 avisos de analise estatica, nao ocultados; nao equivalem a zero avisos.

Evidencias do candidato, base 10230f04 e dirty=true: .qa/runs/20261012T133442Z-offline-inventory-10230f043d6f-23501/result.json; .qa/runs/20261012T133444Z-pwa-upgrade-fixture-10230f043d6f-23569/result.json; .qa/runs/20261012T133558Z-regressions-10230f043d6f-26381/result.json; .qa/retomada-20261012/offline-verification.log e .exit=0. A fonte so foi alterada depois que a E2E anterior terminou.

**Limites:** no inventario, status=ok significa enumeracao concluida; nao certifica migracao. Antes de migrar, exigir contexto autorizado e avaliar error por banco, versoes, stores faltantes e localStorageStatus. localStorageStatus=unavailable nunca autoriza tratar backups como inexistentes. Fixture sintetica nao homologa o build legado de producao nem conclui as FASES 6/7.

Trabalho local independente segue permitido: integrar identidade validada e migracao retomavel preservando origens; concluir ensaio do build legado e desempenho sem afrouxar gates. Nenhuma base de cliente foi alterada. Sem CI hospedado, merge, deploy, banco remoto ou novo roadmap. Revisao pelo proprio executor, sem alegar revisor independente.

## Continuidade 2026-10-12 - ACK, landing e ensaio independente

Escopo deste lote: concluir componentes de landing ja pendentes, corrigir referencia RefreshCw que impedia compilacao, recuperar reserva apos ACK invalido e entregar comparador/restaurador de fixtures locais (docs/67). Nao criar outra branch ou PRD. Fora do escopo: schema canonico, banco remoto, migracao legada real, release, regras pecuarias e expansao dos modulos da FASE 10.

Aceite do lote: tipagem/build Web/API, unitarios, regressao Node, PWA Chromium/WebKit, E2E e diff revisados; preservar IDs, payloads, tenant e destino existente. Testes fisicos nao bloqueiam este desenvolvimento; gates de dados/seguranca permanecem obrigatorios. Documentacao: docs/63, docs/67, relatorio QA, checklist Git/Notion e handoff. Git: somente branch ativa, commit/push autorizados com [skip ci], sem merge, force push, reset ou desligar assinatura. Relatorio final: SHA/dirty, comandos/exits, limites por fase e estado real da publicacao. Revisor independente nao foi acionado; registrar auto-revisao sem simular os agentes citados.

## Retomada - snapshot de transicoes da fila (execucao UTC 2026-10-13)
Escopo: reproduzir e corrigir a leitura tardia de argumentos mutaveis em ACK/conflito/retry; verificar conexoes IndexedDB tardias somente se houver regressao comprovada. Preservar as 17 alteracoes anteriores. Sem novo agente, branch ou PRD. Fora do escopo: lease/TTL, recuperacao automatica, regras de dominio, migracao legada e remoto.
Aceite: teste RED antes da correcao, GREEN em Node/fake-indexeddb e Chromium/WebKit, tentativa antiga nunca altera tentativa nova; IDs/payload/Blob/ArrayBuffer e tenant preservados apos reabertura. Rodar check completo, regressao e PWA sequencialmente. Documentar docs/66, relatorio QA, checklist repo/Notion e handoff. Git: branch ativa, sem sincronizacao que contorne recusa anterior, reset/force/merge/deploy/alteracao de assinatura proibidos. Relatorio final com SHA/dirty, comandos/exits, limites e publicacao real. Auto-revisao, sem alegar revisor independente.

## Retomada verificada da fila - 2026-10-13 UTC
Base `651534fb6a7e854658f1f6db1737e5ee322df8a3`, branch `work/fase5-6-7-pwa-local`, PR #43 draft; checkout dirty. Este bloco prevalece sobre status historicos, nao sobre criterios de aceite.

- [x] Corrigidas transicoes de ACK/conflito/retry que liam o envelope depois da espera: mutacao posterior nao valida tentativa antiga nem invalida uma tentativa aceita. Payload persistido, IDs, tenant/user, Blob e ArrayBuffer preservados.
- [x] Abertura IndexedDB abandonada: sucesso tardio fecha a conexao; upgrade tardio aborta antes de criar stores. Recuperacao explicita, versao/schema e seis bases legadas nao foram alterados.
- [x] RED: 6 falhas de snapshot em Node, 12 casos de navegador reprovados, 2 falhas de lifecycle. GREEN: 8/8 Node; regressao completa 191/191; PWA 34/34 Chromium/WebKit sem retries; check sem cache API 539/539 e Web 146/146, build/tipagem PASS; lint 0 erros/14 avisos. Fonte estavel por SHA-256.
- [ ] Aceite integral das FASES 5/6/7 e producao. Lighthouse anterior 44/home e 68/login nao foi reexecutado nem aprovado; migracao legada, sync autenticado, ordem causal e piloto fisico continuam pendentes. E2E geral 111/111 pertence a rodada anterior, nao a nova execucao.

As 17 alteracoes do lote anterior foram preservadas. A consolidacao documental enviada anteriormente nao existia no Codespace; este registro e o manifesto novo a substituem, sem alegar existencia do manifesto antigo. Preparacao local das FASES 8/9 e tarefas independentes continuam permitidas. Nao esperar testes fisicos para desenvolver; nao afrouxar integridade/seguranca.

Git: nenhum commit/push/sync realizado nesta retomada; origin conhecido um commit documental a frente (`d988ff32`, FASE 11). Nao contornar a recusa anterior de sincronizacao. Preservar o planejamento FASE 11 e reconciliar os documentos compartilhados antes da publicacao. Sem banco remoto, migrations remotas, deploy ou CI hospedado. Auto-revisao do executor; nenhum revisor independente foi simulado.

Relatorio: `docs/qa/queue-transition-snapshot-2026-10-13.md`. Manifesto sanitizado: `docs/qa/evidence/2026-10-13-queue-continuation-local.json`. Checklist Mestre no Notion atualizado e relido com sucesso em 2026-10-13T00:43:22.964Z; confirmar o estado mais recente em cada retomada. Fontes do Projeto precisam receber o handoff atualizado.
