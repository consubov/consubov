# HANDOFF-F00-F04 — Consolidação das FASES 0–4

## Estado
`EM EXECUÇÃO`

## Linha única
- branch: `fix/fase4-audit-20261005`
- PR: #36
- base atual: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b`
- PRD: `instructions/active/PRD-F00-F04-CONSOLIDACAO.md`

## Objetivo
Revalidar FASES 0–3, concluir FASE 4, remover regressões e consolidar Git para restar somente `main` após merge/gates.

## Já corrigido nesta linha
- falso guardrail LWW/no-op removido;
- endpoints sync 501 inventados removidos;
- setup Vitest/IndexedDB restaurado;
- artefatos acidentais removidos;
- teste falso/duplicado de PastoDetailPage removido;
- validação de ancestralidade fazenda→retiro→pasto adicionada;
- documentação de tenant/hierarquia corrigida;
- parser QR testado.

## Próximos blocos
1. auth/recuperação/guards;
2. contratos e inventário 4.2–4.15;
3. incorporar somente infraestrutura de qualidade necessária da linha FASE 5;
4. auditoria regressiva FASES 0–3;
5. CI/security + QA final;
6. Notion/handoff global;
7. merge e limpeza de branches.

## Restrições
Sem banco remoto novo, migration remota, Vercel/deploy, rotação de secrets, regra zootécnica inventada ou expansão de SyncVet/Relatto/campanhas/IA.
