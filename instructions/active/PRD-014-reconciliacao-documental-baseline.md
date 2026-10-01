# PRD-014 — Reconciliação documental e baseline

## Status

`READY_FOR_REVIEW`

## Objetivo

Alinhar a documentação permanente ao estado consolidado em `e95a4ea`, sem alterar runtime, dependências, workflows ou comportamento da aplicação.

## Contexto

`docs/07-fundacao-monorepo.md` ainda descrevia `apps/api` como uma reserva sem runtime, embora a API Bun local, seus contratos HTTP e os contratos de segurança já estejam implementados.

Fonte de verdade externa confirmada pelo orquestrador:

- `main` remoto em `e95a4ea2cfedb5ba757f72b5de925162c6693a1e`;
- somente o PR #10 do Dependabot está aberto e não faz parte desta fase;
- issue #5 acompanha a migração progressiva de acesso a dados;
- issues #7 (Supabase/RLS/multitenancy) e #8 (Vercel) estão bloqueadas;
- limpeza de branches antigas fica para a fase final.

## Escopo

### Incluído

- corrigir a descrição desatualizada da API em `docs/07-fundacao-monorepo.md`;
- documentar Bun 1.3.12, ausência de persistência remota e limites dos contratos de segurança;
- registrar o estado de build, testes, smoke e lint raiz;
- registrar explicitamente os bloqueios de Supabase/banco remoto e Vercel.

### Fora de escopo

- qualquer arquivo de runtime em `apps/` ou `supabase/`;
- `package.json`, `bun.lock`, `turbo.json`, workflows ou dependências;
- correção do lint legado do web;
- conexão com banco remoto, migrations remotas, RLS ou Vercel;
- alteração do PR #10 ou limpeza de branches;
- implementação da issue #5.

## Critérios de aceite

- [x] documentação permanente atualizada sem reescrever a arquitetura;
- [x] nenhum arquivo de runtime/configuração alterado;
- [x] whitespace validado;
- [x] build passa;
- [x] 80 testes passam;
- [x] smoke HTTP local passa;
- [x] nenhum secret adicionado;
- [ ] revisão e aceite do orquestrador.
