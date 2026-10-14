# CONSUBOV — Handoff de execução para Codex local (VS Code)

**Data-base:** 2026-10-13  
**Missão:** continuar e concluir, até onde as evidências locais permitirem, as FASES 5–9 do CONSUBOV no **VS Code do computador do responsável**, preservando a aplicação Web já existente.  
**Status atual:** FASE 5 concluída no escopo local como **QA APROVADO / WEB READY LOCAL**, com fonte estável no gate integral de 2026-10-14. A evidência canônica é `.qa/runs/20261014T055726Z-phase5-6cf987874a7c-349/result.json`, HEAD/final HEAD `6cf987874a7c6bf20c1bb9243cfb4c36a7331600`, fingerprint `6c67de890b6fbd78f848fc2103a8ef50cba74dce7ac7f044c60841fc36aacb32`, árvore dirty preservada, 196 Web, 543 API, 171 E2E, 122 Edge, 5 HTTP, 32 SW, 12 browser producers e seis Lighthouse strict PASS. A revisão independente está registrada em `.qa/task3-phase5-closure-approval-review.md`.
**Status operacional:** esta ordem permanece **complementar**, vinculada ao PRD principal `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`; **não criar novo PRD, branch ou PR para começar**.

**Limite do aceite:** após o gate e a conferência da fonte, outro executor acrescentou três arquivos `LegacyMigrationEngine` de implementação/testes da FASE 7. Foram preservados e não integram o aceite da FASE 5; exigem QA próprio. A aprovação pertence ao fingerprint acima, sem aprovação automática do checkout posterior. Evidência: `.qa/task3-final-documentation-verification.json` e `docs/qa/phase5-local-report.md`.
**Repositório autorizado:** `mmatteuus/consubov` — exclusivamente.  
**Branch de trabalho:** `work/fase5-6-7-pwa-local`. **PR único:** `#43` (draft → `main`, sem merge autorizado).  
**Checklist Mestre vivo:** https://www.notion.so/3ec8e0bd0f4d816d9bb5d807e8e2cdc9

> **ORDEM AO CODEX:** execute localmente as etapas abaixo. Antes de alterar qualquer arquivo, confirme repositório, branch, estado Git, PRD, Notion e trabalho paralelo. Não tome um PASS histórico como PASS de um novo SHA. Trabalhe em blocos pequenos, corrija falhas comprovadas, documente e entregue evidências verificáveis. Não avance para operações remotas/irreversíveis.

## 1. Fonte de verdade e leitura obrigatória

Leia nesta ordem, usando sempre os arquivos **atuais após o pull**:

1. `CONSUBOV_HANDOFF_CONTINUIDADE.md` e `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`;
2. Checklist Mestre **no Notion**, e `CONSUBOV_CHECKLIST_MESTRE.md`;
3. `AGENTS.md`, `docs/README.md`, `instructions/README.md`;
4. **PRD principal**: `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md`; os documentos específicos concluídos da FASE 5 foram arquivados em `docs/archive/fase5-2026-10-14/` após o aceite local;
5. `docs/68-sincronizacao-local-e-agentes.md`, `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md`, `Taskfile.yml` e `package.json`;
6. `docs/qa/qa-real-monorepo-2026-10-13.md`, `docs/62-offline-legacy-migration.md` e documentação do módulo que for alterado.

Antes de escolher trabalho, identifique itens **EM ANDAMENTO**, arquivos ocupados por outros agentes e o próximo item livre. Havendo conflito entre texto histórico e teste mais recente, prevalece a evidência do SHA correspondente e a decisão aprovada mais recente. Não mexa em arquivos compartilhados simultaneamente com outro agente.

## 2. Git: sincronizar corretamente o VS Code local com o GitHub

**Não execute `git pull` às cegas.** Abra o **clone do CONSUBOV** no VS Code. No terminal Git Bash ou ambiente Bash compatível, execute primeiro **somente leitura**:

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short --branch
git branch --show-current
git diff
git diff --cached
git stash list
git worktree list
```

**Valide que `origin` aponta para `mmatteuus/consubov`** (HTTPS ou SSH). Se o repositório for outro, **PARE**: nenhuma alteração nele. Se houver mudanças não commitadas, arquivos novos, divergência ou trabalho de terceiros: **PARE, inventarie e preserve**. Não aplique `stash pop`, não use `reset --hard`, `clean -fd`, rebase nem force-push para esconder diferenças.

Quando o clone e a árvore de trabalho estiverem **limpos**:

```bash
git fetch origin
# Se a branch de trabalho já existe localmente:
git switch work/fase5-6-7-pwa-local
# Se não existe, use em vez da linha anterior:
# git switch --track origin/work/fase5-6-7-pwa-local

git pull --ff-only origin work/fase5-6-7-pwa-local
git rev-parse HEAD
git rev-parse origin/work/fase5-6-7-pwa-local
git status --short --branch
git diff --check
```

**Aceite da sincronização:** `HEAD` e `origin/work/fase5-6-7-pwa-local` idênticos; árvore limpa; sem arquivos perdidos. Se `--ff-only` falhar, **não** resolver com merge/rebase automaticamente; diagnostique com `git log --oneline --left-right HEAD...origin/work/fase5-6-7-pwa-local` e peça decisão antes de reconciliar. **Não fazer `git pull origin main`: `main` não contém a entrega atual.** Após novo push de outro agente, repetir inspeção/fast-forward seguro antes de editar.

### Política de ramos e PR

- **Somente a branch de desenvolvimento existente** `work/fase5-6-7-pwa-local` deve receber estes trabalhos; não criar uma branch por fase, por agente ou por correção.
- Usar o **PR #43 já aberto**, mantendo-o como **draft** durante a execução. Não criar novo PR nem fazer merge na `main` sem autorização específica e gate de QA.
- Na última verificação havia **3 branches remotas**: `main`, a branch ativa e `codespace-probable-acorn-v6vvq9rrvjjgcw6w` (**backup**, não branch de desenvolvimento). Não apagar o backup sem auditar se contém trabalho exclusivo, proteger sua recuperação e obter autorização de exclusão.
- Preservar os **quatro stashes conhecidos do Codespace** e quaisquer stashes/worktrees do computador local; não reaplicar backups antigos automaticamente.

## 3. Estado histórico anterior ao fechamento da FASE 5

Os registros abaixo são históricos da retomada e não substituem a evidência canônica atual do status acima. Eles permanecem para rastreabilidade e não devem ser relidos como reprovação da FASE 5 atual.

- **Base de código QA:** `396bf2ff8411a47343e517683c168891c1b99f7b`: `task qa:check` PASS (API **539/539**, Web **171/171**, build e typecheck), offline core **61/61**, PWA smoke **25/25**, browser offline Chromium/WebKit **22/22**, build/precache **349/349**, contratos FASE 5 **10/10** e ensaio local **26/26**. Evidências em `docs/qa/qa-real-monorepo-2026-10-13.md`.
- **Base documental da retomada:** `f15fa4bc3725e8de9c089b01e4edf9ed1dff7a75`: `task qa:regressions` **191/191 PASS** em árvore limpa; `.qa/runs/20261013T192749Z-regressions-f15fa4bc3725-22980/result.json`.
- No mesmo SHA `f15fa4bc`: `task qa:pwa:upgrade-fixture` **34/34 PASS**, Chromium/WebKit, em **cenário sintético**, com preservação de pendências/anexos das seis bases; `.qa/runs/20261013T192834Z-pwa-upgrade-fixture-f15fa4bc3725-24443/result.json`.
- `task qa:phase5` **não foi executado na última tentativa** (bloqueio da ferramenta de navegador). `task qa:phase6` e `task qa:phase7` **ainda não têm scripts** `quality:phase6:local` e `quality:phase7:local` no `package.json` verificado; seus gates são *fail-closed* até implementação real.
- `qa:preprod:local-gates` não foi aprovado: requer `QA_MATRIX_REPORT` válido e FASES 5/6/7 PASS no mesmo SHA. Não confundir isso com erro de API ou liberar produção.
- Código vigente: **React + Vite + TypeScript**, PWA + **IndexedDB**. Capacitor/SQLite são experimentos históricos, **não reativar** sem nova decisão. Frontend/layout atual deve permanecer intacto.

**O commit documental de publicação deste próprio handoff será posterior a `f15fa4bc`: confirme o novo HEAD no pull; não reaproveite o SHA acima como se fosse o HEAD atual.**

## 4. Primeiro bloco local: preparar e executar QA real

A partir da raiz do repositório, confira ambiente e comandos **realmente disponíveis**:

```bash
task --list
task doctor
# Se dependências ou browsers faltarem no computador local:
task setup

task qa:regressions
task qa:check
task qa:phase5
```

Se o gate integral da FASE 5 falhar, registrar pacote, comando, arquivo/linha, causa e exit; corrigir o **menor diff possível**, reexecutar o gate e somente então prosseguir para seu aceite. **Não** mudar thresholds, ignorar falhas ou adicionar skips só para ficar verde.

Depois, execute os gates independentes do PWA/offline e os gates completos **quando os scripts existirem**:

```bash
task qa:pwa:smoke
task qa:pwa:build-preflight
task qa:pwa:upgrade-fixture
task qa:offline:inventory
task qa:offline:core
task qa:offline:browser
task qa:phase6
task qa:phase7
task qa:preprod:rehearsal
```

`task qa:matrix` e `task qa:preprod:local-gates` dependem dos três gates de fase corretamente implementados e dos artefatos do mesmo SHA; primeiro inspecione o contrato em `scripts/qa/`. **Nunca** simule PASS ou use evidência incompleta para contornar o validador.

## 5. Fases a executar, nesta ordem e por dependência

### FASE 5 — Qualidade Web (prioridade imediata)

**Escopo:** finalizar `task qa:phase5`; verificar testes API/Web, lint, tipagem, build, fluxos E2E Playwright, acessibilidade Axe, Lighthouse com baseline medido, cobertura, segurança/segredos, integração e comportamento existente em desktop e mobile.

**Status de aceite:** `QA: APROVADO / WEB READY LOCAL` no escopo local, comprovado pelo registro canônico e revisão independente indicados no status deste handoff. A medição final registrou home performance `67/68/62`, login `84/82/91`, acessibilidade `100` em todos os seis relatórios e preservou os budgets aprovados. O relatório permanente e o Checklist Mestre devem manter a distinção entre este aceite local e a homologação física/produção.

**Limites:** `HOMOLOGAÇÃO REAL PENDENTE` para iOS/Android, GPS/QR, conectividade rural e operação de campo; produção/release, banco/migrations remotos, deploy, secrets, CI hospedado e sincronização administrativa no Notion permanecem fora deste aceite. As FASES 6–9 têm gates e critérios independentes; o encerramento local da FASE 5 não as aprova.

### FASE 6 — PWA e recursos do dispositivo

**Escopo:** preservar identidade/origem/escopo da PWA instalada, consentimento explícito para update, SW e shell recuperáveis, câmera/QR/GPS com feature detection, permissões negadas e fallback; ampliar testes locais de atualização old→new mesma origem, falha de chunk, interrupção, quota e preservação de dados binários. **A suíte sintética 34/34 não comprova a substituição real do legado instalado.**

**Critérios:** implementar o script real `quality:phase6:local` (sem remover gates), executar `task qa:phase6` em Chromium/WebKit e testes pertinentes; registrar `docs/qa/phase6-pwa-local-report.md`. Homologação física iOS/Android/GPS/QR fica **PENDENTE** até piloto, sem bloquear tarefas locais independentes.

### FASE 7 — Offline e sincronização

**Escopo:** migrar de forma versionada, idempotente e retomável **fixtures locais** das **seis bases legadas** identificadas em `docs/62-offline-legacy-migration.md`; não apagar stores nem backups, conservar UUID, tenant/user, Blob/ArrayBuffer, ordem causal, fila, retry/ACK, chave idempotente e isolamento. Implementar/testar Sync push/pull por **fake adapters locais**, conflitos explícitos, troca de conta, duas abas, perda de conexão, corrupção, quota e restart. Autorização é responsabilidade do **backend**, não apenas filtro da Web.

**Critérios:** implementar `quality:phase7:local`, `task qa:phase7` PASS, nenhum caso de perda/duplicação ou vazamento entre usuários/tenants, relatório `docs/qa/phase7-offline-local-report.md`. Não conectar serviços remotos nem declarar migração real aprovada.

### FASE 8 — Preparação de infraestrutura/migração **somente local**

**Escopo:** mapas origem→destino, schema PostgreSQL e migrations **apenas em banco local isolado**, repositories/adapters, autenticação/tenancy, testes SQL/RLS/rollback/backup/reconciliação em dados fictícios ou anonimizados autorizados. Documentar lacunas e plano de staging **sem provisionar staging**.

**Critérios:** contratos e testes locais verdes, reversão ensaiada e documentação de riscos; **não** realizar migrations, acessos ou leituras do Supabase/PostgreSQL remoto.

### FASE 9 — Preparação do piloto **somente local**

**Escopo:** runbooks e simulações locais de carga, recuperação, observabilidade, deploy/rollback **planejados mas não executados**, checklist de segurança e roteiro de homologação física rural, Android/iOS e troca de PWA instalada.

**Critérios:** documentos/ensaios locais verificados e pendências físicas explicitadas. `PRODUCTION READY` e qualquer release seguem **proibidos** sem autorização e homologação.

## 6. Fora do escopo e ações proibidas

- **Não alterar** outros repositórios (incluindo MarkMap), nem a aparência/layout/rotas da Web sem PRD específico.
- Não tocar no banco **Supabase/PostgreSQL remoto**, migrations remotas, produção, Vercel, deploy, release, secrets, contas reais ou dados de cliente.
- Não usar CI hospedado como substituto dos gates locais; Docker/`act` são opcionais, nunca exigência para destravar o QA.
- Não criar branches/PRs redundantes; não mergear `main`, forçar push, apagar stashes, histórico, worktrees ou a branch de backup sem autorização específica.
- Não ampliar SyncVet, Relatto, campanhas, IA ou implementar FASE 11 por conta própria.
- Não usar `indexedDB.deleteDatabase`, `localStorage.clear` ou limpeza de fila como estratégia de atualização/migração.

## 7. Regras de implementação, colaboração e Git

1. **Um executor por área/arquivo compartilhado de cada vez**: confirmar conflitos no Notion e com o restante da equipe antes de editar.
2. Para cada mudança, defina previamente os critérios de aceite, reproduza falha real (RED quando couber), aplique o menor diff, execute testes positivos, negativos, regressão e casos de segurança/tenant.
3. Proibido expor secrets, PII, dados rurais reais ou anexos no `git diff`, logs, documentação, Notion ou PR. Não versionar `.qa/`, `.env`, arquivos locais privados ou dumps.
4. Registrar em `docs/qa/` **comando, SHA, dirty, exit, resumo de testes, evidência `.qa/runs/**/result.json`, limite de cobertura e riscos**. Logs internos ficam no computador do executor.
5. Atualizar **junto da mudança** `CONSUBOV_CHECKLIST_MESTRE.md`, documentação afetada, `CONSUBOV_HANDOFF_CONTINUIDADE.md` e Checklist Mestre no **Notion**.
6. **Commit/push futuros do Codex só mediante autorização explícita do responsável ou autorização expressa no PRD aplicável**; nunca deixar push automático de agentes paralelos. Quando autorizados, fazer commits pequenos **na mesma branch** após QA/diff revisados. O push documental inicial deste handoff já foi autorizado pelo responsável.
7. Continuar usando o **PR #43 draft**; só sinalizar para revisão/merge após gates aceitos e autorização. Não executar merge automaticamente.

## 8. Gate de QA e definição de pronto

- **QA: APROVADO** apenas para os itens com logs no mesmo SHA e testes relevantes verdes, revisor de qualidade quando exigido (usar `qualidade-visionario` quando aplicável).
- **QA: REPROVADO** exige corrigir e reexecutar; não basta relatório ou teste isolado.
- **DEV LOCAL READY** requer automação local adequada e sem P0 de segurança/tenancy/integridade offline.
- **HOMOLOGAÇÃO REAL PENDENTE** não bloqueia desenvolvimento local independente das fases seguintes, mas bloqueia produção/release.
- Validar identidade de tenant, retries, conflitos, multiaba, anexos e conexão ruim antes de declarar os núcleos offline e sync adequados.

## 9. Relatório final obrigatório ao término de cada bloco

Entregue neste formato e atualize handoff/checklist:

```text
REPOSITÓRIO/BRANCH/PR:
SHA LOCAL ANTES -> DEPOIS:
SHA REMOTO VERIFICADO:
GIT STATUS / DIRTY / STASHES:
FASE / ITEM DO CHECKLIST:
ESCOPO EXECUTADO / FORA DO ESCOPO:
ARQUIVOS ALTERADOS / DIFF REVISADO:
COMANDOS, EXIT CODES, TESTES PASS/FAIL:
EVIDÊNCIAS (.qa/runs + docs/qa):
QA: APROVADO | REPROVADO | PENDENTE
NOTION / DOCUMENTAÇÃO / HANDOFF:
COMMIT/PUSH: feito e confirmado | não autorizado | pendente
PR #43: draft | outra condição autorizada
RISCOS / BLOQUEIOS / REVERSÃO:
PRÓXIMO ITEM LIVRE:
HANDOFF PRECISA DE ATUALIZAÇÃO: SIM | NÃO
```

**Critério de encerramento deste pedido:** o Codex faz o `pull --ff-only` na branch correta, demonstra igualdade local/remoto e inicia a FASE 5 pelos gates reais. **Este handoff não autoriza produção nem afirma que fases pendentes foram concluídas.**
