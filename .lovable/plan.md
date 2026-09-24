# Remover URL técnica do PDF do Pesador

## Objetivo
Garantir que o fluxo de PDF do Mais Arrobas, no perfil Pesador, mostre apenas ações apresentáveis como “Baixar PDF” e “Compartilhar PDF”, sem exibir o endereço do Supabase Storage.

## Alterações
- Rastrear o ponto exato de saída do PDF na tela de resumo e no histórico do Pesador.
- Manter a URL apenas como dado interno para buscar o arquivo.
- Substituir qualquer abertura, navegação, mensagem ou compartilhamento que exponha a URL por download/compartilhamento via arquivo local (`blob`).
- Preservar integralmente a geração e o conteúdo do PDF.
- Incrementar a versão do aplicativo.

## Validação
- Verificar a geração completa do PDF no Pesador e as ações disponíveis após a geração.
- Conferir resumo, histórico, mensagens e compartilhamento para confirmar que nenhuma URL do Supabase aparece como texto.
- Validar a compilação e os erros do aplicativo.

## Limites
- Não alterar Pecuarista, Capataz ou outros módulos.
- Não alterar a lógica de geração do PDF.
