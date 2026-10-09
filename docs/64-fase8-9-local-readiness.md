# FASES 8–9 — Preparação local, gates e liberação controlada

**Atualizado:** 2026-10-09. Nenhuma infraestrutura remota foi conectada nem alterada.

## Entregue agora

- Orquestração `task qa:matrix` testa independentemente as FASES 5–7 e gera `.qa/matrix/<execucao>/result.json` e `summary.md` por SHA. O resultado geral é **FAIL** se qualquer gate falhar.
- `scripts/qa/check-preprod-local-gates.mjs` valida a **evidência local**, exige SHA completo igual ao checkout, working tree limpa, simulação desativada e FASES 5/6/7 PASS. Não faz rede, migrations nem deploy.
- `scripts/tests/preprod-local-gates.test.cjs` cobre 8 casos, incluindo relatório ausente, SHA divergente, ambiente sujo, QA simulado e fase reprovada.

## Executar no VS Code depois de concluir o trabalho local

```powershell
task qa:matrix
# Quando os gates tiverem passado, apontar para o JSON real gerado:
$env:QA_MATRIX_REPORT = ".qa/matrix/<execucao>/result.json"
task qa:preprod:local-gates
```

Um PASS aqui confirma **somente consistência das evidências automatizadas locais**. A liberação a clientes em produção exige separadamente: autorização explícita do responsável, homologação física Android/iPhone, atualização da PWA antiga→nova no mesmo origin, offline rural, filas/Blobs sem perda, observabilidade, backup/restore, migração/rollback e piloto controlado. Esses itens **não bloqueiam implementar trabalho independente** nas fases seguintes.

## FASE 8 — preparação permitida

Localmente: elaborar matriz de origem/destino, contratos e ensaios isolados de schema PostgreSQL, fake adapters, RBAC/RLS, idempotência e migração com fixtures anônimas, sempre com rollback. **Não acessar banco remoto, executar migrations reais ou configurar serviços externos** sem autorização.

## FASE 9 — preparação permitida

Localmente: completar runbook de instalação/upgrade PWA, planos de piloto, incidentes, rollback, backup/restauração e checklist de autorização. A preparação não equivale a `PRODUCTION READY` nem permite deploy.

**Status agora:** FASE 8 e 9 somente preparação/documentação; o QA completo 5–7 e homologação física permanecem pendentes.
