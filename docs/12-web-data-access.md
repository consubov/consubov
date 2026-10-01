# Migração progressiva de acesso a dados do web

## Objetivo

Reduzir o acoplamento direto entre hooks/componentes React e o client Supabase sem alterar comportamento funcional.

## Padrão

Fluxo preferencial:

```text
Component
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
- testes devem cobrir o contrato do repository e regressões críticas do hook quando aplicável.

## Primeiro slice concluído

`useLandingContent` deixou de importar o client Supabase diretamente.

A consulta de `landing_page_content` agora vive em:

```text
apps/web/src/features/landing/repositories/landingContentRepository.ts
```

O repository preserva a semântica anterior:

- filtra por `landing_slug`;
- transforma pares `chave/valor` em mapa;
- valor nulo vira string vazia;
- ausência de dados produz objeto vazio.

O hook continua responsável apenas por estado React, loading e helpers de fallback/parsing.

## Próximos slices

Priorizar hooks pequenos e isolados antes de fluxos críticos com cache, realtime ou offline.
