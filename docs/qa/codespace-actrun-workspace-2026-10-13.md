# QA operacional — avisos Act/Run no Codespace CONSUBOV (2026-10-13)

## Sintomas observados
Apos abrir o VS Code Web no unico Codespace ativo (`special garbanzo`, workspace `/workspaces/consubov`), surgiram duas notificacoes com origem explicitamente `Act/Run - GitHub Actions Visual locally`:
1. `"act" was not found automatically. Tell us where the executable is.`
2. `No container runtime detected. act requires Docker or an alternative.`

A extensao estava instalada no ambiente (`Act/Run` v2.11.0, publicador fean-developer). O CONSUBOV executa QA local pelo `Taskfile.yml`, sem depender de Docker/`act` ou GitHub Actions hospedado. Nao atribuir os avisos a erro de codigo.

## Mudanca efetivamente feita
No Codespace CONSUBOV, painel Extensoes > Act/Run > `Mais Acoes...` ao lado de `Desabilitar` > `Desabilitar (Workspace)`; depois `Recarregar a Janela`.

Nenhum pacote, endpoint, ambiente remoto, schema, secrets ou configuracao de outro repositorio foi alterado. Esta preferencia e do workspace corrente, nao instala ou remove Docker e nao garante comportamento identico em novos Codespaces.

## Verificacao observada
Na janela recarregada, apos as extensoes ativarem, o snapshot mostrou `Nenhum Problema` com `0` erros e `0` avisos. A Central de Notificacoes mostrou `Nao ha novas notificacoes`. Os avisos antigos de Act/Run nao foram emitidos novamente no teste de abertura. O antigo indicador `O ambiente de 1 de terminal esta obsoleto` nao apareceu apos a reinicializacao da janela.

**Limites:** nao houve teste das suites Web/API/PWA nem garantia sobre futuras atualizacoes/reinstalacoes. O browser MTS havia oscilado em sessoes anteriores, mas respondeu para a operacao e verificacao atuais; nao afirmar que o servico do plugin foi reparado.

## Proximos passos
Verificar estado do repositorio antes de qualquer pull no Codespace, preservar stashes e trabalho de agentes, fazer fast-forward sem reset e executar QA local na branch ativa. Nao configurar CI remoto, Docker ou `act` apenas para suprimir notificacoes.
