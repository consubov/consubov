# PRD-004 — Contratos de autenticação, autorização e tenancy

## Status

`IN_PROGRESS`

## Objetivo

Definir contratos locais e testáveis para identidade, autorização por tenant e escopos antes de qualquer integração com banco, Supabase ou provedor de identidade.

## Origem

Issue #4 — Contratos de autenticação, autorização e tenancy.

## Restrições

- não conectar Supabase remoto;
- não conectar banco;
- não implementar login/token real;
- não configurar Vercel;
- não alterar `apps/web`;
- não criar endpoint de domínio;
- não inventar papéis, permissões ou regras de negócio não documentadas;
- não criar `packages/` enquanto o código for usado apenas pela API.

## Escopo

### Incluído

- tipos explícitos para tenant, principal e escopo;
- validação de identificadores e escopos em fronteiras locais;
- contexto autenticado independente de HTTP;
- autorização tenant-first;
- erro/resultado estruturado para acesso negado;
- portas para verificação futura de credenciais sem implementação remota;
- testes unitários de isolamento entre tenants e escopos;
- documentação permanente.

### Fora de escopo

- JWT real;
- API keys reais;
- sessão de usuário;
- RBAC persistido;
- RLS;
- queries;
- migrations;
- integração com Supabase Auth;
- endpoints protegidos.

## Regras

1. Identidade verificada deve carregar tenant explicitamente.
2. Recursos de outro tenant devem ser negados antes de considerar escopos.
3. Escopos são strings namespaced no formato `recurso:acao`; a fase não fixa catálogo completo.
4. O contrato deve aceitar principal de usuário e de integração sem reutilizar senha de usuário.
5. Portas não devem conhecer Supabase nem banco.
6. Falhas de autorização não devem expor identificadores sensíveis em mensagens.

## Critérios de aceite

- [ ] contratos implementados em `apps/api/src/security/`;
- [ ] nenhum pacote vazio criado;
- [ ] nenhum arquivo funcional do web alterado;
- [ ] testes cobrem isolamento cross-tenant;
- [ ] testes cobrem escopo ausente;
- [ ] testes cobrem usuário e integração;
- [ ] API foundation continua com build/test/smoke verdes;
- [ ] documentação permanente atualizada;
- [ ] CI verde.

## Execução

Branch: `feat/auth-tenancy-contracts`.

Abrir PR para `main` e não mergear antes de CI e revisão.
