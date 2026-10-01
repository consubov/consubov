# Fronteiras progressivas de dados no web

## Objetivo

Reduzir acesso direto ao Supabase em páginas e componentes sem reescrever a aplicação nem mudar comportamento.

## Padrão incremental

Quando uma feature for migrada, a direção preferencial é:

```text
Page / Component
      ↓
Hook / Controller
      ↓
Service / Use case
      ↓
Repository
      ↓
Supabase client existente
```

Criar somente as camadas que possuam responsabilidade real. A migração é feita uma feature por vez e deve manter a consulta, UI, cache, offline e regras atuais.

## Primeira fatia — Premiação Admin

`AdminPremiacaoPage` deixou de acessar o cliente Supabase diretamente.

Estrutura:

```text
features/admin-premiacao/
├── hooks/
│   └── useAdminPremiacaoFazendas.ts
├── repositories/
│   └── adminPremiacaoRepository.ts
├── services/
│   └── listActiveFazendasForPremiacao.ts
└── types.ts
```

O contrato de leitura foi preservado exatamente:

```text
from("fazendas")
select("id, nome")
eq("ativo", true)
order("nome")
```

Quando `data` é ausente, o repository retorna lista vazia, igual ao comportamento anterior da página.

## Testabilidade

O service recebe um repository substituível e o hook recebe uma função de carregamento substituível. Isso permite testar regra/orquestração sem conexão remota.

O Pull Request #14 validou:

- 5 testes novos da fronteira;
- 51/51 testes web;
- 13/13 testes da API;
- build completo;
- smoke HTTP da API;
- nenhum serviço remoto novo.

## Continuidade

A issue #5 permanece aberta. Próximas páginas devem ser migradas em PRDs pequenos e independentes, começando preferencialmente por fluxos somente leitura e de menor criticidade.
