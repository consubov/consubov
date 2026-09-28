# Exibir Cocho Cheio como comprovação de visita

## Objetivo
Mostrar o Cocho Cheio nas informações recentes do pasto, usando somente leitura dos lançamentos já sincronizados e sem alterar cálculos, sincronização ou registros existentes.

## Implementação
1. No carregamento do Mapa do Retiro, consultar diretamente `lancamentos` para os pastos exibidos, lendo apenas data, quantidade de sacos e `cocho_cheio`.
2. Manter separadas a última salga com produto e a última visita de Cocho Cheio; considerar a data efetiva do lançamento e usar a criação como fallback.
3. No campo “Última salga” do mapa, exibir o evento mais recente: data normal para salga com produto ou “DD/MM — Cocho Cheio” quando essa for a visita mais recente.
4. Na tela “Ver detalhes” do pasto, buscar os lançamentos diretamente ao abrir e mostrar “Última salga: DD/MM (N sacos)”. Mostrar “Último Cocho Cheio: DD/MM” somente quando ele for posterior à última salga com produto.
5. Não alterar nem reutilizar as views de consumo para essa exibição; consumo global, índice, status e demais números permanecem nas fontes atuais.
6. Atualizar a versão do aplicativo e validar a compilação.

## Escopo técnico
- Leitura apenas de `lancamentos`; nenhum `INSERT`, `UPDATE`, `DELETE`, migration ou view nova.
- Nenhuma mudança no fluxo do Capataz, sincronização, cálculo de consumo ou gatilhos.
- Arquivos previstos: `src/hooks/useMapaData.ts`, `src/components/mapa/PastoInfoModal.tsx`, `src/components/eventos/DetalhesLoteModal.tsx` e `src/lib/appVersion.ts`.
