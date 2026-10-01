# HANDOFF-006 — Fronteira de dados da Premiação Admin

## PRD

`PRD-006-admin-premiacao-data-boundary.md`

## Branch

`refactor/admin-premiacao-data-boundary`

## Estado

Início da primeira fatia da issue #5.

## Arquivo de referência atual

`apps/web/src/pages/AdminPremiacaoPage.tsx` contém uma consulta direta ao Supabase para listar fazendas ativas.

## Contrato que deve permanecer idêntico

```text
from("fazendas")
select("id, nome")
eq("ativo", true)
order("nome")
```

Se `data` não vier, a página atualmente usa lista vazia. Esse comportamento deve permanecer.

## Restrições

Sem redesign, regra nova, banco remoto novo, migrations, Vercel ou alteração de outras features.
