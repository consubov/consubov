# PRD-008 — Encapsular acesso de dados da Premiação Admin

## Status

`IN_PROGRESS`

## Objetivo

Continuar a migração progressiva de acesso a dados do web removendo o acesso direto ao Supabase de `AdminPremiacaoPage`, sem alterar UI, consulta, regras de negócio ou comportamento existente.

## Escopo

### Incluído

- criar repository dedicado para listar fazendas ativas usadas na premiação;
- criar hook dedicado para carregar essas fazendas;
- remover import do Supabase da página;
- preservar a consulta atual:
  - tabela `fazendas`;
  - `select("id, nome")`;
  - `eq("ativo", true)`;
  - `order("nome")`;
- preservar fallback para lista vazia;
- adicionar testes do repository e hook;
- atualizar documentação permanente.

### Fora de escopo

- alterar `PremiacaoSemestral`;
- alterar UI/seletores;
- alterar schema/migrations;
- criar API para a premiação;
- alterar autenticação/roles;
- conectar serviço remoto novo;
- Vercel.

## Diretriz arquitetural

Fluxo desta fase:

```text
AdminPremiacaoPage
  ↓
useAdminPremiacaoFazendas
  ↓
adminPremiacaoRepository
  ↓
Supabase client existente
```

Não criar service/use case nesta fase porque não existe regra de negócio entre hook e repository.

## Critérios de aceite

- [ ] página não importa Supabase;
- [ ] repository preserva exatamente a consulta existente;
- [ ] hook entrega lista vazia inicialmente e depois dados carregados;
- [ ] ausência de `data` continua resultando em lista vazia;
- [ ] testes existentes e novos passam;
- [ ] build passa;
- [ ] CI verde;
- [ ] nenhuma mudança visual/funcional fora deste slice.

## Handoff

`instructions/active/HANDOFF-008-admin-premiacao-data-access.md`
