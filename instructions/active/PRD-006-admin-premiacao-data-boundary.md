# PRD-006 — Fronteira de dados da Premiação Admin

## Status

`IN_PROGRESS`

## Objetivo

Executar a primeira migração incremental da issue #5, retirando o acesso direto ao Supabase da página `AdminPremiacaoPage` sem alterar UI, consulta, regras ou comportamento.

## Escopo

Criar uma fronteira pequena e explícita:

```text
AdminPremiacaoPage
  -> hook
  -> service
  -> repository
  -> Supabase client existente
```

## Regras

- preservar exatamente a consulta atual: tabela `fazendas`, colunas `id, nome`, `ativo = true`, ordenação por `nome`;
- preservar fallback atual para lista vazia quando não houver dados;
- não mudar textos, layout ou seleção de fazenda;
- não alterar `PremiacaoSemestral`;
- não conectar serviço novo;
- não tocar em API, banco, migrations ou Vercel;
- não criar `packages/`.

## Testes

- repository executa a consulta com o mesmo contrato;
- repository retorna lista vazia quando `data` é nulo;
- página não importa mais o cliente Supabase diretamente;
- suíte completa existente continua verde.

## Critérios de aceite

- [ ] `AdminPremiacaoPage` não importa Supabase;
- [ ] acesso a dados está isolado em repository;
- [ ] hook controla carregamento dos dados da feature;
- [ ] service é independente da UI;
- [ ] UI renderizada não muda;
- [ ] CI completo verde;
- [ ] nenhuma outra feature é refatorada nesta fase.

## Execução

Branch `refactor/admin-premiacao-data-boundary`.

PR para `main`; merge somente após CI e revisão.
