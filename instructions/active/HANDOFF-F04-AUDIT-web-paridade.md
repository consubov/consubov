# HANDOFF — FASE 4 Auditoria Web

## Estado

Branch: `fix/fase4-audit-20261005`  
Base: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b`

PRD ativo: `instructions/active/PRD-F04-AUDIT-web-paridade.md`.

## Objetivo desta linha

Remover regressões/falsa evidência encontradas na FASE 4, corrigir inconsistências seguras e produzir um inventário verificável do que ainda falta no Checklist Mestre.

## Achados já comprovados

- teste de `PastoDetailPage` mocka o próprio componente;
- existe teste duplicado com caractere acidental no nome;
- `useGuardrails.ts` é no-op e descreve LWW em domínios críticos;
- `docs/04-tenant-hierarchy.md` contém modelo de tenant e UUID sem suporte nas decisões vigentes;
- a página de pasto não confirma a ancestralidade dos IDs da rota;
- foram adicionados endpoints de sync 501 não aprovados após o baseline da FASE 3;
- setup Vitest/IndexedDB divergiu do baseline aprovado apesar de `fake-indexeddb` já existir;
- há artefatos acidentais na árvore.

## Trabalho paralelo

PR #35 / `quality/fase5-web-gate-main-20261004` continua em paralelo. Não sobrescrever mudanças dessa linha. Depois da remediação da FASE 4 ser integrada, a FASE 5 deve reconciliar a nova `main` e repetir gates.

## Bloqueios

- nenhuma conexão remota;
- nenhuma migration/schema remoto;
- nenhum deploy/Vercel;
- nenhuma regra nova de estoque/pesagem/fábrica sem decisão de domínio;
- Issue #5 continua pausada e não deve ser retomada como refactor amplo.

## Próxima validação

1. aplicar correções do PRD;
2. executar/checkar suíte completa via CI;
3. revisar diff/segredos/artefatos;
4. executar QA no track `AUDITORIA DE QUALIDADE`;
5. atualizar Notion com evidência real;
6. abrir PR sem merge automático.
