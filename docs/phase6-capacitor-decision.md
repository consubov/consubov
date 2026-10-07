# FASE 6 — Decisão de empacotamento nativo — SUPERADA

> **Status:** SUPERADA pela decisão PWA-first de 2026-10-07.

O planejamento anterior de Capacitor/WebNative deixou de ser a direção ativa do CONSUBOV.

A estratégia vigente é:

```text
Web React/Vite → PWA iOS/Android → Offline/Sync → infraestrutura remota/staging → produção
                                                   ↓
                              empacotamento nativo somente pós-produção, se necessário
```

Capacitor/WebNative só volta a ser avaliado quando a aplicação estiver em produção, com fluxos críticos 100% funcionais, offline/sync estabilizado e houver necessidade comprovada de loja ou capability gap não resolvido pela PWA.

O código experimental existente em `apps/mobile/` fica congelado e não define a arquitetura vigente.

Documento vigente: `docs/30-pwa-mobile-first.md`.
