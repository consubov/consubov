# ADR-0001 — Backend Bun + TypeScript

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
O projeto precisa consolidar a reconstrução do backend em uma stack controlada pela CONSUBOV e compatível com a base atual do repositório.

## Decisão
Adotar **Bun + TypeScript** como stack principal do backend/API.

A API será responsável por domínio, autenticação/autorização, tenancy, auditoria, validação, idempotência, conflitos, relatórios, integrações, sync, arquivos e eventos/jobs quando necessários.

## Consequências
- Laravel deixa de ser a direção arquitetural vigente.
- Novos módulos backend devem seguir Bun + TypeScript.
- Regras críticas não devem ser duplicadas entre Web, App e backend.
- Dependências novas precisam respeitar as regras do projeto.

## Não decidido aqui
- Provider final de banco remoto.
- Provider final de observabilidade.
- Provider final de storage.
