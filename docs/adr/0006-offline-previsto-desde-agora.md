# ADR-0006 — Offline previsto desde a arquitetura inicial

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
O núcleo do produto exige operação em ambiente rural com conectividade ruim ou inexistente.

## Decisão
O offline influencia contratos, IDs, versionamento, idempotência, conflitos e modelo de dados desde agora.

A implementação completa do motor offline ocorrerá **depois da Web e do App empacotado**.

## Consequências
Desde já, considerar:
- IDs estáveis;
- comandos idempotentes;
- versões;
- conflitos;
- device_id;
- cursor/checkpoint;
- anexos;
- timestamps locais versus autoritativos;
- tombstones quando necessários.

## Não decidido aqui
- Política final de conflito por agregado.
- Duração de sessão offline.
- Implementação final do Sync Engine.
