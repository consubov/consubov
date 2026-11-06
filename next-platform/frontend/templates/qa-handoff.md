# Recibo técnico de QA

Preencher com valores observados; campo vazio significa não medido.

| Campo | Valor observado |
| --- | --- |
| Tarefa / app / executor / owner | |
| Worktree / HEAD inicial e final / estado dirty | |
| Hash de lock/config e manifesto completo de fontes | |
| Comando real / cwd / OS / browser / viewport | |
| Início/fim / exit / PASS–FAIL–NOT RUN | |
| Casos positivos/negativos executados | |
| Caminho result.json / output.log / artefatos | |
| Escopo sourceUnchanged e exclusões | |
| Origem da falha e controle injetado | |
| Limites / invalidação / próximo owner | |

Separar execução local de homologação independente, instalação física e produção. Não inferir PASS a partir de existência de arquivo, quantidade de testes ou recibo de outro checkout/SHA. Registrar dirty e arquivos untracked; não usar somente `git diff` como identidade de fontes.
