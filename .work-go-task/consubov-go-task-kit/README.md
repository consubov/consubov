# CONSUBOV — Go Task / QA local

> Entrega para adicionar ao checkout local de `work/fase5-6-7-pwa-local`.
> Nenhum workflow remoto deve ser executado, nem deploy/merge/branch remoto realizado por este kit.

## Instalação no computador do executor

Instalar os executáveis **Bun** (versão declarada no `package.json`), **Node**, **Go Task (task)** e **Git**. Usar os instaladores/gerenciadores adequados ao sistema operacional. O Taskfile usa **Bash**; no Windows, usar WSL/Git Bash e conferir os paths. Opcionalmente, instalar **Docker Engine/Desktop + act** para reproduzir o job `build-and-test` localmente.

No VS Code, instalar extensões **Playwright Test for VS Code** (`ms-playwright.playwright`) e **ESLint** (`dbaeumer.vscode-eslint`). Go Task é um CLI; ele é invocado pelo terminal e pela configuração `.vscode/tasks.json`, sem extensão extra obrigatória.

## Instalação do kit

Copiar `Taskfile.yml`, `scripts/qa/` e `.vscode/` para a raiz do projeto. Adicionar a `.gitignore`:

```gitignore
.qa/
!.vscode/tasks.json
```

Atenção: se `.vscode/*` está ignorado, adicionar `!.vscode/tasks.json` após essa regra.

## Comandos

```bash
task doctor
task setup
task qa:phase5
task qa:pwa:smoke
task qa:phase6
task qa:phase7
task qa:all
task qa:act          # opcional; requer Docker e act
```

Os artefatos ficam em `.qa/runs/<data>-<fase>-<commit>/output.log` e `result.json`. O resumo traz commit/horários/exit code. Logs podem conter dados sensíveis: revisar e sanitizar antes de enviar. **Um PASS de script isolado não basta para marcar o gate da fase.**

**Estado comprovado na data da preparação:** `quality:phase5:local` está no `package.json`. Os scripts `quality:phase6:local` e `quality:phase7:local` ainda não foram observados; tarefas correspondentes falham explicitamente até serem implementadas. `qa:pwa:smoke` é parcial e nunca deve contar como aceite da FASE 6.

## Continuidade / critérios de aceite

1. Rodar `task doctor`, `task setup` e `task qa:phase5` no checkout local, corrigir falhas e obter evidências completas (E2E, Axe, Lighthouse com thresholds, segurança, API, coverage).
2. Implementar os gates efetivos de FASES 6 e 7 antes de invocar `task qa:all`. Testar upgrade PWA antigo→novo **no mesmo origin**, incluindo a integridade de IndexedDB, filas e fotos offline.
3. Se útil, executar `task qa:act` para verificar paridade de `build-and-test`; ele pode baixar actions/imagens na primeira vez e não substitui os gates locais nem equivale 100% a um runner hospedado.
4. Entregar relatório sanitizado em `docs/qa/`, atualizado contra o commit exato, com os resultados por gate; não declarar `QA APROVADO` se algum critério obrigatório estiver aberto.
5. Atualizar Checklist Mestre (repositório/Notion) e handoff depois da validação. Push, merge, deploy e conexões remotas exigem autorização.

## Limitações

- Criar/instalar o kit não executa testes no computador do usuário.
- Os scripts locais poderão exigir adaptação para Windows/WSL e dependências nativas de browsers.
- `act` usa Docker e pode exigir downloads de actions/imagens; usa CPU/memória locais, não minutos do GitHub Actions.
