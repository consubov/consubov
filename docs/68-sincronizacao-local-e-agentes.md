# Sincronizacao local e continuidade segura de agentes

**Repositorio:** `mmatteuus/consubov` | **Branch de desenvolvimento:** `work/fase5-6-7-pwa-local` | **PR:** #43 (draft).

## Estado verificavel

- No GitHub, apenas `main` e `work/fase5-6-7-pwa-local` permanecem como branches remotas. Os dois ramos historicos foram excluidos depois da preservacao de seus commits na ancestralidade da branch de trabalho (`41a1f9f1` / `3a529837`).
- `main` ainda NAO contem a entrega do PR #43. Fazer `git pull origin main` nao atualiza o codigo de desenvolvimento.
- Ultima observacao do Codespace: um acrescimo local no PRD ativo e checkout 52 commits atras do remoto. A sincronizacao desse checkout NAO foi confirmada. Antes de puxar, proteger qualquer mudanca local; nao presumir que a arvore esta limpa.
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

## Codespace: pendencia local conhecida

Antes do fast-forward no Codespace, revisar `instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md` e preservar seu diff de capacidades PWA/GPS. Se for necessario usar stash, restrinja ao arquivo revisado e prefira `git stash apply` (mantem o backup) ate validar a reconciliacao. A operacao ainda nao esta comprovada.

## Protocolo para outros agentes IA

1. Ler `CONSUBOV_HANDOFF_CONTINUIDADE.md`, `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`, este documento, `AGENTS.md`, checklist Git e Checklist Mestre vivo no Notion antes de propor proxima tarefa. Usar o PRD ativo; nao criar PRDs ou branches duplicadas.
2. Registrar `git status`, branch, SHA completo, diferencas e trabalho paralelo em andamento. Nao editar arquivos compartilhados simultaneamente sem coordenacao. Um executor escreve por vez no mesmo checkout.
3. Seguir PWA React/Vite com IndexedDB. Capacitor/SQLite sao experimentos historicos, nao componentes da arquitetura ativa; preservar seis bancos legados, idempotencia, blobs, tenant, autorizacao e consentimento do Service Worker.
4. Validar localmente com o `Taskfile.yml` existente: `task doctor`, `task qa:regressions`, `task qa:check`, e os gates da fase afetada. Guardar `.qa/runs` localmente; registrar resumo sanitizado em `docs/qa/`. Nao usar CI hospedado ou inventar PASS de teste nao executado.
5. Antes de qualquer commit/push autorizado: diff revisado, testes proporcionais ao escopo, documentacao, checklist Git/Notion e handoff atualizados; conferir novamente o HEAD remoto. Commits pequenos e sem dados privados; preferir `[skip ci]` para lotes documentais conforme politica existente.
6. Sem merge do PR #43 na `main`, deploy, migracoes remotas, secrets, producao ou alteracoes irreversiveis sem autorizacao especifica. Pendencias fisicas nao bloqueiam trabalho local independente, mas impedem homologacao de producao.

## Resultado esperado do proximo executor

Registrar SHA local/remoto, estado dirty, comandos e respectivos exits, caminhos alterados, provas de QA (ou pendencias), push realmente confirmado, status por fase e atualizacao do `CONSUBOV_HANDOFF_CONTINUIDADE.md`. Nunca chamar a aplicacao de pronta apenas porque o Git foi organizado.
