# FASE 5 — Web Quality / WEB READY

> Estado: **EM ANDAMENTO — QA REPROVADO TEMPORARIAMENTE PARA FECHAMENTO** em 2026-10-05.
>
> Base: `main@bd9ad453424fa9ad220dca4f55626762a26b87f2`.
>
> Branch: `quality/fase5-web-ready-20261005`.
>
> PR: #37 (draft).

## Objetivo

Fechar o gate de qualidade da Web/API sobre a `main` consolidada, sem conectar banco remoto, executar migrations, configurar Vercel ou fazer deploy.

## Implementado

### Testes e integração

- `bun run check` permanece o gate agregado de typecheck, build e testes;
- E2E local cobre os nove papéis conhecidos, redirects, acesso negado, logout e superfícies críticas de estrutura, QR, nutrição, transferência, visita, fábrica, pesagem e relatórios;
- Playwright possui projetos Chromium desktop, tablet 768x1024 e mobile;
- smoke responsivo inclui dashboards e superfícies de tabelas/formulários administrativas;
- `apps/api/src/integration/phase5-boundaries.test.ts` compõe identity verifier → tenant context → authorization → repository fake;
- integração cobre tenant mismatch, missing scope e invariantes de writes críticos sem conectar persistência remota.

Transação/rollback reais permanecem N/A nesta fase porque não existe adapter transacional autoritativo. Inventar uma transação antes da FASE 8 quebraria o escopo.

### Lint e coverage

- `lint:baseline` mantém a dívida histórica visível;
- `lint:changed` bloqueia nova dívida nos arquivos Web alterados;
- `test:coverage` foi ajustado para `--all` + fontes `src/**/*.ts(x)`;
- `check:coverage-baseline` compara o número de arquivos-fonte esperados com o coverage summary e rejeita relatório parcial.

O resultado antigo de coverage (**100% de apenas 6 statements**) foi descartado como não representativo. Nenhuma meta percentual foi inventada antes de um baseline válido.

### Performance

Rotas usam `React.lazy` + `Suspense`, eliminando o antigo chunk monolítico como ponto único de carregamento.

Último baseline executado após route splitting:

- JS/CSS total: **8.730.802 bytes raw**;
- total gzip: **2.735.799 bytes**;
- maior asset: **2.849.003 bytes raw** (Landing);
- bundle budget versionado valida total raw, total gzip e maior asset.

Lighthouse agora registra performance/accessibility/best-practices/SEO e também LCP, CLS e TBT (proxy de responsividade de laboratório). INP real não é inventado em ambiente local sem tráfego/usuário real.

### Segurança Web/API

- respostas da nova API aplicam `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e `Permissions-Policy`;
- contratos HTTP testam headers, 404/500, request/correlation IDs e ausência de stack/detalhe interno;
- inventário de rotas é obrigado a permanecer em paridade com OpenAPI;
- rotas admin continuam deny-by-default;
- a API atual não expõe endpoint HTTP de escrita de domínio; rate-limit real permanece ligado à futura superfície de abuso, enquanto a política já está documentada no OpenAPI;
- nenhum CORS permissivo foi adicionado;
- bundle construído possui guarda contra padrões de segredos administrativos;
- nenhum segredo real foi adicionado.

### Observabilidade

`ConsoleTelemetryAdapter` implementa o `TelemetryPort` vendor-neutral com:

- JSON estruturado;
- níveis `debug | info | warn | error`;
- eventos, métricas e erros;
- sanitização recursiva de authorization, cookies, senhas, tokens, service-role, e-mail, CPF/CNPJ e dados de cartão/CVV;
- sanitização de bearer token, e-mail e chave privada embutidos em strings.

Nenhum backend pago/remoto foi introduzido.

### Acessibilidade e responsividade

- controles críticos do Admin possuem nomes acessíveis;
- teclado/labels/tipos de campo fazem parte do smoke;
- desktop/tablet/mobile fazem parte do mesmo gate;
- axe está configurado para landing, login e recuperação;
- Lighthouse accessibility está configurado;
- a coleta de axe/Lighthouse foi movida para antes do E2E, permitindo obter baseline mesmo se um fluxo E2E posterior falhar.

## Evidência executável mais recente antes do bloqueio externo

No último job desta branch que realmente recebeu runner e iniciou steps:

- `bun run check`: verde;
- Web: **129 testes / 34 arquivos**;
- lint baseline + lint changed: verdes;
- bundle report: executado;
- dist secret guard: verde;
- bundle medido com os valores acima;
- E2E: **30 passaram / 18 falharam**.

As falhas foram localizadas em dois grupos:

1. configuração do projeto tablet, que fazia todos os testes tablet falharem;
2. seletor/acessibilidade do logout.

Ambos foram corrigidos posteriormente (tablet explícito 768x1024 e botão `Sair` com nome acessível), mas ainda não existe execução final desses commits porque o runner deixou de iniciar jobs.

## Diagnóstico do GitHub Actions

Foi criado temporariamente um workflow mínimo usando `ubuntu-22.04` e apenas `echo "runner-ok"`.

Resultado: esse job mínimo também terminou em failure **sem qualquer step iniciado**, exatamente como CI, SAST, dependency scan e secret scanning. O workflow diagnóstico foi removido imediatamente depois.

Isso comprova que o bloqueio atual não depende de:

- Bun;
- Playwright;
- código do CONSUBOV;
- `ubuntu-latest`;
- comandos do workflow principal.

O bloqueio ocorre antes da execução do runner. O conector disponível não expõe configurações de cobrança/permissões da conta, então a causa administrativa exata não pode ser alterada a partir deste trabalho.

## Pendências que ainda bloqueiam WEB READY

1. GitHub Actions voltar a iniciar steps;
2. executar o HEAD final;
3. validar o novo coverage e registrar baseline real;
4. definir gate progressivo de coverage a partir desse baseline;
5. obter axe/Lighthouse válidos e corrigir eventual bloqueador;
6. confirmar E2E corrigido verde em desktop/tablet/mobile;
7. confirmar Edge/API smoke + security scans verdes;
8. repetir `AUDITORIA DE QUALIDADE`.

## Gate

`WEB READY` permanece **ABERTO**.

Não há evidência suficiente para marcar a FASE 5 concluída enquanto o runner não executar o HEAD final.
