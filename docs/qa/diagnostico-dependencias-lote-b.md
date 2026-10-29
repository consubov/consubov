# Diagnóstico de Dependências - Lote B (CONSUBOV)

## Resumo
A inspeção do repositório indica uma divergência significativa nas dependências, especialmente na gestão de lockfiles e compatibilidade do Zod. PRs #61 e #63 abordaram a estabilização de dependências e a compatibilidade com Zod 4.

## Estado Atual
- **Zod**: `apps/web/package.json` utiliza `"zod": "^3.25.76"`.
- **Problema de Build**: O ambiente local encontra dificuldades de resolução de pacotes (`EEXIST: File exists` em symlinks) e erros de execução de scripts de `typecheck` devido à falta de binários esperados no `node_modules` (tsc).
- **Estrutura**: O projeto utiliza `turbo` (não encontrado no path local ou `node_modules` corretamente resolvido) e scripts baseados em `task` (Taskfile).

## Conclusão do Diagnóstico
O ambiente de desenvolvimento local está em um estado "sujo" de dependências. O uso de `bun install` está falhando em criar symlinks necessários, provavelmente por conflitos de versões ou arquivos remanescentes de tentativas anteriores de build.

## Recomendações de Harmonização
1. **Limpeza Profunda**: Remover `node_modules` e lockfiles (`bun.lockb` ou `bun.lock`) em todo o projeto.
2. **Reinstalação Limpa**: Utilizar `bun install --frozen-lockfile` após garantir que a branch `main` está limpa e sincronizada com `origin/main`.
3. **Validar Binários**: Garantir que o `turbo` esteja disponível via `npx turbo` ou instalado como dependência do monorepo, e ajustar o `typecheck` em `apps/web` para chamar `tsc` diretamente ou através do gerenciador de pacotes corretamente.
4. **Zod**: Manter a versão atual do Zod (`^3.25.76`) conforme configurado em `apps/web`, validando com os testes recém-adicionados (`apps/web/src/lib/zodSchemas.test.ts`).
