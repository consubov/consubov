# HANDOFF-002 — GitHub Free e ambiente Codespaces

## PRD relacionado

`PRD-002-github-codespaces.md`

## Estado atual

Branch: `chore/github-codespaces-foundation`.

A fase começou a partir da `main` após o merge da fundação do monorepo.

## Restrições obrigatórias

- não conectar banco de dados/Supabase remoto;
- não configurar Vercel;
- não alterar UI;
- não alterar regras de negócio;
- não tocar em migrations ou dados remotos;
- não fazer merge direto sem CI/revisão.

## Plano

1. criar devcontainer mínimo e reproduzível;
2. ajustar CI para branches/PRs atuais sem referência à branch antiga;
3. adicionar templates de PR/issues;
4. configurar atualizações de GitHub Actions;
5. documentar fluxo e limitações do GitHub Free privado;
6. abrir PR e aguardar CI;
7. após aceite, consolidar conhecimento em `docs/` e remover PRD/handoff.

## Validações esperadas

- `bun install --frozen-lockfile`;
- `bun run build`;
- `bun run test`;
- inspeção estática garantindo ausência de secrets e integrações remotas novas.
