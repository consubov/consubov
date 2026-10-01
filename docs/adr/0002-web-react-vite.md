# ADR-0002 — Web e Backoffice em React/Vite

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
A aplicação atual já possui Web/Admin em React/Vite e a estratégia vigente é preservar e evoluir o que já funciona, evitando reescrita desnecessária.

## Decisão
Manter **React + Vite + TypeScript** como stack do Web e do Backoffice SaaS.

A direção de dependências é:

```text
React/Vite → API Bun/TypeScript → Application/Domain → Persistence/Adapters
```

## Consequências
- Filament/Livewire deixam de ser a direção arquitetural vigente.
- Migração será incremental.
- Fluxos atuais devem ser preservados sempre que possível.
- Funcionalidades migradas não devem criar novo acoplamento direto ao Supabase.

## Não decidido aqui
- Tecnologia final de empacotamento do App.
