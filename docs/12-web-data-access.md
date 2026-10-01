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

## Próximos slices

Priorizar hooks e páginas pequenos e isolados antes de fluxos críticos com cache, realtime ou offline.
