# CONSUBOV — Zod 4: paridade e auditoria do PR #63 (24/10/2026)

## Escopo e fonte
PRD FASE 9.1 Notion: https://app.notion.com/p/4038e0bd0f4d8113b0a0e8f650fc0895
Branch: `fix/consubov-zod4-compat-20261024`, baseada no PR #61. Trabalho SOMENTE no App/Web e seus testes, sem merge, deploy, Supabase remoto, DNS ou dados reais. A publicacao 2.0 permanece NO-GO.

## Inventario do codigo e compatibilidade
- Formulario de leads da Landing Page: `apps/web/src/pages/LandingPage.tsx`, schema `leadSchema` (nome, email, telefone, whatsapp, mensagem opcional); armazenamento na tabela de leads apenas depois de validacao.
- Cadastro de clientes do Pesador: `apps/web/src/pages/PesadorClientesPage.tsx`, schema `clienteSchema` (nome obrigatorio, fazenda/cidade/telefone opcionais ou vazios); fila offline `maisArrobasQueue` segue intacta.
- Os schemas foram extraidos sem alterar refinamentos para `apps/web/src/lib/zodSchemas.ts` e usados pelas paginas. Cobertura de regressao `apps/web/src/lib/zodSchemas.test.ts` compara os resultados reais Zod 4 contra os mesmos schemas da API publica `zod/v3` (mantida pelo pacote Zod 4) para entradas validas, invalidas, trim, extras, limites e campos opcionais. Mensagens explicitas portuguesas verificadas; texto padrao de erros Zod pode variar entre major versions e sera tratado como diferenca conhecida em QA.
- Fluxos React Hook Form existentes nao foram alterados; o inventario PR #63 nao identificou uso direto de `zodResolver` nos arquivos listados. O pacote `@hookform/resolvers` continua sem upgrade; nao declarar paridade funcional total sem testes integrados.
- `supabase/functions/syncvet-calcular-trajeto/index.ts` importa `npm:zod@3` separadamente; fora do escopo do PRD de seguranca Web, pendencia para trilha propria.
- Teste sintetico de array `max(2)` usa tres strings; nao aloca grande volume de memoria.

## Evidencia confirmada antes deste patch
- Workflow de lockfile [#40124099668](https://github.com/consubov/consubov/actions/runs/40124099668) PASS: Bun 1.4.0, `bun install --frozen-lockfile`, novo lock `zod@4.6.7` para Web.
- QA [#40124174110](https://github.com/consubov/consubov/actions/runs/40124174110) FAIL por historia Git insuficiente no checkout, nao por regressoes da aplicacao.
- QA [#40124317455](https://github.com/consubov/consubov/actions/runs/40124317455) FAIL **somente no audit apos** typecheck, build, API 543/543, Web 213/213 e lint changed PASS. `bun audit --audit-level=high` reportou um HIGH: Zod 3.25.76 via `lighthouse > puppeteer-core > chromium-bidi@17.0.2 > zod`, apesar de Zod Web 4.6.7.
- Metadados Chromium BiDi 17.0.2 registram dependencia `zod:^3.24.1` e o upstream ainda discute migracao 4; **nenhum override de major nem supressao do scanner aplicada**. Trata-se de ferramenta DEV/QA, nao evidencia de exploit na aplicacao compilada; ainda assim o gate exige resolucao.
- O workflow temporario QA nesta branch roda E2E completo e Edge antes de `bun audit`, preservando FAIL do audit para coletar regressao independente. Nenhum PASS atribuido aos testes ainda nao realizados no SHA novo.

## Gates antes de release
- [ ] CI e QA integrados no MESMO SHA com E2E/Edge, cobertura, SAST e audit HIGH = 0.
- [ ] Validar mudanca de mensagens padrao Zod (quando exibidas) e schemas de forma negativa.
- [ ] Enderecar Zod3 da cadeia Lighthouse sem mascarar risco ou quebrar ferramenta de QA.
- [ ] Homologar offline/atualizacao em mesma origem, dados pendentes, fotos, seis IndexedDB, dispositivos fisicos Android/iOS e rollback.
- [ ] Remover workflows temporarios `consubov-zod-inventory-temporary.yml`, `consubov-zod-lock-refresh-temporary.yml`, `consubov-zod-qa-temporary.yml` antes de merge.
- [ ] Integrar somente quando PRs #60–#63, conflitos de lockfile e homologacoes estiverem aprovados; exige autorizacao explicita para merge/producao.
