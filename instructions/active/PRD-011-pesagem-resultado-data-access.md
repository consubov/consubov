# PRD-011 — Encapsular leituras do Resultado de Pesagem

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `usePesagemResultado`, sem alterar o cálculo de GMD, fallbacks ou comportamento visual.

## Escopo

### Incluído

- criar repository dedicado para:
  - buscar a pesagem atual;
  - buscar a pesagem anterior do mesmo lote;
- remover import direto do Supabase do hook;
- preservar selects, filtros, ordenação e limite;
- manter no hook toda a composição/cálculo de resultado;
- preservar logs e fallbacks;
- adicionar testes do repository;
- atualizar documentação permanente.

### Fora de escopo

- alterar fórmula de GMD;
- alterar regra de primeira pesagem;
- alterar nomes/peso/quantidade exibidos;
- alterar schema/migrations;
- adicionar cache/realtime/offline;
- criar API para pesagens;
- Vercel.

## Diretriz arquitetural

```text
consumer
  ↓
usePesagemResultado
  ↓
pesagemResultadoRepository
  ↓
Supabase client existente
```

## Contratos a preservar

### Pesagem atual

```text
from("pesagens")
select("*, pastos(nome, num_animais, retiros(fazendas(nome)))")
eq("id", pesagemId)
maybeSingle()
```

### Pesagem anterior

```text
from("pesagens")
select("media_calculada, data_pesagem")
eq("lote_id", loteId)
neq("id", pesagemId)
order("data_pesagem", { ascending: false })
limit(1)
```

## Critérios de aceite

- [ ] hook não importa Supabase;
- [ ] repository preserva exatamente as duas queries;
- [ ] cálculo e fallbacks permanecem no hook;
- [ ] testes novos passam;
- [ ] testes existentes passam;
- [ ] build passa;
- [ ] CI verde;
- [ ] nenhuma migration, conexão nova ou Vercel.
