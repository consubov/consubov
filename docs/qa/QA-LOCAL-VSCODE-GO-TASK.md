# CONSUBOV — Testes locais no VS Code (Go Task)

**Decisão de 2026-10-08.** O Go Task é o orquestrador principal; `act` reproduz localmente, se necessário, o job `build-and-test` via Docker. Nenhum comando deste guia aciona runners remotos do GitHub. O ambiente e o QA só podem ser marcados como aprovados com logs/evidências.

## Execução verificada neste Windows — 2026-10-13

Na retomada local, Git, Node 24.19.0, Bun 1.4.2 e Task 3.54.0 foram verificados. O lockfile permaneceu congelado; o manifesto declara Bun 1.4.0, portanto registre essa diferença de patch nos relatórios. Task 1.0.1, Playwright 1.1.19 e ESLint 3.0.34 já estavam instalados no VS Code; não foi necessário reinstalá-los.

O Playwright resolvido no Web é 1.64.0; o `bunx` da raiz resolveu outra versão. `task setup` agora chama o CLI instalado em `apps/web` e usa exclusivamente `.qa/tools/playwright-browsers`. Chromium 1248, WebKit 2370 e Firefox 1555 foram instalados e executaram uma fixture HTTP local: três engines, três respostas 200. Isso comprova o ambiente, não o aceite de uma fase.

Use Git Bash no VS Code. Para executar pelo PowerShell deste Windows, configure apenas o processo do terminal antes dos comandos:

```powershell
$env:PATH = 'C:\Program Files\Git\bin;C:\Program Files\Git\usr\bin;' + $env:PATH
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location).Path '.qa/tools/playwright-browsers'
$env:TURBO_FORCE = 'true'
$env:TURBO_CONCURRENCY = '1'
$env:TURBO_UI = '0'
$env:VITE_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = 'phase5-local-test-key'
task doctor
task setup
task qa:regressions
task qa:lighthouse:integrity
task qa:security
task qa:phase5
```

O recorder força o cache de browsers deste repositório nos filhos de QA, inclusive quando outro workspace forneceu uma variável herdada. A instalação também define explicitamente esse cache: pela [precedência do Task 3.54](https://taskfile.dev/docs/guide/environment), uma variável do processo normalmente prevalece sobre `env` do Taskfile. Nenhuma variável de máquina nem cache de outro repositório foi alterado. A configuração acima também serve ao debug manual iniciado pelo terminal; o painel da extensão pode herdar outro ambiente.

`qa:security` executa SAST com ferramentas instaladas e scanner offline de código selecionado e histórico local alcançável. Arquivos privados, dados, logs e caches têm exclusões explícitas, documentadas no relatório; o resultado não certifica esses conteúdos nem verifica provedores externos. Somente categoria/caminho/contagens aparecem nos artefatos sanitizados.

O executor valida `QA_OUTPUT_DIR` e seus ancestrais antes de criar diretórios ou logs. Caminhos fora de `.qa`, junctions, links pendentes e destinos que sejam arquivos são recusados antes das escritas; erros de validação preservam exit não zero e não imprimem conteúdo arbitrário.

`qa:lighthouse:integrity` executa fixtures reais de navegador para conferir isolamento de origem, processo próprio, encerramento e relatórios do produtor; não fornece o orçamento da aplicação. O gate integral mede três pares frios de home/login e verifica os seis originais. O orçamento permanece pendente até medições reais e revisão; SHA de uma árvore limpa não pode ser inventado para um candidato com alterações locais.

As tarefas `qa:*` que usam o recorder geram `.qa/runs/**/result.json` e `output.log`. `doctor` e `setup` são preparação; seus logs e as verificações de versões/browser são registrados separadamente. Os capítulos abaixo preservam procedimentos e resultados históricos, não aprovam o checkout atual.

## Preparação no Windows (agente executor)

O responsável instalou o **Go Task 3.54.0** com `winget install Task.Task` e a extensão **Task** do VS Code. **Não reinstale.** Feche/reabra o terminal integrado e abra a raiz do repositório `consubov` no VS Code.

No terminal **PowerShell** do VS Code, verificar:

```powershell
task --version
git --version
node --version
bun --version
bash --version
```

Se faltar alguma ferramenta essencial, o executor pode instalá-la **somente na máquina local** (não instalar se já estiver funcionando):

```powershell
winget install -e --id Git.Git
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Oven-sh.Bun
```

O repositório declara `bun@1.4.0`; conferir `bun --version` e corrigir divergência relevante antes de usar `--frozen-lockfile`. Os scripts de QA existentes são **Bash**: usar terminal **Git Bash** (instalado com Git for Windows) em vez de supor compatibilidade PowerShell. Se o ambiente Git Bash não executar o script Linux existente, configurar **WSL2/Ubuntu + VS Code Remote WSL** e instalar Task/Bun/Node dentro do WSL; não declarar PASS por adaptação não testada.

Extensões VS Code necessárias/recomendadas:
- `task.vscode-task` — **já instalada**: exibe as tarefas do Taskfile no painel.
- `ms-playwright.playwright` — executar, selecionar e depurar testes E2E no editor.
- `dbaeumer.vscode-eslint` — diagnosticar erros de lint.

O agente pode executar `code --install-extension <id>` para as extensões ausentes. São ferramentas de desenvolvimento, não produtos em produção.

## Execução a partir da raiz

```powershell
task doctor
task setup
task qa:check
task qa:pwa:smoke
task qa:regressions
task qa:offline:inventory
task qa:phase5
task qa:phase6
task qa:phase7
task qa:all
```

Também é possível usar **Terminal → Executar Tarefa** e o painel lateral da extensão Task. No painel **Testing** da extensão Playwright, depurar cada E2E, consultar traces e repetir a suíte toda. `task setup` executa `bun install --frozen-lockfile` e instala Chromium, WebKit e Firefox do Playwright, **sem banco remoto**.

`task qa:phase5` executa o gate real existente `bun run quality:phase5:local` (typecheck/build/unit, lint, coverage, E2E, Axe, Lighthouse, Edge/API smoke, bundle e segurança); corrigir suas falhas e impor thresholds Lighthouse antes de aprovação. `task qa:pwa:smoke` executa apenas testes isolados do Service Worker — **não** valida atualização real da PWA nem preservação de IndexedDB.

`task qa:phase6` e `task qa:phase7` **falham intencionalmente** enquanto não existirem os scripts `quality:phase6:local` e `quality:phase7:local` no `package.json`; o agente deve implementar os testes locais correspondentes, não simular resultados. Rodar as fases separadas permite continuar trabalho independente mesmo com falhas numa etapa. `task qa:all` serve para aceite **integrado** e falha no primeiro gate bloqueante.

### Evidências para validação independente

Cada tarefa cria `.qa/runs/<timestamp>-<fase>-<commit>-<pid>/output.log` e `result.json`: SHA, indicador de alterações não commitadas, início/fim, exit code e PASS/FAIL. `.qa/` está no `.gitignore`. Resultados com `workingTreeDirty=true` não comprovam automaticamente o estado de um commit publicado. Em `docs/qa/`, registrar um relatório **sanitizado** com commit, SO, versões, lista de comandos, casos executados, falhas classificadas, bloqueadores, evidências e tarefas restantes. Nunca subir logs com dados reais, credenciais, arquivos `.env`, fotos de clientes ou dados privados.

## act + Docker (opcionais)

Para reproduzir **localmente** o job `build-and-test` de `.github/workflows/ci.yml`, o agente pode instalar, conforme necessidade:

```powershell
winget install -e --id Docker.DockerDesktop
winget install -e --id nektos.act
docker info
act --version
task qa:act
```

Abrir Docker Desktop antes de executar. `act` usa CPU/disco/rede locais (pode baixar images/actions) e **não consome minutos do CI remoto**. Ele não reproduz integralmente o ambiente de GitHub, e não substitui os gates Go Task nem os scanners faltantes. Nenhuma secret real será passada para `act`.

## Dois gates: desenvolvimento e implantação

**1. Gate DEV LOCAL READY:** implementação e testes automatizados locais relevantes **PASS**, nenhuma falha P0, cobertura de segurança/RBAC/tenant, integridade offline, atualização da PWA antiga→nova sem perda, testes de retry/idempotência e migração com fixtures. Esse gate permite **seguir desenvolvendo** a fase seguinte.

**2. Gate HOMOLOGAÇÃO REAL / PRODUÇÃO:** testar fisicamente em iOS/Android e conectividade rural, GPS, câmera/QR, segundo plano, atualização da PWA já instalada, filas de pesagem/foto/salga, migração e recuperação/rollback, mais backup/restore, autorização e observabilidade do ambiente. Essas verificações **físicas** ficam registradas como `HOMOLOGAÇÃO REAL PENDENTE` e **não travam implementação** das FASES 6, 7, preparação local da 8 ou trabalhos independentes. Não são substituídas por emulação e são obrigatórias para a liberação a usuários em produção, idealmente em piloto/staging controlado. Após a implantação autorizada, executar smoke de produção.

**Nunca adiar os testes automatizáveis de integridade de dados offline, isolamento de tenant, auth/segurança e atualização sem perda.** Uma falha P0 impede `DEV LOCAL READY`, mas não impede preparar atividades independentes; não renomear isso para QA aprovado.

**FASE 8:** preparar localmente schema, adapters e migrations de ensaio; **não conectar nem alterar banco remoto** sem autorização explícita. **FASE 9:** preparação local permitida; deploy/release/secrets/migrations remotas exigem autorização explícita.

## Protocolo para qualquer agente

Ler `AGENTS.md`, `CONSUBOV_CHECKLIST_MESTRE.md`, `docs/README.md`, `instructions/README.md` e o PRD/handoff ativo. Conferir `git status` e branch `work/fase5-6-7-pwa-local`; preservar o trabalho alheio, não criar branches duplicadas. Instalar somente ferramentas locais de teste necessárias. Corrigir falhas reais, evitar `skip`/threshold falso e registrar evidências por commit. Atualizar checklist repositório/Notion e handoff quando a implementação mudar.

**Relatório final exigido:** versões, SHA e workingTreeDirty, comandos e exit codes, falhas/testes por fase, classificação DEV LOCAL READY ou REPROVADO, pendências físicas, arquivos alterados, pendências P0 e confirmação de nenhuma ação externa não autorizada.

## Atualização de auditoria 2026-10-09

- `task qa:regressions` cobre 23 testes isolados atualmente versionados: Service Worker, trava de atualização, injeção do build, orçamento Lighthouse e inventário offline. Esse PASS não aprova FASES 5–7.
- `task qa:offline:inventory` inspeciona apenas metadados das seis bases legadas. Não executa migrações, não lê dados de clientes e não limpa bases.
- `task qa:phase5` armazena Lighthouse e logs em `.qa/phase5-<timestamp>/`. O orçamento Lighthouse está propositalmente `PENDING_LOCAL_BASELINE`: medir e aprovar thresholds por SHA antes de marcar a fase verde.
- Este ambiente de auditoria não tem Bun e bloqueia `localhost` no Chromium (`ERR_BLOCKED_BY_ADMINISTRATOR`), então a suite completa Web e upgrade em browser devem ser realizados pelo executor no VS Code.

## Novo fluxo incremental (2026-10-09)

Com a branch `work/fase5-6-7-pwa-local` atualizada, executar os blocos independentes:

```powershell
task qa:regressions
task qa:offline:core
task qa:pwa:build-preflight
task qa:pwa:upgrade-fixture
task qa:matrix
```

- `qa:regressions`: regressões Node puras do SW, orçamento Lighthouse, inventário, IndexedDB simulado, comandos offline, matriz QA e integridade de build. Este resultado **não aprova** toda a fase.
- `qa:offline:core`: testa o novo banco `consubov-vnext-local` isolado por tenant/usuário e as transições do comando. Não migra o legado nem envia dados.
- `qa:pwa:build-preflight`: compila o Web localmente e recusa mudança do identificador PWA, asset não precacheado, arquivo ausente, SW não injetado ou versão incoerente. Não substitui Playwright/E2E.
- `qa:pwa:upgrade-fixture`: sobe um HTTP server **somente localhost** em Playwright Chromium/WebKit, simula duas builds do SW no mesmo origin, armazenamento Blob/backup e falha de chunk lazy. É um teste sintético de mecânica SW; **não** substitui harness da PWA legada real com migração de todas as bases.
- `qa:matrix`: executa **todos** os gates separadamente, mesmo se uma fase falhar, grava JSON/Markdown em `.qa/matrix/` e sai com erro se qualquer um falhar. Útil para reduzir espera administrativa sem inventar resultados verdes.

**Estado de revisão:** scripts e testes Node isolados passaram no ambiente técnico de auditoria. **Playwright navegador real, Bun build completo, Axe/Lighthouse reais e FASES 5–7 integrais não foram executados aqui**; faça-os no checkout local do VS Code, com logs sanitizados.

**Segurança:** não alterar/limpar bancos legados, não confiar no adapter como autorização server-side, não acessar Supabase remoto, Vercel, CI hospedado, migrations nem deploy.

## Gate local para preparação das FASES 8–9 (2026-10-09)

O relatório consolidado criado pelo `task qa:matrix` pode ser inspecionado por `task qa:preprod:local-gates`, apontando `QA_MATRIX_REPORT` para o JSON gerado. O verificador **rejeita** SHA divergente, working tree suja, registros simulados ou FASE 5/6/7 pendente. Mesmo quando passar, libera **apenas revisão local**, não produção. Consulte `docs/64-fase8-9-local-readiness.md`. Não iniciar deploy/banco remoto.

## FASE 7 — fila transacional e teste real (2026-10-09)

O pacote local `apps/web` **já declara** `fake-indexeddb` como dependência de desenvolvimento. `task setup` instala a dependência pelo lockfile. Não usar scripts remotos, banco externo, nem CI hospedado.

```powershell
task qa:offline:core
task qa:offline:browser
task qa:pwa:upgrade-fixture
task qa:matrix
```

- `qa:offline:core` executa testes de IndexedDB fake local e políticas de comando, incluindo **14 cenários** da fila transacional persistida.
- `qa:offline:browser` testa em Chromium e WebKit **verdadeiros** a disputa de comandos em duas abas, reconstrução/reabertura do banco, offline Blob/ArrayBuffer, isolamento por usuário e rejeição de ACK antigo; sem API real.
- `qa:pwa:upgrade-fixture` inclui o navegador da fila além dos cenários PWA sintéticos. Falha em qualquer teste deve ser registrada, não substituída por fake ou skip.
- FASE 7 **ainda não concluída**: falta migração versionada das seis bases legadas, integração ao fluxo de sessão/tenancy e sync autoritativo simulado com caos. Homologação física fica para pré-produção.


## Estabilidade do Codespace - 2026-10-10

Tmux 3.3a instalado no Codespace; sessao consubov-control criada e testada sem cliente anexado. Configuracao local .vscode/settings.json: remote.autoForwardPorts=false; portas existentes nao foram tornadas publicas.

Executado task qa:offline:browser em janela tmux destacada; ao sair da tela do VS Code, abrir /login local e voltar, a execucao foi recuperada sem reiniciar: 10/10 PASS em Chromium/WebKit, exit=0, 39.5s. Evidencia: .qa/runs/20261010T031211Z-offline-browser-e0c19265c5fb-27778/result.json e .qa/offline-browser-detached.log. HEAD e0c19265; checkout com alteracoes locais preexistentes, nao equivale a QA de commit limpo.

Ultima E2E completa existente: 60 PASS / 42 FAIL, exit=1; nao reexecutada nesta etapa. Nenhuma fase aprovada. Logs do navegador mostraram extension host remoto sem resposta e latencia alta; causa exata por extensao ainda nao isolada. Opera sem conexao autorizada e Desktop Commander offline.

Retomada: tmux ls e tmux attach -t consubov-control. Antes de reenviar comando apos timeout, conferir processos, logs e exit code. Nao duplicar suites nem sobrescrever relatorios. Tmux nao sobrevive a parada/recriacao da VM; nao mudar timeout/billing ou desligar seguranca. Sem CI hospedado, banco remoto, push, merge ou deploy.

## Retomada 2026-10-10 - validacao parcial
HEAD fb4f80d0 (dirty): regressions 112/112 PASS; qa:check exit 0 com 134 testes Web (API em cache); fixture PWA 16/16 Chromium/WebKit PASS; lint selecionado 0 erros, 2 avisos. Logs em .qa/review/.
Push de fb4f80d0 confirmado. Novo commit de fazendas bloqueado pelo assinador Codespaces: 403 Author is invalid. GPG mantido; dois arquivos de fazendas preparados, demais alteracoes preservadas. Fases 5-7 NAO aprovadas; E2E geral, migracao integrada, acessibilidade e performance pendentes. Nenhum CI hospedado, merge ou deploy.


## Publicacao incremental revisada - 2026-10-10
- Correcao de fazendas publicada: 17ed1b45 (falha de carregamento, 403 sem dados rejeitados e retry).
- Testes PWA publicados: dde8aec3 (perfil persistente isolado, ESM e consentimento explicito).
- Evidencia nova: 10/10 testes Vitest selecionados PASS e typecheck Web exit=0; .qa/review-current/targeted.log.
- Fixture PWA: 16/16 Chromium/WebKit PASS, 1.2m, exit=0; .qa/runs/20261010T212419Z-pwa-upgrade-fixture-17ed1b45bbd3-6644/result.json. Fonte permaneceu inalterada durante a rodada, checkout tinha alteracoes pendentes.
- Assinador do Codespace retornou 403 Author is invalid. Publicacao pela API GitHub autenticada, commits sem assinatura; GPG e protecoes do repositorio nao foram desativados. Fast-forward local validou igualdade do indice/tree; nenhum reset ou force push.
- Decisao do responsavel: priorizar entrega incremental para testes, levando pendencias nao criticas ao backlog. Isto nao dispensa seguranca, isolamento ou preservacao offline e nao equivale a aprovar fases inteiras.
- FASE 5: corrigir E2E incompatibilidades reais e concluir gates essenciais. FASE 6: fixture aprovada, falta ensaio do build legado real. FASE 7: fila testada, migracao/integracao ainda pendentes.
- Sem GitHub Actions hospedado, merge na main, deploy, banco remoto ou dados reais.

### Medição parcial independente da FASE5

`task qa:phase5:built-audits` coleta Axe público e três pares frios Lighthouse no build local existente, em preview próprio `127.0.0.1:8081`, depois do preflight de `apps/web/dist`. É diagnóstico parcial: não aprova orçamento nem FASE5. Após mudanças em código Web, execute primeiro `task qa:pwa:build-preflight`; depois congele fontes e encerre outras execuções pesadas/browser antes da medição. Logs/result.json ficam em `.qa/runs`; seis originais em `.qa/phase5-built-audits-*`. O gate integral `task qa:phase5` continua obrigatório, sem skips ou thresholds reduzidos. Browser local usa2workers e cenários limitados ao deadline original; nenhum job pesado paralelo às medições.

O teste `scripts/tests/sw-precache-integrity.test.mjs` integra `qa:pwa:smoke`, `qa:regressions` e o gate integral FASE5. Ele executa o SW real em VM com fronteiras Fetch/Cache controladas:349 assets completos/deduplicados, máximo4 operações fetch/put, shell por último, falhas drenadas antes da limpeza e rejeição falsy. Não substitui instalação/upgrade/offline em navegador real. Registrar falhas de instalação, shell ausente e todos os relatórios frios; não desativar o SW nem aumentar limites para obter PASS.

Diagnostico unitario completo: execute task qa:web:unit pela raiz. O Web usa2workers isolados e pool threads no Windows/forks nos demais sistemas, evitando o caminho de startup que falhou no Windows local; timeouts e todos os testes permanecem ativos. O resultado focado nao substitui task qa:phase5.

## Linux VPS / code-server — CI local com Chromium (2026-11-01)

Esta secao complementa o procedimento historico para Windows. Na VPS, usar o container Docker **existente** `vscode` (code-server), a extensao gratuita `task.vscode-task` e o Playwright instalado no proprio workspace. Nao usar GitHub Actions, banco remoto, dados reais ou servicos pagos para executar os testes.

1. Abrir no VS Code um worktree isolado e usar **Terminal > Executar Tarefa > CONSUBOV: CI local (porta Playwright isolada)**. A tarefa chama `bash scripts/qa/run-ci-vscode-local.sh` e registra saida por gate em `.qa/runs/vscode-ci-local/<execucao>/`.
2. O script cria um clone **local** do SHA corrente dentro de `/tmp`, aplicando apenas o diff versionado (nunca copia `.env` privado, imagens de clientes ou dados offline). Isso protege o `.git/config` compartilhado contra suites que criam repositórios temporarios. O clone nao faz rede nem altera o checkout principal; evidencias resumidas ficam no worktree.
3. O code-server ocupa a porta `8080`. O runner seleciona outra porta loopback disponivel e exporta `CONSUBOV_E2E_PORT` para Playwright e Vite. Na ausencia dessa variavel, `apps/web/playwright.config.ts` conserva **8080**, mantendo `--strictPort`, `reuseExistingServer=false` e a rejeicao de listener preexistente. Nao encerre processos Playwright de outros agentes.
4. E2E usa `CI=1`, 2 workers e somente fixtures locais (`VITE_SUPABASE_URL=http://127.0.0.1:54321` e `VITE_SUPABASE_PUBLISHABLE_KEY=phase5-local-test-key`). Os testes bloqueiam conexoes de navegador fora de loopback e interceptam auth/REST/storage. Esses valores sao ficticios, nao credenciais; nao conectar Supabase remoto.
5. O runner inclui frozen install, API/Web/typecheck/build, regressões, PWA, offline, contratos, segurança local, F23 unit, relatorio/limite do bundle, auditoria HIGH, lint de alteracoes e **E2E Chromium completo**. Cada etapa falha com codigo diferente de zero quando necessario; nenhum SKIP conta como PASS. Um `EXIT=0` e os recibos de QA provam apenas o QA local daquele SHA/diff, nao homologacao fisica nem publicacao em dispositivos.

Preparacao **uma vez por ciclo de vida do container**, somente quando o Chromium faltar: no terminal code-server, `cd apps/web && bunx playwright install chromium`; para bibliotecas Linux ausentes, o administrador pode executar `docker exec --user root vscode sh -lc 'cd /home/coder/workspace/consubov/apps/web && bunx playwright install-deps chromium'`. Ambas as instalacoes sao gratuitas; as bibliotecas instaladas na camada do container podem precisar ser reaplicadas apos recriacao da imagem. Nao instalar Docker novamente na VPS.

Para repetir apenas o E2E no ambiente isolado, usar uma porta livre com `CONSUBOV_E2E_PORT`, definir as duas variaveis ficticias acima e executar `CI=1 bun run --cwd apps/web test:e2e --workers=2`. Na instalacao de 2026-11-01 foram utilizados Bun 1.4.0, Playwright 1.64.1 e Chromium 1248. Nao reconfigurar o Vercel, nao elevar revisao F23 e nao publicar manualmente como efeito colateral do teste.

### Evidencia VPS em 2026-11-01 (candidato antes do merge)

- Worktree isolado base `d0d40437c3856b7cc77cbc11b2dad0975ed0edae`. `bash -n`, JSON de tasks, `git diff --check`: PASS. Testes negativos de listener Playwright em porta alternativa: **3/3 PASS**; a porta `8080` permaneceu ocupada pelo code-server.
- Pipeline local do code-server no clone Git isolado: **EXIT=0** em frozen install, check (API **618/618**, Web **327/327**, typecheck/build), regressões **477/477**, PWA **32/32**, offline **61/61**, contratos **10/10**, security local, F23 unit **18/18**, bundle budget, auditoria HIGH e lint changed. Recibos `status=PASS`, `sourceUnchanged=true` para os gates que usam recorder.
- A primeira tentativa E2E sem fixtures de backend falhou em dois redirects de autenticacao e foi **interrompida intencionalmente** para evitar resultados invalidos. Repetidos isoladamente com URL e chave ficticias do projeto, os 2 testes passaram. **Suíte E2E completa** em Chromium com os mesmos valores, porta automatica `33911`, 2 workers, `CI=1`: **180/180 PASS**, exit=0, desktop/tablet/mobile, 4.8 minutos. Logs locais no worktree `.qa/runs/vscode-ci-local/e2e-fixture-full-20261101.log` (nao enviar logs brutos para o repositorio).
- Este resultado e **DEV LOCAL QA**, nao inclui dispositivo fisico, migracao/release ou deploy; a integracao na main exige diff/sha final verificados. Codigo/versao F23 nao alterados.
