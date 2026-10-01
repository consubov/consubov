# ADR-0007 — Persistência remota bloqueada nesta etapa

**Status:** Aceito  
**Data:** 2026-10-01

## Contexto
A nova arquitetura ainda está sendo preparada e não deve alterar infraestrutura remota antes dos gates definidos.

## Decisão
Nesta etapa, **não conectar a nova API ao Supabase/PostgreSQL remoto**.

Também não:
- executar migrations remotas;
- alterar schema remoto;
- alterar secrets remotos;
- rotacionar credenciais por iniciativa automática.

É permitido preparar:
- repositories/ports;
- adapters locais;
- fixtures/fakes;
- schema alvo;
- scripts;
- testes;
- dry-run;
- reconciliação.

## Consequências
O legado pode continuar usando Supabase durante a transição.

## Não decidido aqui
- Papel final do Supabase na infraestrutura remota.
