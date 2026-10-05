# FASE 5 — Gate de qualidade da Web

> Status em 2026-10-05: **EM ANDAMENTO — QA REPROVADO PARA FECHAMENTO**.
>
> Branch: `quality/fase5-web-gate-main-20261004`.
>
> PR: **#35**.
>
> HEAD validado: `08e8fa27139b2af4d1885d80cb8762a9608ee64e`.

## Objetivo

Criar evidência reproduzível de qualidade para a Web/API antes do gate `WEB READY`, sem antecipar infraestrutura remota.

## Gates implementados

- `bun run check` preservado como gate agregado;
- Web expõe `typecheck` explicitamente;
- Playwright separado de Vitest;
- smoke E2E local cobre login renderizado, rota protegida sem sessão, 404 e landing;
- smoke básico de acessibilidade cobre nomes/tipos dos campos do login, ordem de foco por teclado e ativação do login por teclado;
- login/landing validam ausência de overflow horizontal;
- projetos Chromium desktop/mobile;
- `lint:baseline` mede a dívida existente;
- `lint:changed` impede novos erros de lint nos arquivos Web alterados;
- `report:bundle` gera baseline bruto/gzip do build;
- `check:bundle-budget` impede regressão do total raw e usa tolerância mínima de 1.024 bytes no gzip para absorver variação de compressão do build dinâmico;
- `check:dist-secrets` inspeciona o bundle construído contra padrões administrativos/segredos conhecidos;
- CI executa em pull requests;
- Edge Functions tests e smoke HTTP da API permanecem no pipeline;
- Security Code Scan continua como workflow separado.

## Evidência medida no CI

No HEAD `08e8fa27139b2af4d1885d80cb8762a9608ee64e`:

- API/Bun: **532 testes aprovados**, **0 falhas**, em **74 arquivos**;
- Web/Vitest: **111 testes aprovados**, em **29 arquivos**;
- Playwright smoke/a11y público: **12/12 aprovados** em Chromium desktop/mobile;
- Edge Functions/Vitest: **122 testes aprovados**, em **9 arquivos**;
- smoke HTTP da API: aprovado;
- typecheck Web/API: aprovado;
- build Web/API: aprovado;
- budget regressivo do bundle: aprovado;
- guarda de padrões de segredo no `dist/`: aprovado;
- SAST: aprovado;
- dependency vulnerability scan: aprovado;
- secret scanning: aprovado.

O conjunto existente inclui contratos de erro HTTP/OpenAPI, deny-by-default administrativo, regras de tenancy/RBAC, domínio e regressões Web. Isso é baseline; não significa que todos os fluxos funcionais da FASE 5.3 estejam cobertos por E2E.

## Lint

Baseline medido no ciclo atual:

- **438** arquivos analisados;
- **227** arquivos com findings;
- **1.415** erros;
- **108** warnings.

A dívida é pré-existente. O CI usa `lint:changed` como barreira incremental e mantém o baseline global visível.

## Bundle e performance

Baseline observado no ciclo atual:

- **17** arquivos JS/CSS;
- **8.611.805 bytes** raw;
- **2.533.540 bytes** gzip no build validado;
- budget raw: **8.611.805 bytes**;
- baseline gzip de referência: **2.533.532 bytes**, com tolerância técnica de **1.024 bytes**;
- maior chunk: `index-*.js` com aproximadamente **8,18 MB raw / 2,40 MB gzip**.

O budget é um **gate anti-regressão**, não aprovação do tamanho atual. O chunk principal continua materialmente grande e deve ser tratado antes do fechamento de performance.

O build também reporta módulos usados simultaneamente por import estático e dinâmico, incluindo `@zxing/browser` e módulos locais de offline/Penn State. A busca anterior não reproduziu uso direto de `eval(` ou `new Function` em `apps/web/src`.

## Segurança

Os testes E2E usam somente URL/chave locais de teste. Não há credencial real de usuário, conexão do novo backend a banco remoto, migration, Vercel ou deploy.

A proteção de rota no browser é evidência de UX/guard e **não substitui** autorização e isolamento server-side.

O gate `check:dist-secrets` procura no bundle construído nomes/padrões administrativos conhecidos, incluindo service-role keys, marcadores de chave privada e tokens críticos. Ele complementa — não substitui — secret scanning e revisão de segurança.

## Acessibilidade e responsividade

Existe baseline automatizado **parcial**:

- labels/tipos de e-mail e senha no login;
- sequência de foco por teclado no login;
- ativação do link de login por teclado;
- ausência de overflow horizontal em login e landing;
- execução em Chromium desktop e mobile.

Continuam pendentes axe, contraste, modais/dialogs, estados de erro, Lighthouse accessibility e homologação dos fluxos autenticados.

## Pendências que mantêm o gate aberto

### Coverage

[PENDENTE] O Web/Vitest ainda não possui provider de coverage configurado como dependência direta/gate reproduzível. Não foi inventada meta percentual sem baseline.

### E2E funcional autenticado

[PENDENTE] A FASE 5.3 exige fluxos autenticados de domínio (logout, perfis, estrutura pecuária, QR, nutrição, estoque, transferência, visitas, fábrica, pesagem, relatórios, permissão e tenant mismatch). Esses fluxos exigem fixtures/identidades de teste controladas e não devem usar credenciais reais.

### Performance

Ainda faltam Lighthouse/Core Web Vitals, medição em dispositivo modesto e correção/decisão sobre o chunk principal de ~8,18 MB e imports que impedem divisão efetiva.

### Acessibilidade

[PENDENTE] axe/Lighthouse accessibility e auditoria completa dos fluxos autenticados.

### Responsividade

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
