# PRD-QUAL-05 — Gate de qualidade da Web

## Status
`IN_PROGRESS`

## Objetivo
Executar a FASE 5 do Checklist Mestre como gate de qualidade da Web/API, com evidência reproduzível e sem infraestrutura remota.

## Contexto
A FASE 3 foi integrada à `main` via PR #33. A FASE 5 foi iniciada por autorização explícita em 2026-10-04. A FASE 4 ainda possui itens não reconciliados; portanto `WEB READY` não pode ser declarado sem evidência integral de 5.11.

## Escopo
### Incluído
- scripts explícitos de typecheck/E2E;
- Playwright separado do Vitest;
- smoke E2E local de login público, proteção de rota, 404 e landing;
- lint baseline e gate incremental para arquivos alterados;
- baseline de bundle;
- CI para PRs;
- preservação de testes Edge e smoke HTTP da API;
- documentação e Checklist Mestre.

### Fora do escopo
- Supabase/PostgreSQL remoto;
- migrations/schema remoto;
- Vercel/deploy/release;
- credenciais reais no CI;
- mudança de regra de negócio;
- expansão de SyncVet, Relatto, campanhas ou IA;
- declarar FASE 4 concluída por inferência.

## Áreas esperadas
`.github/workflows/ci.yml`, `apps/web/**`, `scripts/**`, `docs/**`, `instructions/active/**`.

## Segurança
- nenhum segredo real;
- não relaxar auth/RBAC/tenant isolation;
- E2E local sem credencial de produção;
- nenhum acesso remoto novo;
- logs sem token/senha/PII desnecessária.

## Critérios de aceite
- [ ] `bun run check` verde;
- [ ] lint incremental verde;
- [ ] Edge tests verdes;
- [ ] API smoke verde;
- [ ] Playwright smoke verde em desktop/mobile Chromium;
- [ ] baseline de bundle executável;
- [ ] documentação permanente atualizada;
- [ ] Checklist Mestre atualizado com evidência;
- [ ] auditoria `qualidade-visionario` sem bloqueador P0;
- [ ] `WEB READY` permanece aberto se 5.11/FASE 4 não estiverem comprovados.

## Testes obrigatórios
- unit/contract existentes;
- OpenAPI/API existentes;
- Edge Functions;
- HTTP smoke;
- Playwright smoke local;
- revisão de segredo/arquivo acidental;
- repetição após conflito/rebase.

## Documentação
Atualizar `docs/README.md`, documento permanente da FASE 5, Checklist Mestre e handoff/status.

## QA
Track: `AUDITORIA DE QUALIDADE`.
Resultado permitido: `QA: APROVADO` ou `QA: REPROVADO`. Se reprovado, corrigir e repetir.

## Regras de Git
- branch dedicada;
- base `main`;
- sem `reset --hard`/force push;
- sem merge automático;
- commits coerentes;
- repetir gates depois de atualizar a base.

## Ações proibidas
Deploy, release, migration remota, schema remoto, rotação de secrets, Vercel, banco remoto, relaxamento de auth/RBAC/tenancy, mascarar testes.

## Convivência com outros agentes
Não sobrescrever trabalhos paralelos; revisar conflitos e mudanças em arquivos compartilhados antes de atualizar a branch.

## Relatório final esperado
Resultado; alterações; validação; QA; bloqueios; Notion; Git; próximo passo; HANDOFF SIM/NÃO.
