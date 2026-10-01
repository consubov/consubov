# PRD-010 — Encapsular leituras de Eventos do Lote

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `useEventosLote.ts`, sem alterar contratos, ordenações ou comportamento dos hooks.

## Escopo

### Incluído

- criar repository dedicado para:
  - listar eventos do lote;
  - buscar última pesagem;
  - buscar último evento sanitário;
- remover import direto do Supabase de `useEventosLote.ts`;
- preservar selects, filtros, ordenações e limites;
- preservar `refreshKey` como gatilho de recarga;
- preservar `calcCarenciaDias`;
- adicionar testes do repository;
- atualizar documentação permanente.

### Fora de escopo

- alterar UI;
- alterar schema/migrations;
- alterar regras sanitárias;
- alterar cálculo de carência;
- adicionar cache/realtime/offline;
- criar API para eventos;
- Vercel.

## Diretriz arquitetural

```text
consumer
  ↓
hooks de eventos/pesagem/sanitário
  ↓
eventosLoteRepository
  ↓
Supabase client existente
```

## Contratos a preservar

### Eventos
```text
from("eventos_lote")
select("*")
eq("lote_id", loteId)
order("data_evento", { ascending: false })
```

### Última pesagem
```text
from("pesagens")
select("*")
eq("lote_id", loteId)
order("data_pesagem", { ascending: false })
limit(1)
maybeSingle()
```

### Último sanitário
```text
from("eventos_sanitarios")
select("*")
eq("lote_id", loteId)
order("data_aplicacao", { ascending: false })
limit(1)
maybeSingle()
```

## Critérios de aceite

- [ ] hook não importa Supabase;
- [ ] repository preserva exatamente as três consultas;
- [ ] tipos públicos permanecem compatíveis;
- [ ] `calcCarenciaDias` permanece inalterado;
- [ ] testes novos passam;
- [ ] testes existentes passam;
- [ ] build passa;
- [ ] CI verde;
- [ ] nenhuma migration, conexão nova ou Vercel.
