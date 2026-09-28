# Substituir a Seção 4 do PDF pela previsão do banco

## Objetivo
Trocar somente a atual “SEÇÃO 4 — PREVISÃO DE ABATE” pelo resultado de `previsao_abate(fazenda_id)`, mantendo-a no mesmo lugar e sem renumerar ou alterar qualquer outra seção.

## Implementação
1. Consultar a configuração de abate da fazenda e, somente quando existir, chamar `previsao_abate` ao exportar o relatório.
2. Aplicar apenas o retiro escolhido no relatório aos resultados da função; produto e período não afetarão a previsão.
3. Entregar ao PDF os valores retornados pelo banco já ordenados por dias restantes, sem recalcular peso, GMD, dias ou data no app.
4. Substituir a tabela antiga da Seção 4 por: Pasto, Retiro, Categoria, Animais, Peso atual, Peso-alvo, GMD, Dias e Data prevista; destacar “Pronto” e incluir totais.
5. Manter cabeçalho verde, linhas zebradas, repetição do cabeçalho em novas páginas e linhas indivisíveis; reservar o espaço do rodapé.
6. Ocultar a seção sem configuração; com configuração e retorno vazio, exibir a mensagem solicitada.
7. Atualizar a versão do aplicativo, validar tipos e gerar PDFs sintéticos para inspeção visual de página única, múltiplas páginas e estado vazio.

## Arquivos
- `src/components/relatorio/ExportarRelatorioModal.tsx`
- `src/components/relatorio/RelatorioPDF.tsx`
- `src/lib/appVersion.ts`
- `roadmap.md`
