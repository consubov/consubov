# Sincronizacao local e continuidade segura de agentes

**Repositorio:** `mmatteuus/consubov` | **Branch de desenvolvimento:** `work/fase5-6-7-pwa-local` | **PR:** #43 (draft).

## Estado verificavel

- No GitHub existem `main`, a branch ativa `work/fase5-6-7-pwa-local` e o ramo **somente backup** `codespace-probable-acorn-v6vvq9rrvjjgcw6w`, exportado antes de remover o Codespace antigo. Nao desenvolva no backup, nem o exclua sem revisar. Os dois ramos experimentais mais antigos foram removidos com os commits preservados na ancestralidade (`41a1f9f1` / `3a529837`).
- `main` ainda NAO contem a entrega do PR #43. Fazer `git pull origin main` nao atualiza o codigo de desenvolvimento.
- O unico Codespace foi comprovadamente sincronizado por fast-forward ao SHA de codigo `${base}` e estava limpo nos gates. Nenhum commit/pull permanece pendente nesse checkpoint, mas agentes sempre devem reconferir o SHA mais recente. Os quatro stashes historicos foram preservados; o mais novo contem copia de alteracao de fixture ja publicada. Nao reaplicar stashes automaticamente.
- Resultados historicos de testes pertencem aos SHAs documentados; nao equivalem a QA aprovado no HEAD atual. FASES 5-7 nao tem aceite integral; FASES 8/9 sao preparo local, FASE 11 e planejamento.

## Pull no computador / VS Code

**Primeiro: confira o repositorio e preserve trabalho nao publicado.** Execute na raiz do clone existente:

```bash
git remote -v
git status --short --branch
git branch --show-current
git fetch origin --prune
```

Se houver arquivos modificados/nao rastreados, **pare antes de mudar de branch ou aplicar merge**. Revise `git diff`, `git diff --cached` e os arquivos listados; faca backup/commit apropriado ou stash APENAS dos paths revisados. Nunca use `reset --hard`, `git clean -fd` nem force-push como atalho.

Com arvore limpa, se a branch de trabalho JA existe no clone:

```bash
git switch work/fase5-6-7-pwa-local
git merge --ff-only origin/work/fase5-6-7-pwa-local
```

Se AINDA nao existe no clone, use no lugar dos dois comandos anteriores:

```bash
git switch --track origin/work/fase5-6-7-pwa-local
```

Confirme a identidade da revisao (SHA completo identico nos dois comandos) e verifique a arvore:

```bash
git rev-parse HEAD
git rev-parse origin/work/fase5-6-7-pwa-local
git status --short --branch
git diff --check
```

Se `--ff-only` recusar, ha divergencia: **pare, nao rebase, nao force**. Investigue `git log --oneline --left-right HEAD...origin/work/fase5-6-7-pwa-local` antes de qualquer integracao. Nao substituir o clone local por checkout de `main`.

## Codespace: estado e testes locais comprovados

O Codespace `special garbanzo` recebeu os commits funcionais ate `${base}`, limpo e com os quatro stashes preservados. Os gates executados por SHA (check/API/Web, IndexedDB, SW, Chromium/WebKit e snapshot local) estao em `docs/qa/qa-real-monorepo-2026-10-13.md`. FASES 5–7 integrais e release ainda nao aprovados. Se houver nova mudanca remota, fazer `git fetch origin --prune` e merge `--ff-only` apenas sobre arvore limpa; preservar PRD e trabalho dos outros agentes.

## Protocolo para outros agentes IA

1. Ler `CONSUBOV_HANDOFF_CONTINUIDADE.md`, `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`, este documento, `AGENTS.md`, checklist Git e Checklist Mestre vivo no Notion antes de propor proxima tarefa. Usar o PRD ativo; nao criar PRDs ou branches duplicadas.
2. Registrar `git status`, branch, SHA completo, diferencas e trabalho paralelo em andamento. Nao editar arquivos compartilhados simultaneamente sem coordenacao. Um executor escreve por vez no mesmo checkout.
3. Seguir PWA React/Vite com IndexedDB. Capacitor/SQLite sao experimentos historicos, nao componentes da arquitetura ativa; preservar seis bancos legados, idempotencia, blobs, tenant, autorizacao e consentimento do Service Worker.
4. Validar localmente com o `Taskfile.yml` existente: `task doctor`, `task qa:regressions`, `task qa:check`, e os gates da fase afetada. Guardar `.qa/runs` localmente; registrar resumo sanitizado em `docs/qa/`. Nao usar CI hospedado ou inventar PASS de teste nao executado.
5. Antes de qualquer commit/push autorizado: diff revisado, testes proporcionais ao escopo, documentacao, checklist Git/Notion e handoff atualizados; conferir novamente o HEAD remoto. Commits pequenos e sem dados privados; preferir `[skip ci]` para lotes documentais conforme politica existente.
6. Sem merge do PR #43 na `main`, deploy, migracoes remotas, secrets, producao ou alteracoes irreversiveis sem autorizacao especifica. Pendencias fisicas nao bloqueiam trabalho local independente, mas impedem homologacao de producao.

## Resultado esperado do proximo executor

Registrar SHA local/remoto, estado dirty, comandos e respectivos exits, caminhos alterados, provas de QA (ou pendencias), push realmente confirmado, status por fase e atualizacao do `CONSUBOV_HANDOFF_CONTINUIDADE.md`. Nunca chamar a aplicacao de pronta apenas porque o Git foi organizado.
