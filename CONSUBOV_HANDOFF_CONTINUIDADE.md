# CONSUBOV — Continuidade operacional consolidada

**Atualização:** 2026-10-11. **Repositório:** `mmatteuus/consubov`. **Branch:** `work/fase5-6-7-pwa-local`. **PR #43:** draft, sem merge/deploy. **Última revisão de código desta rodada:** `68147e76b35a3846f37adc1a7a0b98b8bf70a6ef`; conferir HEAD ao retomar.

## 1. Leia isto primeiro

Ler também as Instruções-Mestre, `AGENTS.md`, `CONSUBOV_CHECKLIST_MESTRE.md`, Checklist Mestre ao vivo no Notion (`3ec8e0bd-0f4d-816d-9bb5-d807e8e2cdc9`) e o PRD ativo antes de editar.

O PRD continua em `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`. Os critérios anteriores foram preservados integralmente em `docs/archive/CONSUBOV_CHECKLIST_MESTRE_antes_auditoria_2026-10-09.md`. A atualização deste handoff consolida o estado; não reduz o escopo aprovado nem cria outro roadmap.

O responsável autorizou commit/push e execução incremental, priorizando uma versão utilizável para testes. Pendências não críticas devem ser registradas sem bloquear trabalho independente. Isso não autoriza falso PASS, perda offline, vazamento entre usuários/tenants ou liberação de produção sem seus controles.

## 2. Publicações concluídas — não refazer

- `473a8752` / `e0c19265`: auditoria anterior, correções de validadores/PWA/fila e organização da documentação. Evidência histórica de 111 testes Node selecionados e 17 da fila está no relatório consolidado; não é aprovação da revisão atual.
- `fb4f80d0`: preparação de ferramentas no Codespace, sem publicação automática.
- **As 11 alterações antes pendentes já foram enviadas:** `17ed1b45` (fazendas e regressão), `dde8aec3` (testes PWA/consentimento/perfil persistente) e `0aedb592` (checklist/handoff/QA/gitignore).
- `48e01b42f6a22d121623449c103480da6a0cadca`: 25 cenários E2E alinhados às rotas/controles existentes; espera do redirect, configuração dos contextos, fixtures locais e fronteira de rede. Não foram adicionadas rotas fictícias ao produto.
- `68147e76b35a3846f37adc1a7a0b98b8bf70a6ef`: `IndexedDbLocalDatabase.set` captura snapshot antes da abertura assíncrona; schema incompatível é recusado; conexão tardia depois de bloqueio é fechada. Nenhuma base legada modificada ou migrada.

Novos testes: `phase5-e2e-contract.test.cjs`, `phase5-fixture-data.test.cjs` e `indexeddb-local-safety.test.cjs`. `Taskfile.yml` inclui `qa:phase5:contracts` e essas regressões. Reutilizar os componentes existentes, não implementar de novo.

## 3. Evidência atual e limites

Rodada 2026-10-11 em bancada isolada de arquivos selecionados:
- **25/25 testes Node PASS**, sem falhas, skips ou cancelados: 7 do adapter anterior, 8 de segurança do adapter, 4 de contratos E2E e 6 do helper de fixtures.
- Seis falhas do adapter, quatro contratos E2E e uma falha do helper foram observados antes das respectivas correções.
- TypeScript estrito dos arquivos alterados e contratos importados: exit 0; não equivale ao typecheck integral.
- Playwright `--list`: **75 casos descobertos em três projetos; zero caso executado em navegador nesta rodada**.
- Taskfile YAML válido, 20 tarefas; `git diff --check` exit 0.
- Arquivos selecionados conferidos por hashes Git contra o remoto e estáveis durante a execução final.

Node 22.16.0, TypeScript 5.8.3, Playwright 1.58.2, fake-indexeddb verdadeiro 6.2.5. Dependências extraídas seletivamente do ZIP fornecido, sem `.env`, credenciais, dados pessoais ou configuração Git privada. Sete testes antigos do adapter ainda usam uma factory simulada; os novos casos usam o pacote real de fake-indexeddb onde indicado. Não foi realizada instalação congelada do monorepo.

Relatório: `docs/qa/auditoria-consolidada-2026-10-09.md`, seção de 2026-10-11. Manifesto: `docs/qa/evidence/2026-10-11-selected-local.json`. **Esse manifesto não é aceite de fase e não deve ser usado para aprovar o gate de pré-produção.** Auto-revisão separada realizada, sem aprovação de revisor independente.

Evidência browser de 2026-10-10 permanece histórica: 16/16 Chromium/WebKit da fixture PWA, `.qa/runs/20261010T212419Z-pwa-upgrade-fixture-17ed1b45bbd3-6644/result.json`, dirty=true; 10 testes Vitest selecionados e typecheck Web também passaram naquela rodada. A última E2E geral conhecida foi 60 PASS / 42 FAIL; a correção do código de testes ainda precisa substituir essa evidência por execução nova.

## 4. Ambiente e sincronização

A bancada interna não tem Bun/Go Task. Chromium recusou loopback com `ERR_BLOCKED_BY_ADMINISTRATOR`; não contornar políticas. Browser-MTS mostrou o Codespace, mas comandos/clicks retornaram timeout. Desktop Commander estava offline. **Não foi possível confirmar HEAD, pendências e processos atuais no Codespace.** Não afirmar que ele já incorporou os commits novos.

O último checkout limpo confirmado lá era `0aedb592`. Ao retomar, conferir branch, SHA, diff, processos e outros executores. Só sincronizar por fast-forward da branch ativa se não sobrescrever trabalho local. Não usar merge automático da `main`, reset, rebase destrutivo ou force push.

```bash
git status --short --branch
git rev-parse HEAD
git diff --stat
git fetch origin work/fase5-6-7-pwa-local
# Somente depois de revisar e preservar qualquer alteracao local:
git merge --ff-only origin/work/fase5-6-7-pwa-local
```

O assinador do Codespace apresentou `403 Author is invalid` na rodada anterior. Os três commits de então foram publicados pela API autenticada, sem assinatura, sem desligar GPG ou proteções; o fast-forward local conferiu igualdade do índice/árvore. Os commits desta rodada foram publicados pelo conector GitHub. Não alterar políticas de assinatura para esconder erros.

`tmux` 3.3a e sessão `consubov-control` foram preparados anteriormente; verificar existência antes de usar. A configuração local `remote.autoForwardPorts=false` foi registrada sem tornar portas públicas. Tmux não sobrevive à parada/recriação do Codespace. Antes de repetir comando após timeout, conferir log/exit code/processo. Não executar suites concorrentes com mesmas portas, perfis ou resultados.

## 5. Estado por fase e ordem de continuidade

FASES 0–4 têm fechamento histórico, não revalidação integral desta rodada. **FASES 5, 6 e 7 continuam com aceite integral pendente.** A publicação de commits não é liberação de produção.

### A. FASE 5 — prioridade imediata

Após sincronizar com segurança, instalar somente ferramentas/dependências ausentes e executar `task qa:phase5:contracts`, os E2E e `task qa:phase5`. Corrigir causas comprovadas, não adicionar rotas ao produto apenas para satisfazer teste incorreto.

Os novos testes percorrem controles existentes e bloqueiam destinos externos. Eles não certificam escritas transacionais reais: envio de salga, movimentação de estoque/animais, uploads, geração de relatório e geometria de mapa ainda precisam de suas provas aplicáveis. Uma fixture vazia ou título visível não basta para esses fluxos.

Revalidar Web/API/Edge, auth/tenant, lint, coverage, typecheck/build, bundle/secrets, acessibilidade e scanners. Medir Lighthouse antes de aprovar limites; não substituir `PENDING_LOCAL_BASELINE` por conveniência. Registrar pendências não críticas para priorização sem ocultar falhas materiais. Aceite conforme capítulo 5 do checklist integral, evidência da revisão e QA.

### B. FASE 6 — atualização da PWA em uso

Reutilizar o SW, preflight e fixtures existentes; executar `task qa:pwa:build-preflight` e `task qa:pwa:upgrade-fixture`. Completar ensaio do **build legado realmente usado**, mesma origem, dados fictícios representativos e botão de atualização. Comparar seis bases, filas, IDs, Blobs/ArrayBuffer, backups e versões.

Cobrir falha de asset/download, quota, fechamento/reabertura, fallback/rollback, consentimento, duas abas e trabalho em andamento. Validar capabilities, permissões negadas e degradação segura. `quality:phase6:local` precisa ser completo, não retornar PASS apenas por testes isolados. Homologação física segue no piloto pré-produção.

### C. FASE 7 — integração e migração

Reutilizar `IndexedDbLocalDatabase`, `IndexedDbAtomicCommandQueue` e `localSyncRound`; são componentes diferentes. Integrar somente sob sessão e tenant verificados. Não inferir proprietário ausente.

Implementar migração versionada e retomável das seis bases com schema real verificado, origem preservada, checkpoints, reconciliação, IDs/idempotency keys, anexos e backups. Testar repetição/interrupção, ordem causal, concorrência, ACK antigo, fake push/pull, rede instável, quota e conflitos sem LWW genérico. Não ativar migração em dados de clientes porque o adapter passou em Node.

Aceite: `quality:phase7:local` completo, relatório e revisão; nenhuma perda ou duplicação crítica. Testes físicos pendentes não impedem trabalho local independente, mas não dispensam esses testes automatizáveis.

### D. FASES 8/9 e piloto

Somente preparação/ensaios locais: schema, migrations, backup/restore, rollback, observabilidade e roteiro Android/iOS/campo. Ambiente para terceiros testarem deve ser explicitamente controlado, sem dados reais ou conexão acidental à produção. Não foi provisionado/liberado um novo piloto nesta rodada. Não abrir portas públicas, alterar banco remoto ou fazer deploy sem autorização específica e controles aplicáveis.

## 6. Git, proibições e documentação

Branch única `work/fase5-6-7-pwa-local`; PR #43 draft. Branches antigas permanecem congeladas. A `main` da auditoria anterior (`161cf184`) tinha cinco commits exclusivos, incluindo Capacitor/SQLite (`6944de9`); não importar automaticamente. Conferir novamente antes de integração autorizada.

Proibido: Capacitor/nativo, Supabase/PostgreSQL remoto, Vercel, migrations remotas, deploy, secrets, dados reais, limpeza de bases legadas, exclusão de pendências, afrouxamento de tenancy/RBAC e reescrita do Git. Não inventar regras de negócio, retenção, TTL de filas ou decisões de conflito.

No mesmo bloco de implementação, atualizar checklist do repositório e Notion, relatório QA relevante e este handoff. Não criar outro roadmap independente. Relatório final deve distinguir IMPLEMENTADO, TESTADO LOCAL, QA APROVADO e HOMOLOGAÇÃO REAL PENDENTE, com SHA/dirty, comandos/exits, limites e riscos.

**Fontes do Projeto:** substituir o handoff antigo por esta versão após sincronização. **A nova aplicação ainda não está aprovada para substituir a PWA usada em campo.** Nenhum CI hospedado, merge na `main`, deploy, banco remoto ou dado real foi usado nesta rodada.

## Rodada local: PDF e salga
Base f47d9b92. E2E inicial: 96/102 PASS. Corrigido seletor de formulario de salga; Chromium completo valida bytes PDF; corrigida sobreposicao real entre dois botoes de fechar o PDF. Regressao Dialog: RED 1/2, GREEN 2/2. Reexecucao dos seis cenarios: 6/6 PASS.
Build/typecheck frescos: PASS; API 539/539 e Web 134/134, cache Turbo desativado. Dependency audit: 0 high/critical; 24 avisos inferiores continuam registrados. Logs .qa/round-20261011/. Fases integrais permanecem pendentes. Sem CI hospedado ou deploy.
