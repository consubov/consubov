# PRD-009 — Encapsular leitura de Pastos do Retiro

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `usePastosRetiro`, sem alterar regras de composição, fontes de dados ou resultado do hook.

## Escopo

### Incluído

- criar repository dedicado para as três leituras usadas pelo hook;
- remover import do Supabase de `usePastosRetiro`;
- preservar as fontes:
  - `pastos`;
  - `view_painel_mae_pasto_atual`;
  - `view_painel_mae_pasto`;
- preservar filtros, selects e ordenação;
- manter no hook a composição/mapeamento dos dados;
- preservar logs de erro, loading e fallback;
- adicionar testes do repository.

### Fora de escopo

- alterar fórmulas/mapeamentos;
- alterar `PastoRetiroItem`;
- alterar UI;
- alterar schema/views/migrations;
- adicionar cache/realtime/offline;
- criar API para esse fluxo;
- Vercel.

## Diretriz arquitetural

```text
consumer
  ↓
usePastosRetiro
  ↓
pastosRetiroRepository
  ↓
Supabase client existente
```

A regra de composição entre as três fontes continua no hook nesta fase.

## Critérios de aceite

- [ ] `usePastosRetiro` não importa Supabase;
- [ ] repository executa exatamente as três queries existentes;
- [ ] hook preserva composição e valores default;
- [ ] testes novos passam;
- [ ] testes existentes passam;
- [ ] build passa;
- [ ] CI verde;
- [ ] nenhuma conexão nova/migration/Vercel.
