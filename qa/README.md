# Guia QA do Projeto CONSUBOV

Este guia documenta o workflow de Quality Assurance (QA) local para o projeto CONSUBOV, incluindo as Fases 5, 6 e 7.

## Visão Geral

O sistema de QA usa **Go Task** como task runner e está estruturado em gates (fases) que devem ser executados sequencialmente para validar progresso.

### Estrutura de Pastas QA
```
qa/
├── setup-qa-environment.ps1  # Script de setup manual (PowerShell)
├── run-package-script.sh     # Valida e executa scripts do package.json
├── doctor.sh                 # Verifica dependências do sistema
├── record.sh                 # Grava execuções QA com logs e metadados
└── run-act.sh               # Executa act para CI local (requer Docker)
```

## Pré-requisitos

### Instalações Obrigatórias

1. **Git** - Controle de versão
2. **Node.js** - Runtime JavaScript (versão declarada no package.json)
3. **Bun** - Package manager e runtime (versão declarada no package.json)
4. **Go Task (task)** - Task runner (v3.54.0+)
   ```bash
   scoop install task  # Windows via Scoop
   ```

### Instalações Opcionais

5. **Docker Engine/Desktop + act** - Para reprodução local do CI
   ```bash
   # act CLI
   brew install act  # macOS
   choco install act-cli  # Windows
   ```

### Extensões VS Code

Instale globalmente no VS Code:
```bash
code --install-extension ms-playwright.playwright --global
code --install-extension dbaeumer.vscode-eslint --global
```

## Setup Inicial

Execute uma única vez para configurar o ambiente:

### Opção 1: Usando Taskfile
```bash
task doctor    # Verifica dependências
task setup     # Instala dependências e navegadores Playwright
```

### Opção 2: Manualmente
```powershell
# Execute no PowerShell:
cd d:\MATEUS\Documentos\GitHub\consubov
.\qa\setup-qa-environment.ps1
```

## Workflow QA por Fase

### Estado Atual das Fases
- **FASE 5**: Implementada (`quality:phase5:local` no package.json)
- **FASE 6**: Parcial (`qa:pwa:smoke` - não é gate completo)
- **FASE 7**: Pendente (scripts ainda não implementados)

### Tasks Disponíveis

| Task | Descrição | Status |
|------|-----------|---------|
| `task qa:phase5` | Executa gate completo da Fase 5 | ✅ Implementado |
| `task qa:pwa:smoke` | Testes PWA superficiais (Fase 6 parcial) | ⚠️ Parcial |
| `task qa:phase6` | Executa gate completo da Fase 6 | ❌ Não implementado |
| `task qa:phase7` | Executa gate completo da Fase 7 | ❌ Não implementado |
| `task qa:all` | Executa todas as fases implementadas | ✅ (executa o que existe) |
| `task qa:act` | Executa CI local com act (opcional) | ✅ (requer Docker) |

## Executando os Gates

### Gate da Fase 5 (Completo)
```bash
# Executa gate completo da Fase 5
task qa:phase5

# Verificar logs e resultados
ls -la .qa/runs/
```

### Gate da Fase 6 (Parcial)
```bash
# Executa smoke tests PWA (não é gate completo!)
task qa:pwa:smoke

# IMPORTANTE: Este smoke test NÃO deve contar como aceite da Fase 6
```

### Gate da Fase 7 (Pendente)
```bash
# Atualmente falha explicitamente - aguarde implementação
task qa:phase7  # Exit code 2: "Script quality:phase7:local inexistente"
```

### Execução em Batch
```bash
# Executa todas as fases implementadas
task qa:all
```

## CI Local com act (Opcional)

Requer Docker e act CLI instalados:

```bash
# Verifica se act está disponível
task doctor

# Executa workflow CI local
task qa:act

# Processo:
# 1. Baixa actions/imagens na primeira execução
# 2. Executa job `build-and-test` localmente
# 3. Não consome minutos dos runners GitHub
# 4. Artifacts em `.qa/act-artifacts/`
```

## Registro de Execuções

Todas as execuções QA são registradas automaticamente:

```
.qa/runs/
└── 20241008T181500Z-phase5-8fcba596/
    ├── output.log       # Log completo da execução
    └── result.json      # Metadados com status, timestamps, commit
```

### Formato do result.json
```json
{
  "task": "phase5",
  "startedAt": "2024-10-08T18:15:00Z",
  "finishedAt": "2024-10-08T18:16:30Z",
  "commit": "8fcba596",
  "exitCode": 0,
  "status": "PASS",
  "log": "output.log"
}
```

## Scripts de Suporte

### doctor.sh
Verifica dependências do sistema:
```bash
bash qa/doctor.sh
```
Saída esperada:
```
[OK] bash: /usr/bin/bash
[OK] git: /usr/bin/git
[OK] node: /usr/bin/node
[OK] bun: /usr/bin/bun
[OK] task: /usr/bin/task
```

### record.sh
Grava execuções com logs e metadados:
```bash
bash qa/record.sh "test-name" bun run test:unit
```

### run-package-script.sh
Valida e executa scripts do package.json:
```bash
bash qa/run-package-script.sh quality:phase5:local
```

## Troubleshooting

### Problemas Comuns

1. **`task doctor` mostra dependências faltando**
   ```
   [PENDENTE] bun não encontrado no PATH
   ```
   Solução: Instale Bun com a versão correta do package.json

2. **Playwright browsers não instalados**
   ```bash
   # Instalar manualmente
   cd apps/web
   bunx playwright install chromium webkit firefox
   ```

3. **act/Docker não disponíveis**
   - Verifique se Docker Engine está rodando
   - `docker info` deve funcionar
   - `act --version` deve mostrar versão instalada

4. **Extensões VS Code não instaladas globalmente**
   ```bash
   # Listar extensões instaladas
   code --list-extensions --show-versions | grep -E "(playwright|eslint)"
   ```

### Windows/WSL Notes

- Use Git Bash ou WSL para scripts bash
- Confirme paths corretos para binários
- Verifique permissões de execução: `chmod +x qa/*.sh`

## Critérios de Aceite

### Para cada fase:
1. ✅ `task doctor` passa sem erros
2. ✅ `task setup` completa sem erros
3. ✅ Gate específico da fase (`qa:phaseN`) passa
4. ✅ Evidências completas registradas em `.qa/runs/`
5. ✅ Relatório sanitizado gerado em `docs/qa/`

### IMPORTANTE
- Um PASS de script isolado NÃO basta para marcar o gate da fase
- Smoke tests (`qa:pwa:smoke`) NÃO substituem gates completos
- Atualize o Checklist Mestre após validação
- Push/merge/deploy remotos exigem autorização explícita

## Próximos Passos

### Status das Fases

1. **FASE 6**: `quality:phase6:local` implementado no `package.json`. Código e bridges nativas do Capacitor concluídas. Execução automatizada local bloqueada pelo runner `@playwright/test` por divergência de versão em monorepo Bun.
2. **FASE 7**: `quality:phase7:local` implementado no `package.json`. Adapters SQLite e estratégia de sync offline finalizados.
3. **Resolução de Ambiente E2E**: Alinhar dependência e hoisting do Playwright entre a raiz e `apps/web` para destravar execução automatizada contínua.

### Integração com Checklist Mestre
- Atualizar status das Fases 5, 6, 7
- Documentar evidências de execução
- Handoff após validação completa

## Referências

- [Taskfile.yml](../Taskfile.yml) - Definição de todas as tasks
- [.work-go-task/](../.work-go-task/) - Documentação original do kit
- [.vscode/](../.vscode/) - Configurações VS Code

---

**Última atualização**: Baseado em commit `8fcba596` (melhorias)
**Status do classificador**: Temporariamente indisponível - use script manual
