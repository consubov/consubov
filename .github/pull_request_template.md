## Aplicativo, versao e rastreabilidade

- APP_ID(s) ou SITE_ID(s):
- TASK_ID / owner / referencia Obsidian:
- Branch / SHA base / SHA HEAD / PRs dependentes:
- Versao vigente por app (site: N/A):
- Versao candidata (A_DEFINIR; site: N/A):
- Consumidores compartilhados, QA e rollback:
- Gate local `task qa:release-governance` com evidencia:

> Sites nao possuem SemVer. Apenas releases autorizados incrementam versoes de apps. Preservar ramos legados e do Dependabot.

## Objetivo

<!-- Explique o que esta mudanca resolve. -->

## Escopo

<!-- Liste apenas o que faz parte deste PR. -->

## Fora de escopo

- [ ] Supabase/banco remoto
- [ ] Vercel/deploy
- [ ] redesign
- [ ] regra de negocio nao documentada

## Validacao

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run build`
- [ ] `bun run test`
- [ ] UI/fluxos existentes preservados quando afetados
- [ ] offline/service worker/cache preservados quando afetados

## Riscos

<!-- Descreva riscos conhecidos ou escreva "Nenhum identificado". -->

## Evidencias

<!-- Inclua resultados de testes, screenshots ou observacoes quando necessario. -->