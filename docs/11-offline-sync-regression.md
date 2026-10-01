# Regressão offline e sincronização

## Objetivo

Proteger os invariantes offline-first existentes antes de refatorações de acesso a dados ou novas integrações.

## Cobertura adicionada

### Fila de mutações do Consultor

Testes com IndexedDB local validam:

- reenvios do mesmo registro são mesclados em uma única mutação pendente;
- excluir um registro cujo insert ainda não foi confirmado cancela a operação local;
- retry manual revive mutações em erro, zera tentativas/deferimentos e preserva o patch local.

Nenhum desses testes acessa Supabase remoto.

### Mais Arrobas e GMD

A suíte valida:

- coleta dos IDs de pesos identificados que precisarão de reconciliação de GMD;
- coleta somente das pesagens de lote finalizadas;
- deduplicação de alvos;
- presença do upsert idempotente por UUID;
- recuperação de conflito de código de lote mantendo o registro/UUID e trocando apenas o código.

### Cache Gerente/Admin

A suíte valida:

- chaves de cache mudam quando os filtros mudam;
- retorno do segundo plano antes de 5 minutos não dispara refresh;
- retorno após 5 minutos dispara refresh;
- arquivos identificados como Capataz não importam `screenCache`.

### Atualização da aplicação

Um teste estrutural protege a regra crítica do service worker:

- cold start dura 15 segundos;
- ir para segundo plano encerra a possibilidade de auto-reload;
- fora do cold start, atualização detectada apenas notifica o usuário;
- reload posterior depende de ação explícita do usuário ou das regras já existentes.

O teste é estrutural porque `swRegistration.ts` registra efeitos globais de Service Worker ao carregar. Isso evita reescrever o runtime apenas para testabilidade.

## Resultado

No Pull Request #13:

- API: 13/13 testes;
- web: 46/46 testes em 13 arquivos;
- 10 novos testes web nesta fase;
- build do monorepo: verde;
- lint/typecheck da API: verde;
- smoke HTTP da API: verde.

Mensagens de stderr dos testes existentes de fotos offline continuam aparecendo como parte dos cenários de arquivo inválido, mas não causam falha.

## Regra

Mudanças futuras em filas offline, GMD, service worker ou cache de telas devem manter esta suíte verde ou atualizar explicitamente o contrato por PRD.
