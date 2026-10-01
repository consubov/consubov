# HANDOFF-004 — Contratos de autenticação, autorização e tenancy

## PRD

`PRD-004-auth-tenancy-contracts.md`

## Branch

`feat/auth-tenancy-contracts`

## Estado

Contratos implementados. Aguardando CI e revisão.

## Implementado

- tipos validados de tenant, principal e escopo;
- contexto autenticado independente de HTTP/provider;
- principal `user` e `integration`;
- autorização tenant-first;
- falhas estruturadas `TENANT_MISMATCH` e `MISSING_SCOPE`;
- porta `IdentityVerifierPort` sem adapter remoto;
- testes unitários de isolamento e escopos;
- documentação permanente.

## Decisões

- nenhum `packages/` criado: ainda há somente consumidor na API;
- nenhum catálogo fechado de scopes criado;
- formato de scope é `recurso:acao`;
- o contrato de contexto não autentica credenciais;
- tenant é comparado antes de qualquer escopo;
- mensagens de negação não revelam tenant alvo;
- credenciais futuras distinguem bearer de usuário e API key de integração.

## Restrições preservadas

Sem Supabase remoto, banco, Vercel, JWT real, API key real ou alteração do web.

## Validação

O PR deve executar CI completo: lint/typecheck da API, build, smoke HTTP da fundação e testes de API/web.
