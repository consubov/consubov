# CONSUBOV — Testes locais no VS Code (Go Task)

**Decisão de 2026-10-08.** O Go Task é o orquestrador principal; `act` reproduz localmente, se necessário, o job `build-and-test` via Docker. Nenhum comando deste guia aciona runners remotos do GitHub. O ambiente e o QA só podem ser marcados como aprovados com logs/evidências.

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
