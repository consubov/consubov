# Relatório de Execução de Testes Unitários - CONSUBOV

Data: 2026-10-29
Ambiente: Local (D:\MATEUS\Documentos\GitHub\consubov)
Executor: Subagente QA

## Resumo Executivo
Os testes foram executados utilizando `bun test --filter web`. A suíte apresentou diversas falhas de ambiente/infraestrutura (módulos não encontrados, erro no uso do `vi.hoisted` e erros de definição `window`), indicando problemas na configuração do ambiente de teste ou na compatibilidade entre as dependências instaladas e o runner atual.

**Resultados:**
- Total de testes: 202
- Aprovados: 126
- Falhas/Erros: 131

## Testes Aprovados (Destaques)
- `apps/web/src/lib/gmdGuards.test.ts`: Todos os 17 testes de permissões e consistência aprovados.
- `apps/web/src/test/appSurface.test.ts`: Todos os 6 testes de separação Site vs App aprovados.
- `apps/web/src/lib/relattoBrand.test.ts`: Todos os 8 testes de isolamento de marca aprovados.
- `apps/web/src/lib/safeArithmetic.test.ts`: Todos os 4 testes de aritmética aprovados.
- `apps/web/src/test/consumoPasto.test.ts`: Todos os 4 testes de normalização de consumo aprovados.
- `apps/web/src/test/pennState.test.ts`: 5/5 testes aprovados.
- `apps/web/src/platform/contracts/contracts.test.ts`: 13/13 testes aprovados.

## Pontos Críticos e Erros Identificados
1. **Erro de Ambiente**: `vi.hoisted is not a function` sugere possível incompatibilidade de versão do `vitest`.
2. **Dependências Ausentes**: Muitos testes falharam devido a falta de pacotes como `@playwright/test`, `idb`, `react/jsx-dev-runtime`, etc.
3. **Erros de Runtime**: `ReferenceError: window is not defined` em testes que dependem de DOM.

## Recomendações
- Verificar a integridade das dependências instaladas (`bun install`).
- Analisar a configuração do `vitest` e a versão utilizada.
- Garantir que o ambiente de teste possua as variáveis de ambiente necessárias e o mock correto para o DOM (ex: `jsdom`).
