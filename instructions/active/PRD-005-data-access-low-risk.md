# PRD-005 — Migração de acesso a dados de baixo risco

## Status

`IN_PROGRESS — aguardando revisão`

## Objetivo

Remover o acesso direto ao client Supabase de até três páginas com consultas
simples e somente leitura, sem alterar sua API, interface ou comportamento.

## Contexto

A fase 2 continua a migração progressiva descrita em
`docs/12-web-data-access.md`. O snapshot de partida é
`31a2ccbfecbb2568dd5d720d46d83feb98800bdd`, associado à issue #5.

## Escopo

### Incluído

- atalho de seleção de fazenda por retiro em `GerenteProdutosPage`;
- listagem de auditoria em `SyncVetAuditoriaPage`;
- listagem de trajetos em `SyncVetTrajetosPage`;
- repositories específicos e testes dos contratos das queries e fallbacks;
- atualização da documentação permanente de acesso a dados.

### Fora de escopo

- banco remoto, migrations, Supabase/RLS e Vercel;
- UI, regras de negócio, auth/RBAC/tenancy, escrita/CRUD e uploads;
- cache, IndexedDB, realtime, filas, service worker e offline/sync;
- hooks explicitamente bloqueados e PR #10.

## Requisitos

- [x] manter tabelas, selects, filtros, ordens, limites e `maybeSingle`;
- [x] manter os fallbacks atuais de dados ausentes;
- [x] manter filtros de empresa, usuário, gerente e fazenda sem ampliação;
- [x] páginas selecionadas não importam mais o client Supabase;
- [x] não introduzir service intermediário sem regra de negócio.

## Restrições

- preservar comportamento e visual existentes;
- não introduzir regra de negócio ou nova permissão;
- não conectar serviços remotos nem usar secrets reais;
- manter este PRD e o handoff até o aceite do orquestrador.

## Plano sugerido

1. Inventariar e classificar imports diretos.
2. Extrair somente os três candidatos seguros para repositories.
3. Testar contratos e fallbacks.
4. Atualizar documentação e executar validações locais.

## Critérios de aceite

- [x] build passa;
- [x] suíte de testes passa;
- [x] smoke local da API passa;
- [x] regressões de contrato cobertas por testes;
- [x] documentação permanente atualizada;
- [ ] revisão do orquestrador concluída.

## Validação manual

Confirmar que as páginas continuam exibindo os mesmos estados de carregamento,
listas vazias e dados, sem alteração visual.

## Riscos

- os dois slices SyncVet recebem identificadores já definidos pelo fluxo de auth;
  os repositories não derivam identidade e preservam todos os filtros existentes;
- os testes são contratuais e não acessam banco remoto.

## Handoff

Arquivo: `HANDOFF-005-data-access-low-risk.md`
