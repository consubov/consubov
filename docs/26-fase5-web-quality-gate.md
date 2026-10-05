# FASE 5 — Gate de qualidade da Web

> Status em 2026-10-04: **EM ANDAMENTO**.
>
> Branch: `quality/fase5-web-gate-main-20261004`.
>
> PR: **#35**.

## Objetivo

Criar evidência reproduzível de qualidade para a Web/API antes do gate `WEB READY`, sem antecipar infraestrutura remota.

## Gates implementados

- `bun run check` preservado como gate agregado;
- Web expõe `typecheck` explicitamente;
- Playwright separado de Vitest;
- smoke E2E local cobre login renderizado, rota protegida sem sessão, 404 e landing;
- projetos Chromium desktop/mobile;
- `lint:baseline` mede a dívida existente;
- `lint:changed` impede novos erros de lint nos arquivos Web alterados;
- `report:bundle` gera baseline bruto/gzip do build;
- CI executa em pull requests, inclusive PRs empilhados;
- Edge Functions tests e smoke HTTP da API permanecem no pipeline;
- Security Code Scan continua como workflow separado.

## Evidência medida no CI

### Testes e contratos

No último ciclo com `bun run check` concluído:

- API/Bun: **532 testes aprovados**, **0 falhas**, em **74 arquivos**;
- Web/Vitest: **111 testes aprovados**, em **29 arquivos**;
- Playwright smoke: **8/8 aprovados** em Chromium desktop/mobile;
- Edge Functions/Vitest: **122 testes aprovados**, em **9 arquivos**;
- smoke HTTP da API: aprovado;
- typecheck Web/API: aprovado;
- build Web/API: aprovado;
- Security Code Scan: SAST, dependency vulnerability scan e secret scanning aprovados.

O conjunto existente inclui contratos de erro HTTP/OpenAPI, deny-by-default administrativo, regras de tenancy/RBAC, domínio e regressões Web. Isso é baseline; não significa que todos os fluxos funcionais da FASE 5.3 estejam cobertos por E2E.

### Lint

Baseline medido:

- **438** arquivos analisados;
- **229** arquivos com findings;
- **1.419** erros;
- **108** warnings.

Essa dívida é pré-existente e grande demais para um mega-refactor dentro deste gate. O CI usa `lint:changed` como barreira incremental para erros em arquivos alterados e mantém a contagem global visível.

### Bundle

Baseline do build:

- **17** arquivos JS/CSS;
- **8.611.805 bytes** raw;
- **2.533.532 bytes** gzip;
- maior chunk: `index-*.js` com aproximadamente **8,18 MB raw / 2,40 MB gzip**.

O Vite emite warning para chunk acima de 500 kB. Esse é um risco material de performance e impede considerar performance encerrada apenas porque o build passa.

### Imports/chunking

O build reporta módulos usados simultaneamente por import estático e dinâmico, impedindo code-splitting efetivo em pontos como:

- `@zxing/browser`;
- `consultorOffline/mutationQueue.ts`;
- `consultorOffline/snapshotStore.ts`;
- `consultorOffline/photoQueue.ts`;
- `consultorOffline/signedUrlCache.ts`;
- `pennStateStore.ts`;
- `pennStateFotos.ts`.

A busca no código de `apps/web/src` não encontrou uso direto de `eval(` nem `new Function`; o warning de build citado no checklist não foi reproduzido no build atual. Se reaparecer em dependência/transpilação, deve ser rastreado pelo artefato específico.

## Segurança

Os testes E2E usam somente URL/chave locais de teste. Não há credencial real de usuário, conexão do novo backend a banco remoto, migration, Vercel ou deploy.

A negação de rota sem sessão no browser é apenas uma evidência de UX/guard. Ela **não substitui** autorização e isolamento server-side.

## Pendências que mantêm o gate aberto

### Coverage

[PENDENTE] O Web/Vitest ainda não possui provider de coverage configurado como dependência direta/gate reproduzível. Não foi inventada meta percentual sem baseline.

### E2E funcional autenticado

[PENDENTE] A FASE 5.3 exige fluxos autenticados de domínio (logout, perfis, estrutura pecuária, QR, nutrição, estoque, transferência, visitas, fábrica, pesagem, relatórios, permissão e tenant mismatch). Esses fluxos exigem fixtures/identidades de teste controladas e não devem usar credenciais reais.

### Performance

Baseline de bundle existe, porém ainda faltam:

- orçamento aprovado;
- Lighthouse/Core Web Vitals;
- medição em dispositivo modesto;
- correção/decisão sobre o chunk principal de ~8,18 MB e os imports que impedem divisão efetiva.

### Acessibilidade

[PENDENTE] axe/Lighthouse accessibility e auditoria completa de teclado, foco, contraste, formulários e dialogs.

### Responsividade

O smoke cobre desktop e viewport mobile apenas nas superfícies públicas/proteção de rota.

[PENDENTE] homologação completa de dashboards, tabelas, formulários, mapas, modais e PDFs.

### Dependência da FASE 4

[PENDENTE] A FASE 4 está em andamento em linha paralela. O `WEB READY` não pode ser fechado enquanto a paridade/organização funcional que alimenta este gate não estiver reconciliada.

## Critério de fechamento

A FASE 5 só pode ser marcada como concluída quando:

1. checks obrigatórios estiverem verdes;
2. auditoria de qualidade estiver aprovada — **estado atual: QA REPROVADO para fechamento do gate**;
3. evidências de 5.1–5.10 forem atualizadas no Checklist Mestre;
4. critérios de 5.11 estiverem comprovados;
5. pendências materiais da FASE 4 tiverem sido reconciliadas.

Portanto, este trabalho **não declara WEB READY por antecipação**.
