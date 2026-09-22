# Corrigir gráfico Real x Esperado por retiro

## Objetivo
Gerar páginas de gráfico independentes para cada retiro, mantendo o restante do PDF e o filtro de produto exatamente como estão.

## Implementação
- Agrupar os pastos válidos pelos retiros já presentes nos dados filtrados do relatório.
- Reiniciar as letras em cada retiro e limitar cada página a no máximo 18 pastos.
- Criar uma página exclusiva para cada bloco do retiro, com título no formato `Nome do Retiro — Real x Esperado (parte/total)`.
- Mostrar em cada página somente o gráfico e a tabela de referência daquele bloco; eliminar páginas separadas de continuação da tabela.
- Manter os cálculos, valores, cores, filtro de produto e demais seções do PDF inalterados.

## Validação
- Verificar os tipos do projeto.
- Gerar um PDF sintético com vários retiros e um deles acima do limite por página.
- Inspecionar todas as páginas renderizadas para confirmar separação por retiro, paginação correta, ausência de sobreposição e referências completas.
- Incrementar a versão do aplicativo conforme a regra do projeto.

## Detalhes técnicos
A mudança ficará restrita ao componente `RealEsperadoPages` do PDF e à versão do aplicativo. O arquivo do gráfico do Relatto não será alterado.
