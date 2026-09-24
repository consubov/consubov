# Fase A — Cadastros local-first no Mais Arrobas

## Objetivo
Estender a fila local já usada pelos pesos para que Cliente, Fazenda, Lote, Categoria personalizada e a pesagem inicial sejam criados imediatamente no aparelho e sincronizados em segundo plano, sem alterar os fluxos existentes de pesos, retomada, finalização ou PDF.

## Implementação
- Gerar UUID no aparelho para cada novo cadastro e para a pesagem inicial.
- Enfileirar os registros na ordem de dependência: cadastro principal, categoria opcional, lote/pesagem e configurações filhas.
- Reutilizar o envio FIFO, retry e `upsert` idempotente da fila atual, preservando o comportamento das operações de pesos.
- Fazer as telas incorporarem imediatamente o registro criado no estado local e avançarem sem esperar resposta do servidor.
- Permitir que telas de destino encontrem os registros recém-criados combinando dados do servidor com inserts ainda pendentes na fila.
- Preparar o cálculo do código 001–999 para combinar códigos carregados do servidor com lotes pendentes no aparelho.
- Aplicar o mesmo padrão aos pontos equivalentes de criação dentro do fluxo de apartação, somente onde ele cria categoria, lote ou pesagem inicial.
- Incrementar a versão do aplicativo.

## Limites preservados
- Não criar botão Modo Offline, cache completo ou sincronização manual; isso permanece para a Fase B.
- Não modificar a fila/operações de pesos, retomada de sessão, Finalizar offline ou Gerar PDF.
- Não alterar Capataz nem outros módulos do Consubov.
- Edição e exclusão de cadastros permanecem como estão.

## Validação
- Verificação de tipos do aplicativo.
- Testes focados na composição servidor + pendentes e na escolha de código sem colisão.
- Conferência de que a navegação usa o UUID local imediatamente e de que reenvios mantêm um único registro.
