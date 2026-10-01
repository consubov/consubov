# PRD-010 — Encapsular leitura do Painel Mãe

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `usePainelMae`, sem alterar o contrato da RPC, o mapeamento dos dados ou o comportamento do hook.

## Escopo

### Incluído

- criar repository dedicado para a RPC `get_painel_mae`;
- remover import do Supabase de `usePainelMae`;
- preservar exatamente os parâmetros:
  - `p_fazenda_id`;
  - `p_retiro_id`;
  - `p_mes`;
  - `p_ano`;
- manter o mapeamento numérico e defaults no hook;
- preservar fallback `empty`;
- preservar logging e loading;
- adicionar testes do repository.

### Fora de escopo

- alterar a RPC;
- alterar schema/migrations;
- alterar fórmulas/mapeamentos;
- alterar UI;
- adicionar cache/realtime/offline;
- criar endpoint API;
- Vercel.

## Diretriz arquitetural

```text
consumer
  ↓
usePainelMae
  ↓
painelMaeRepository
  ↓
Supabase RPC existente
```

## Critérios de aceite

- [ ] `usePainelMae` não importa Supabase;
- [ ] repository chama exatamente `get_painel_mae` com os quatro parâmetros atuais;
- [ ] mapeamento e fallback permanecem no hook;
- [ ] testes novos passam;
- [ ] testes existentes passam;
- [ ] build passa;
- [ ] CI verde;
- [ ] nenhuma conexão nova/migration/Vercel.
