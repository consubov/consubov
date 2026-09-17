# Controle manual do rótulo no Mapa

## Objetivo
Permitir que o administrador ajuste a posição e a rotação do conjunto pin + código/contagem durante a edição do mapa, mantendo intacto o comportamento automático dos pastos sem ajuste.

## Implementação
- Carregar `label_offset_x`, `label_offset_y` e `label_rotation` junto aos dados de cada pasto.
- Aplicar os valores salvos ao conjunto completo do rótulo no mapa normal, sem mudar seu cálculo automático, tamanho, cores ou conteúdo.
- No editor, desenhar o mesmo conjunto de rótulo sobre cada polígono.
- Ao selecionar um pasto, permitir arrastar seu rótulo; o deslocamento será calculado em relação ao ponto automático atual.
- Exibir um campo numérico de rotação apenas para o pasto selecionado.
- Salvar os três valores nas colunas existentes de `pastos` ao usar “Salvar Mapa”, junto ao fluxo atual.
- Preservar vínculo de pasto, edição dos vértices, linhas, elementos e demais recursos atuais.

## Validação
- Confirmar que pastos sem valores salvos permanecem exatamente na posição automática atual.
- Confirmar que posição e rotação persistem após salvar e reabrir o mapa.
- Verificar interação por mouse e toque e validar os tipos do projeto.
