# PRD-QUAL-05 — Gate de qualidade da Web

## Status

`IN_PROGRESS`

## Objetivo

Executar a FASE 5 do Checklist Mestre do CONSUBOV como gate de qualidade da Web/API, elevando a evidência de testes, CI, E2E, lint/typecheck/build, segurança, observabilidade e baselines técnicos sem alterar regra de negócio nem conectar infraestrutura remota.

## Contexto

- Linha-base: `fix/fase3-audit-20261004`.
- Branch de execução: `quality/fase5-web-gate-20261004`.
- A FASE 5 foi iniciada por autorização explícita do responsável em 2026-10-04.
- As FASES 3 e 4 ainda possuem evidências pendentes no Checklist Mestre; portanto o gate `WEB READY` não pode ser declarado concluído apenas por este PRD.
- Backend vigente: Bun + TypeScript; Web/Admin: React + Vite + TypeScript.
- A nova arquitetura não pode ser conectada ao Supabase/PostgreSQL remoto nem ao Vercel nesta fase.

## Escopo

### Incluído

- consolidar e documentar baseline atual de testes Web/API;
- adicionar scripts explícitos de `typecheck` e E2E no workspace Web;
- separar E2E Playwright dos testes Vitest;
- criar smoke E2E local para superfícies públicas e proteção de rotas;
- tornar o CI apto a validar PRs empilhados e executar o smoke E2E sem segredo real;
- manter `bun run check`, testes Edge e smoke HTTP da API como gates;
- criar baseline reproduzível de bundle usando tooling local sem serviço pago;
- documentar dívida de lint/coverage/a11y/performance sem inventar metas;
- preservar contratos de segurança, tenancy, RBAC, OpenAPI e isolamento do legado;
- atualizar documentação permanente e Checklist Mestre com evidência real.

### Fora de escopo

- conectar Supabase/PostgreSQL remoto;
- migrations remotas;
- Vercel/deploy/release;
- modificar regras de negócio;
- concluir funcionalmente a FASE 4 por inferência;
- adicionar credenciais reais de usuários ao CI;
- inventar cobertura mínima sem baseline medido;
- introduzir Lighthouse/axe/coverage provider novo sem lockfile coerente;
- expandir SyncVet, Relatto, campanhas ou IA;
- alterar visual existente sem necessidade direta do gate.

## Áreas esperadas

- `.github/workflows/ci.yml`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/**`
- `scripts/**` ou equivalente para baseline de bundle
- `docs/**`
- `instructions/active/**`

## Regras de segurança

- nenhum segredo real em arquivo, teste, log ou workflow;
- E2E usa apenas superfícies que possam ser validadas localmente sem credenciais reais;
- rotas protegidas devem negar/redirect quando não autenticadas;
- logs de teste não devem expor tokens, senha, email real ou PII;
- CORS/auth/tenant/RBAC existentes não podem ser relaxados para fazer teste passar;
- nenhuma chamada remota deve ser requisito para o gate local.

## Requisitos

- [ ] Web possui script `typecheck` explícito.
- [ ] Web possui script `test:e2e` explícito.
- [ ] Playwright usa diretório E2E separado de Vitest.
- [ ] E2E valida login renderizado.
- [ ] E2E valida redirect de rota protegida para login sem sessão.
- [ ] E2E valida 404 e retorno para área pública.
- [ ] E2E executa em viewport desktop e mobile Chromium.
- [ ] CI executa E2E local com valores de teste, sem segredos reais.
- [ ] CI continua executando `bun run check`, Edge tests e smoke HTTP da API.
- [ ] CI executa para PR empilhado, não apenas PR com base `main`.
- [ ] Existe relatório local reproduzível de tamanho de bundles/chunks após build.
- [ ] Dívidas/bloqueios restantes de coverage, axe/Lighthouse e fluxos autenticados estão documentados como `[PENDENTE]`, sem falsear conclusão.
- [ ] documentação permanente registra o estado do gate.

## Critérios de aceite

- [ ] branch criada a partir da linha correta;
- [ ] diff restrito à FASE 5;
- [ ] nenhum acesso remoto novo ao Supabase/Vercel;
- [ ] `bun run check` verde no CI;
- [ ] Edge Functions tests verdes no CI;
- [ ] API smoke verde no CI;
- [ ] E2E smoke verde no CI;
- [ ] revisão de segurança/qualidade sem bloqueador P0;
- [ ] documentação atualizada;
- [ ] Checklist Mestre atualizado com evidência;
- [ ] `WEB READY` só é marcado se FASES 3/4 e todos os critérios 5.11 estiverem comprovados.

## Testes obrigatórios

- unit/contract existentes via `bun run test`;
- API/OpenAPI parity já incluída no suite da API;
- Edge Functions suite existente;
- HTTP smoke da API;
- Playwright smoke:
  - `/login`;
  - rota protegida sem sessão;
  - rota inexistente;
  - landing pública em desktop/mobile;
- verificar ausência de credencial real no bundle/config alterado;
- revisar diff após CI.

## Validações obrigatórias

- observar check runs do PR;
- inspecionar falhas, corrigir causa raiz e repetir;
- solicitar revisão automática de código quando disponível;
- executar auditoria de qualidade com `qualidade-visionario` antes de declarar conclusão;
- não afirmar sucesso sem check/evidência do GitHub.

## Documentação a atualizar

- `docs/README.md`;
- novo documento permanente da FASE 5;
- este PRD/handoff enquanto o trabalho estiver ativo;
- Checklist Mestre no Notion;
- Handoff do Projeto, caso o estado operacional mude de forma relevante.

## QA

Track obrigatório: `AUDITORIA DE QUALIDADE`.

Resultado final permitido:
- `QA: APROVADO`; ou
- `QA: REPROVADO`.

Se reprovado, corrigir e repetir. Não marcar a FASE 5 como concluída enquanto houver reprovação ou evidência faltante.

## Regras de Git

- preservar trabalho existente;
- sem `reset --hard`;
- sem force push;
- branch dedicada da FASE 5;
- PR preferencialmente empilhado sobre `fix/fase3-audit-20261004` até a FASE 3 ser integrada;
- não fazer merge automático;
- commits pequenos e coerentes;
- após integração/rebase, repetir gates.

## Ações proibidas

- deploy/release/publicação;
- migrations ou alterações de schema remoto;
- rotação/alteração de secrets;
- conexão da nova API a banco remoto;
- Vercel;
- relaxar auth/RBAC/tenant isolation;
- inventar usuário de teste real;
- mascarar falhas ou desabilitar testes para obter verde;
- alterar regra de domínio fora do escopo.

## Convivência com outros agentes

- não sobrescrever a linha `fix/fase3-audit-20261004`;
- se a FASE 3 avançar enquanto este trabalho estiver aberto, atualizar/rebasear de forma não destrutiva;
- evitar tocar arquivos de domínio que outro agente esteja corrigindo;
- tratar conflitos de CI/documentação explicitamente.

## Relatório final esperado

```text
RESULTADO:
...

ALTERAÇÕES:
...

VALIDAÇÃO:
- check runs:
- testes:
- E2E:
- segurança:

QA:
APROVADO | REPROVADO

BLOQUEIOS:
...

NOTION:
...

GIT:
branch:
PR:
base:

PRÓXIMO PASSO:
...

HANDOFF:
SIM | NÃO
```
