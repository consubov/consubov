# HANDOFF-006 — Encapsular acesso de dados da landing page

## PRD relacionado

`PRD-006-landing-data-access.md`

## Branch

`refactor/landing-data-access`

## Estado inicial

`useLandingContent` importa diretamente `@/integrations/supabase/client` e executa a query de `landing_page_content` dentro do hook.

## Restrições

- sem redesign;
- sem alteração de conteúdo;
- sem nova regra de negócio;
- sem migrations;
- sem Supabase remoto novo;
- sem Vercel;
- sem merge sem CI.

## Plano

1. criar `features/landing/repositories/landingContentRepository.ts`;
2. mover a query para o repository;
3. manter tipos e exports públicos compatíveis;
4. adicionar teste unitário do repository;
5. rodar build/test via CI;
6. registrar validações e parar para revisão.
