# INC-011 — Avisos de atualização PWA repetidos
Data: 2026-10-29 | CONSUBOV Fazendas 2.0.0 | PR #77 é origem da proteção anti-downgrade; esta mudança a incorpora ao SHA real de produção.

## Diagnóstico comprovado no código
- O UpdateBanner em produção exibia atualização para qualquer diferença em `/version.json`, inclusive build antigo.
- O Service Worker emitia aviso por evento de worker waiting e guardava versão notificada somente em sessionStorage, perdendo a deduplicação após encerrar o PWA.
- Era possível anunciar update via metadata antes do novo worker terminar a instalação, causando um botão inoperante e nova oferta a cada tentativa.
- Sem inspeção do device, não é comprovado se todos os avisos vieram de SW ou de publicações concorrentes.

## Correção
- Reaproveita classificação SemVer+timestamp e checagem de origem do worker da PR #77, em branch criado do último deployment de produção febaf94f.
- Banner só aparece quando a publicação é mais nova E o Service Worker dessa exata publicação está waiting/validado.
- Não notifica controlador que mudou sozinho como 'nova atualização pendente'; falha de ativação fecha a oferta inexecutável.
- Notificações do sistema persistem versão deduplicada em localStorage (somente build ID), uma vez por build entre aberturas, mantendo o banner e botão manual como alternativas.
- Nenhum processo automático apaga IndexedDB, filas locais, fotos, Service Worker ou caches.

## Critérios e QA
- Testes unitários SemVer / downgrade / versão igual / erro metadata / novo build / dedupe entre reinícios no publishedUpdate.test.ts.
- Validar preview: build READY, versão 2.0.0, manifesto e instalador 200, JS/CSS atuais 200.
- Validar produção por SHA e smoke HTTP + dispositivo instalado (clique em Atualizar, retorno do segundo plano, fechar/abrir e operação offline crítica).
- Vitest/CI completo e teste real do aparelho são gates separados; não alegar os que não forem executados.
- PR #77 permanece DRAFT e deve ser reconciliada com este hotfix para evitar dupla implementação.
- Não implantar main 1.155.0 nem divulgar downgrade; F12 segurança global segue NO-GO.