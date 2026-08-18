# Corrigir fluxo e Histórico da Conferência Admin QR

## Diagnóstico confirmado

- O estado `visita` está sendo usado como sinônimo de “usuário clicou em Registrar Conferência”. Porém, ao salvar o primeiro pasto, `handleSalvarPasto` chama `garantirVisita()` e cria a visita automaticamente. Por isso tópicos/assinaturas são montados cedo e o botão explícito de registro desaparece.
- Tópicos e assinaturas hoje dependem apenas de `isAdmin && visita`; falta exigir simultaneamente a intenção explícita de registro e `registros.length > 0`.
- O Histórico só oferece “Ver/Baixar PDF” e “Excluir”; não existe ação para carregar a conferência finalizada no fluxo principal. Assim, os controles de edição nunca recebem seus dados.
- O nome no Histórico depende apenas do relacionamento `fazendas` ou de `fazenda_nome_override`; conferências antigas sem esses campos não usam o nome já gravado em `visita_pastos` como fallback.

## Implementação

### 1. Separar intenção de registro da existência técnica da visita
- Em `ConferenciaPage.tsx`, criar estado explícito para indicar que “Registrar Conferência” foi acionado.
- Manter esse estado independente de `visita`, evitando que a criação técnica feita ao salvar um pasto libere tópicos/assinaturas por engano.
- Renderizar `VisitaTopicosSection` e `ConferenciaAssinaturasSection` somente quando todas forem verdadeiras: Admin, registro formal confirmado, visita carregada e ao menos um pasto registrado.
- Manter os componentes totalmente desmontados antes disso (render condicional, sem ocultação CSS).
- Ajustar o botão principal para o texto exato **“Escanear QR Code”**.

### 2. Abrir e editar conferência finalizada pelo Histórico
- Adicionar uma ação **Editar** em cada card do Histórico.
- Ao acioná-la, carregar a visita finalizada selecionada e seus pastos, marcar o fluxo como conferência formal e voltar à tela principal com os controles existentes de pastos, tópicos e assinaturas.
- Preservar a regra atual de invalidação: a primeira alteração muda `finalizada` para `revisao`, limpa `pdf_url`/PDF local e disponibiliza a geração de um novo PDF.
- Resetar referências de carregamento de tópicos/assinaturas ao alternar entre conferências para que o carregamento inicial não seja confundido com edição.

### 3. Garantir nome da fazenda no Histórico
- Em `conferenciaAdminVisita.ts`, complementar a listagem com fallback para `visita_pastos.fazenda_nome` quando `fazendas.nome` e `fazenda_nome_override` estiverem vazios.
- Manter o card com nome em destaque, data/tipo abaixo e status ao lado.
- Tratar e propagar erros das consultas em vez de converter falha silenciosamente em histórico vazio.

### 4. Versão e validação
- Incrementar `APP_VERSION` conforme a regra do projeto.
- Validar no preview que, na entrada, tópicos/assinaturas não existem no DOM; após um pasto registrado e o clique explícito, ambos são montados.
- Validar um item finalizado do Histórico: nome da fazenda visível, abertura em modo de edição, edição de pasto invalidando o PDF anterior e botão para gerar novo PDF disponível.

## Arquivos restritos
- `src/pages/ConferenciaPage.tsx`
- `src/lib/conferenciaAdminVisita.ts`
- `src/lib/appVersion.ts` (incremento obrigatório de versão)

Nenhum arquivo do Consultor/Relatto ou de outros módulos será alterado; componentes compartilhados existentes serão apenas consumidos pela Conferência Admin.
