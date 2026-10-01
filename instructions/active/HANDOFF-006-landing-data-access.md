# HANDOFF-006 — Encapsular acesso de dados da landing page

## PRD relacionado

`PRD-006-landing-data-access.md`

## Branch

`refactor/landing-data-access`

## Implementado

- criado `apps/web/src/features/landing/repositories/landingContentRepository.ts`;
- a consulta de `landing_page_content` saiu de `useLandingContent`;
- tipos públicos `LandingContent` e `LandingSlug` continuam exportados pelo hook;
- fallback e parsing do hook foram preservados;
- adicionados testes unitários do repository.

## Comportamento preservado

- filtro por `landing_slug`;
- dados convertidos para mapa chave/valor;
- `valor: null` vira string vazia;
- resposta sem dados continua resultando em objeto vazio;
- nenhuma chamada extra ao Supabase foi adicionada.

## Validação

Pull Request #15:

- GitHub Actions `build-and-test`: SUCCESS;
- CI executou instalação congelada, lint/typecheck da API, build do monorepo, smoke HTTP da API e testes do monorepo;
- nenhum arquivo funcional fora do slice de landing foi alterado.

## Riscos/Pendências

- outros hooks ainda acessam Supabase diretamente;
- a migração deve continuar em slices pequenos;
- hooks com cache/realtime/offline exigem PRDs próprios ou escopo explícito para preservar invariantes.

## Encerramento

Conhecimento permanente consolidado em `docs/12-web-data-access.md`.
