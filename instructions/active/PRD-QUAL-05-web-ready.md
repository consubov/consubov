# PRD-QUAL-05 — FASE 5 Web Quality / WEB READY

## Status
`IN_PROGRESS`

## Base
- branch base: `main`
- commit base: `bd9ad453424fa9ad220dca4f55626762a26b87f2`
- branch de trabalho vigente: `work/fase5-6-7-pwa-local` (PR #43 draft; antiga `quality/fase5-web-ready-20261005` congelada)
- autorização: pedido explícito do responsável em 2026-10-05 para executar toda a FASE 5.

## Objetivo
Executar integralmente a FASE 5 do Checklist Mestre sobre a `main` consolidada, elevando qualidade, segurança, acessibilidade, responsividade, performance e evidência funcional da Web/API até o gate `WEB READY`, sem conectar infraestrutura remota.

## Escopo
- 5.1 testes unitários/contratos e regressões;
- 5.2 integration tests controlados sem remoto;
- 5.3 Playwright E2E dos fluxos prioritários com identidades/fixtures locais simuladas;
- 5.4 lint/typecheck/build/test gates;
- 5.5 coverage baseline e gate progressivo baseado em baseline real;
- 5.6 bundle/performance/Lighthouse baseline e orçamento de regressão;
- 5.7 acessibilidade automatizada + teclado/contraste/foco onde reproduzível;
- 5.8 responsividade desktop/tablet/mobile e superfícies críticas;
- 5.9 checklist de segurança Web/API e testes negativos;
- 5.10 observabilidade vendor-neutral preparada;
- 5.11 auditoria final do gate `WEB READY`;
- documentação permanente, `CONSUBOV_CHECKLIST_MESTRE.md` e handoff.

## Fora do escopo
- Supabase/PostgreSQL remoto;
- migration/schema remoto;
- Vercel/deploy/release;
- rotação de secrets;
- criação de regra de negócio não comprovada;
- expansão funcional de SyncVet, Relatto, campanhas ou IA;
- homologação física de balanças/dispositivos;
- FASE 6+.

## Áreas esperadas
- `apps/web/**`
- `apps/api/**` somente quando necessário para gates/segurança/observabilidade
- `.github/workflows/**`
- `scripts/**`
- `docs/**`
- `instructions/active/**`

## Regras de segurança
- nenhum segredo real em teste/CI;
- nenhum acesso remoto novo;
- não relaxar auth/RBAC/tenant isolation;
- testes autenticados usam mocks/fixtures locais controlados;
- erros/logs não devem expor token, senha, chave administrativa ou PII desnecessária;
- QR é identidade, nunca autorização;
- realtime não é fonte autoritativa de integridade;
- writes críticos mantêm contratos de idempotência/versão/autoridade atômica/conflito explícito.

## Critérios de aceite
- [ ] 5.1–5.10 possuem evidência reproduzível ou pendência justificada que não bloqueie o gate;
- [ ] `bun run check` verde;
- [ ] lint incremental/gate de dívida não regressiva verde;
- [ ] coverage baseline medido e gate progressivo ativo;
- [ ] E2E prioritário verde em desktop/mobile;
- [ ] accessibility automatizada sem violações bloqueantes nas superfícies em escopo;
- [ ] Lighthouse/performance baseline reproduzível e sem regressão bloqueante;
- [ ] bundle budget ativo;
- [ ] segurança Web/API revisada com testes negativos e scans verdes;
- [ ] responsividade crítica validada;
- [ ] observabilidade preparada sem backend pago/remoto;
- [ ] documentação permanente atualizada;
- [ ] `CONSUBOV_CHECKLIST_MESTRE.md` atualizado pelos agentes conforme os itens realmente executados;
- [ ] AUDITORIA DE QUALIDADE final: `QA: APROVADO`;
- [ ] `WEB READY` marcado somente com evidência.

## Testes obrigatórios
- unit/contract Vitest existentes + regressões novas;
- integration tests locais/controlados;
- Playwright desktop/mobile;
- auth: login, logout, redirects e acesso negado;
- superfícies por domínio: estrutura pecuária, QR, nutrição/produtos, estoque/transferência, visita, fábrica, pesagem e relatórios quando simuláveis sem inventar regras;
- tenant/role mismatch;
- loading/error/empty onde crítico;
- accessibility automatizada;
- coverage;
- bundle/performance;
- API HTTP/OpenAPI;
- Edge Functions;
- SAST, dependency scan, secret scan.

## Documentação
Atualizar:
- documento permanente da FASE 5;
- `docs/README.md`;
- `CONSUBOV_CHECKLIST_MESTRE.md` no repositório;
- handoff/status;
- contratos/API se comportamento público mudar.

## QA
Track obrigatório: `AUDITORIA DE QUALIDADE`.

Resultado final permitido:
- `QA: APROVADO`; ou
- `QA: REPROVADO`.

Se reprovado: corrigir, repetir testes e repetir QA. Não declarar a FASE 5 concluída enquanto houver bloqueador material.

## Regras de Git
- trabalhar em `work/fase5-6-7-pwa-local` (PR #43; branch anterior congelada);
- base `main@bd9ad453424fa9ad220dca4f55626762a26b87f2`;
- sem `reset --hard`, force push ou reescrita destrutiva;
- commits coerentes e pequenos;
- revisar diff e arquivos acidentais;
- repetir gates após mudanças relevantes;
- merge somente depois de QA aprovado e checks verdes.

## Ações proibidas
Deploy, release, migration remota, schema remoto, Vercel, banco remoto, rotação de secrets, exclusão de dados reais, relaxamento de auth/RBAC/tenancy, mascarar/skips de testes para obter verde.

## Convivência
Verificar alterações paralelas antes de sobrescrever arquivos compartilhados. No início deste PRD, a árvore remota possui somente `main` e esta branch de trabalho.

## Relatório final esperado
- Resultado
- Alterações
- Validação
- Evidências por 5.1–5.11
- QA
- Riscos/pendências
- Checklist Mestre do repositório
- Git/PR
- próximo passo
- HANDOFF: SIM/NÃO

## Adendo 2026-10-08 — QA via VS Code / Go Task

- Executar ferramentas localmente conforme `docs/qa/QA-LOCAL-VSCODE-GO-TASK.md`: `task doctor`, `task setup`, `task qa:phase5` e eventualmente `task qa:act` (opcional, sem CI remoto).
- Registrar logs/JSON em `.qa/runs/` e relatório sanitizado em `docs/qa/` por commit/SHA. Correção de falha local exige nova execução.
- Testes físicos iOS/Android e cenários de conectividade rural **não bloqueiam o trabalho de desenvolvimento seguinte**; registrar `HOMOLOGAÇÃO REAL PENDENTE` e validar antes da publicação a clientes. Não confundir teste emulado com homologação física.
- E2E/axe/Lighthouse, cobertura, scans, tenant isolation e não perda de IndexedDB são gates automatizáveis **não dispensados**.
- Sem merge, deploy, migrations remotas, secrets ou Vercel sem autorização explícita.
