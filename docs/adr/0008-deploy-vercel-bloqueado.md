# ADR-0008 — Deploy/Vercel bloqueado nesta etapa

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
Web, App, Offline e estratégia de infraestrutura ainda possuem gates anteriores à produção.

## Decisão
Não configurar ou executar deploy de produção/Vercel nesta etapa.

Deploy, publicação, release e mudanças de infraestrutura externa exigem gate específico e autorização explícita.

## Consequências
- Pode-se preparar CI/CD e documentação.
- Não publicar produção antes do gate.
- Não assumir Vercel como destino final sem validação.

## Não decidido aqui
- Destino final do Web.
- Destino final da API Bun.
