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
- baseline básico de acessibilidade/teclado nas superfícies públicas;
- verificação de overflow público em desktop/mobile;
- lint baseline e gate incremental para arquivos alterados;
- baseline de bundle e gate anti-regressão;
- guarda de padrões de segredo no bundle construído;
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
- logs sem token/senha/PII desnecessária;
- bundle construído deve passar pelo guard de padrões administrativos/segredos conhecidos.

## Critérios de aceite
- [x] `bun run check` verde;
- [x] lint incremental verde;
- [x] Edge tests verdes;
- [x] API smoke verde;
- [x] Playwright smoke/a11y público verde em desktop/mobile Chromium;
- [x] baseline de bundle executável;
- [x] budget regressivo de bundle verde;
- [x] guard de padrões de segredo do bundle verde;
- [x] documentação permanente atualizada;
- [x] Checklist Mestre atualizado com evidência;
- [ ] auditoria `qualidade-visionario` sem bloqueador P0;
- [x] `WEB READY` permanece aberto se 5.11/FASE 4 não estiverem comprovados.

## Testes obrigatórios
- unit/contract existentes;
- OpenAPI/API existentes;
- Edge Functions;
- HTTP smoke;
- Playwright smoke local;
- baseline básico de teclado/labels/overflow;
- budget do bundle;
- revisão de segredo no bundle/arquivo acidental;
- repetição após conflito/rebase.

## Documentação
Atualizar `docs/README.md` quando o índice mudar, documento permanente da FASE 5, Checklist Mestre e handoff/status.

## QA
Track: `AUDITORIA DE QUALIDADE`.
Resultado permitido: `QA: APROVADO` ou `QA: REPROVADO`. Se reprovado, corrigir e repetir.

Estado atual: `QA: REPROVADO` para fechamento da FASE 5. O ciclo automatizado do HEAD `08e8fa27139b2af4d1885d80cb8762a9608ee64e` está verde, mas faltam FASE 4 reconciliada, E2E autenticado completo, coverage, axe/Lighthouse/Core Web Vitals e homologação responsiva completa.

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
