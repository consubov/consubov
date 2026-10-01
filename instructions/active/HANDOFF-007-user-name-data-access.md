# HANDOFF-007 — Encapsular busca de nome do usuário

## Branch

`refactor/user-name-data-access`

## Estado inicial

`useNomeUsuario` acessa diretamente o Supabase e percorre tabelas de papel até encontrar um `nome` válido.

## Restrições

- não alterar auth;
- não alterar regras de papel;
- não alterar UI;
- não alterar banco/migrations;
- não conectar Vercel.

## Plano

1. criar repository de nome do usuário;
2. mover queries para o repository;
3. preservar a API do hook;
4. adicionar testes;
5. validar em CI;
6. consolidar em docs e encerrar instrução.
