# PRD-007 — Encapsular busca de nome do usuário

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `useNomeUsuario`, sem alterar autenticação, regras de papel ou comportamento visual.

## Escopo

### Incluído

- criar repository dedicado para buscar o nome do usuário nas tabelas de papel;
- mover as queries Supabase para o repository;
- preservar a ordem das tabelas fornecida pelo hook;
- preservar a regra de nunca usar e-mail como nome;
- preservar fallback textual;
- adicionar testes do repository.

### Fora de escopo

- alterar `useAuth`;
- alterar login/sessão;
- alterar roles/permissões;
- alterar schema/migrations;
- conectar serviços remotos novos;
- Vercel;
- refatorar outros hooks nesta fase.

## Critérios de aceite

- [ ] `useNomeUsuario` não importa Supabase;
- [ ] repository encapsula `from/select/eq/maybeSingle`;
- [ ] sequência de tabelas é preservada;
- [ ] nome contendo `@` continua rejeitado;
- [ ] fallback permanece igual;
- [ ] testes passam;
- [ ] build passa;
- [ ] CI verde.
