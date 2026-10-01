# PRD-005 — Regressão offline e sincronização

## Status

`IN_PROGRESS`

## Objetivo

Ampliar a cobertura automatizada dos invariantes offline-first já existentes sem alterar regras de negócio, UI ou integrar serviços remotos.

## Origem

Issue #6 — Ampliar regressão offline e sincronização.

## Restrições

- não conectar Supabase remoto;
- não conectar banco;
- não executar migrations;
- não configurar Vercel;
- não alterar comportamento funcional;
- não redesenhar;
- não aplicar `screenCache` ao Capataz;
- não alterar a regra de atualização do service worker;
- testes devem usar IndexedDB/local mocks e fixtures locais.

## Cobertura desta fase

- reenvio idempotente de mutações locais;
- pendências permanecem no aparelho enquanto não confirmadas;
- retry manual revive mutações que atingiram erro;
- recuperação de conflito de código de lote permanece protegida;
- alvos de recálculo GMD offline são coletados corretamente;
- atualização da aplicação não recarrega automaticamente após background/fora da janela de cold start;
- refresh de Gerente/Admin ao retomar só ocorre após 5 minutos;
- código Capataz continua sem importar `screenCache`.

## Estratégia

Priorizar testes comportamentais. Onde o módulo possui side effects globais difíceis de isolar sem reescrita, usar teste estrutural focado no invariante existente, sem refatorar produção apenas para facilitar teste.

## Critérios de aceite

- [ ] novos testes passam;
- [ ] 36 testes web existentes continuam passando;
- [ ] API continua verde;
- [ ] CI completo passa;
- [ ] nenhum acesso remoto é feito nos testes;
- [ ] nenhuma UI é alterada;
- [ ] regras offline existentes permanecem intactas;
- [ ] documentação permanente registra os invariantes cobertos.

## Execução

Branch `test/offline-sync-regression`.

Abrir PR para `main` e aguardar CI/revisão antes do merge.
