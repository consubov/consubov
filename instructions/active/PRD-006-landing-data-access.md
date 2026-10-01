# PRD-006 — Encapsular acesso de dados da landing page

## Status

`IN_PROGRESS`

## Objetivo

Dar o primeiro passo seguro da migração progressiva de acesso a dados do web, removendo o acesso direto ao Supabase de `useLandingContent` e colocando essa responsabilidade em um repository dedicado, sem alterar comportamento visual ou funcional.

## Contexto

A arquitetura permanente define o fluxo:

```text
Component
  ↓
Hook / Controller
  ↓
Use case / Service
  ↓
Repository
  ↓
Database
```

Nesta fase, o escopo é intencionalmente pequeno: apenas a leitura de `landing_page_content`.

## Escopo

### Incluído

- criar repository dedicado para `landing_page_content`;
- mover a consulta Supabase para o repository;
- preservar a interface pública de `useLandingContent`;
- preservar fallback textual e parsing JSON existentes;
- adicionar testes de regressão do repository;
- documentar o padrão para próximas migrações.

### Fora de escopo

- alterar UI;
- alterar conteúdo/landing;
- criar API para a landing;
- alterar schema/migrations;
- conectar banco novo;
- alterar autenticação;
- migrar outros hooks nesta mesma fase;
- Vercel.

## Regras

- nenhum componente deve precisar conhecer Supabase por causa desta mudança;
- `useLandingContent` não deve importar o client Supabase diretamente;
- o comportamento em ausência de dados deve continuar retornando objeto vazio;
- não inventar tratamento funcional novo para erros nesta fase;
- nenhuma chamada remota adicional deve ser criada.

## Critérios de aceite

- [ ] repository encapsula a consulta;
- [ ] hook não importa Supabase;
- [ ] API pública do hook permanece compatível;
- [ ] testes do repository passam;
- [ ] testes existentes do web passam;
- [ ] build do monorepo passa;
- [ ] nenhum arquivo funcional fora deste slice é alterado;
- [ ] CI do PR fica verde.

## Handoff

`instructions/active/HANDOFF-006-landing-data-access.md`
