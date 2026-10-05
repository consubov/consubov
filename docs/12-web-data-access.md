# Migração progressiva de acesso a dados do web

## Objetivo

Reduzir o acoplamento direto entre hooks/componentes React e o client Supabase sem alterar comportamento funcional.

## Padrão

```text
Component / Page
  ↓
Hook / Controller
  ↓
Repository
  ↓
Supabase client
```

Services/use cases são introduzidos somente quando houver regra de negócio real entre o hook e o repository.

## Regras

- migrar uma feature por vez;
- preservar a interface pública do hook sempre que possível;
- preservar cache, realtime e offline existentes;
- não alterar regras de negócio durante a extração;
- não criar repositories vazios ou genéricos;
- não criar service/use case que apenas delega ao repository;
- testes devem cobrir o contrato do repository e regressões críticas do hook quando aplicável.

## Slices concluídos

### Landing page

`useLandingContent` deixou de importar o client Supabase diretamente.

Repository:

```text
apps/web/src/features/landing/repositories/landingContentRepository.ts
```

Semântica preservada: filtro por `landing_slug`, mapa chave/valor, valor nulo como string vazia e objeto vazio quando não há dados.

### Nome do usuário

`useNomeUsuario` deixou de importar o client Supabase diretamente.

Repository:

```text
apps/web/src/features/users/repositories/userNameRepository.ts
```

Semântica preservada: ordem das tabelas, primeiro nome válido, rejeição de valores com `@` e fallback por metadata/texto.

### Premiação Admin

`AdminPremiacaoPage` deixou de consultar Supabase diretamente.

```text
AdminPremiacaoPage
  ↓
useAdminPremiacaoFazendas
  ↓
adminPremiacaoRepository
  ↓
Supabase client
```

Consulta preservada: `fazendas`, `id, nome`, `ativo = true` e ordenação por `nome`. Ausência de dados continua resultando em lista vazia.

### Pastos do Retiro

`usePastosRetiro` deixou de acessar Supabase diretamente.

O repository concentra as leituras de `pastos`, `view_painel_mae_pasto_atual` e `view_painel_mae_pasto`. A composição, somas, defaults, logs e fallback continuam no hook.

### Eventos do Lote

`useEventosLote.ts` deixou de acessar Supabase diretamente.

O repository concentra leituras de `eventos_lote`, `pesagens` e `eventos_sanitarios`, preservando ordenação, limites, `maybeSingle`, `refreshKey`, cálculo de carência e fallbacks.

### Painel Mãe

`usePainelMae` deixou de acessar Supabase diretamente.

A chamada da RPC agora vive em:

```text
apps/web/src/features/painel/repositories/painelMaeRepository.ts
```

Contrato preservado:

```text
rpc("get_painel_mae", {
  p_fazenda_id,
  p_retiro_id,
  p_mes,
  p_ano
})
```

Semântica preservada:

- `p_retiro_id = null` continua agregando a fazenda inteira;
- erro da RPC continua acionando o fallback existente;
- mapeamento numérico continua no hook;
- campos ausentes ou inválidos continuam caindo para zero;
- ausência de linha continua usando o objeto vazio existente.

### Resultado de Pesagem

`usePesagemResultado` deixou de acessar Supabase diretamente.

O repository concentra somente as duas leituras:

```text
pesagem atual por id
pesagem anterior do mesmo lote
```

A lógica de domínio permaneceu no hook:

- identificação de primeira pesagem;
- fallback de quantidade de animais;
- nomes de pasto/fazenda;
- diferença de peso;
- cálculo de dias;
- cálculo, sinal e valor absoluto do GMD;
- mensagens de erro e fallbacks de loading.

As queries continuam usando os mesmos selects, filtros, ordenação e limite da implementação anterior.

### Produtos do Gerente — atalho por retiro

`GerenteProdutosPage` deixou de consultar diretamente o retiro usado pelo
atalho do painel. O repository preserva a consulta a `retiros`, o select de
`fazenda_id`, o filtro por `id`, o `maybeSingle` e o fallback nulo.

### Auditoria SyncVet

`SyncVetAuditoriaPage` deixou de importar o client Supabase. Seu repository
preserva as leituras sequenciais de equipes e auditoria, inclusive os filtros
por `empresa_id`, a ordenação decrescente por `created_at`, o limite de 300
registros e os fallbacks de listas vazias.

### Trajetos SyncVet

`SyncVetTrajetosPage` agora acessa o repository específico da feature. Foram
preservados a resolução da equipe por `empresa_id` e `user_id`, o
`maybeSingle`, o filtro de trajetos pelo veterinário resolvido, a ordenação
decrescente por data, o limite de 200 e o filtro de fazendas por `empresa_id`.
Sem equipe ou dados, as mesmas listas vazias continuam sendo retornadas.

### Recuperação de senha

As páginas `RecuperarSenhaPage` e `RedefinirSenhaPage` não importam o client Supabase diretamente. O acesso ao provider legado de auth fica isolado em:

```text
apps/web/src/features/auth/repositories/authRecoveryRepository.ts
```

O repository encapsula solicitação de link, atualização de senha e limpeza da sessão de recuperação. Mensagens de erro permanecem genéricas nas páginas; nenhum segredo é introduzido no cliente.

O guardrail arquitetural permite import do provider apenas dentro de `features/*/repositories/*`, enquanto páginas/hooks continuam proibidos de criar novos imports diretos.

## Próximos slices

Priorizar hooks e páginas pequenos e isolados antes de fluxos críticos com cache, realtime ou offline.

## Guardrail da FASE 3

O commit `c5196bf732af7420c2022e12016aa89c1ab67f06` congela o baseline de imports diretos de Supabase do Web. O teste `apps/web/src/test/architecture/supabaseGuardrail.test.ts` compara o diff posterior a esse baseline e reprova novas linhas que importem:

- `@/integrations/supabase/client` (ou caminho equivalente para o mesmo client);
- `@supabase/supabase-js` fora de `apps/web/src/integrations/supabase/client.ts`.

O guardrail é propositalmente **aditivo**: não exige refactor big-bang do legado, mas impede aumentar o acoplamento. Se um fluxo existente for alterado, deve-se usar o repository/service apropriado e preservar seu behavior contract.

O CI precisa fazer checkout com histórico completo (`fetch-depth: 0`) para que a comparação com o baseline seja verificável.
