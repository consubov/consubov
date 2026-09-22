# Fase 2 — PDF filtrado por produto e gráfico Real × Esperado

## Objetivo
Fazer o Relatório de Consumo aberto pelo Painel do Gerente herdar o produto já selecionado no painel e adicionar uma página própria com o gráfico de linhas “Consumo por Pasto - Real x Esperado”.

## Implementação

1. **Levar o contexto atual do painel ao relatório**
   - Passar ao modal a fazenda, o retiro, o mês/ano e o produto atualmente selecionados no Painel do Gerente.
   - Não criar nenhum filtro de produto dentro do modal.
   - Preservar “Todos os produtos” como ausência de restrição.

2. **Filtrar os dados antes de montar o PDF**
   - Identificar o produto efetivo de cada pasto pela mesma prioridade da Fase 1: ocupação ativa, depois produto do pasto e, por último, produto do retiro.
   - Quando houver um produto selecionado, manter somente os pastos desse produto e restringir lançamentos, métricas por categoria e todas as seções derivadas ao mesmo conjunto.
   - Manter as fórmulas atuais de Score, custos, animais, eficiência e pastos na meta; apenas reduzir o conjunto de pastos usado nos cálculos.
   - Com “Todos os produtos”, preservar exatamente o comportamento atual.

3. **Adicionar os dados Real e Esperado por pasto**
   - Incluir no modelo entregue ao PDF o consumo esperado já calculado com produto, categoria e peso do próprio pasto.
   - Usar somente pastos com valores Real e Esperado válidos para o gráfico, sem retirar os demais das outras seções do relatório.

4. **Recriar o gráfico em react-pdf**
   - Criar uma página A4 exclusiva usando elementos nativos de `@react-pdf/renderer` (`Svg`, `Line`, `Circle`, `Rect` e `Text`).
   - Reproduzir as duas séries, pontos, linhas-guia, valores com fundo branco, letras no eixo X, legenda das séries e tabela letra→pasto.
   - Reduzir a fonte dos valores quando houver mais de 8 pastos.
   - Usar 2 colunas na tabela de referência até 16 pastos e 3 colunas acima disso.
   - Se toda a referência não couber na página do gráfico, continuar automaticamente em uma ou mais páginas exclusivas de referência, sem sobreposição.
   - Inserir essas páginas após as seções atuais, usando exatamente os pastos já filtrados.

5. **Versão e validação**
   - Atualizar a versão do aplicativo para `1.81.0`.
   - Validar os tipos e gerar um PDF de teste com dados sintéticos, conferindo página exclusiva, linhas, rótulos e quebra da referência em grande volume.

## Arquivos previstos
- `src/pages/GerenteDashboard.tsx`
- `src/components/relatorio/ExportarRelatorioModal.tsx`
- `src/components/relatorio/RelatorioPDF.tsx`
- `src/lib/appVersion.ts`

`src/lib/pdfLineCharts.ts` permanecerá inalterado e servirá somente como referência visual.
