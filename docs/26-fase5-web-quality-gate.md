# FASE 5 — Gate de qualidade da Web

> Status em 2026-10-04: **EM ANDAMENTO**.
>
> Linha de trabalho: `quality/fase5-web-gate-20261004`, empilhada sobre `fix/fase3-audit-20261004`.

## Objetivo

Criar evidência reproduzível de qualidade para a Web/API antes do gate `WEB READY`, preservando o legado em operação e sem antecipar infraestrutura remota.

## Gates materializados

- `bun run check` continua cobrindo typecheck/build/test dos workspaces que expõem esses scripts;
- o workspace Web agora expõe `typecheck` explicitamente;
- Playwright foi separado do diretório de testes Vitest;
- smoke E2E local cobre:
  - renderização da tela de login;
  - negação de rota protegida sem sessão;
  - 404 recuperável;
  - navegação da landing para login;
  - projetos Chromium desktop e mobile;
- lint legado pode ser medido por `lint:baseline`;
- arquivos Web alterados passam por `lint:changed`, evitando ampliar dívida sem exigir um mega-refactor;
- o build Web gera um relatório reproduzível de tamanho bruto/gzip de JS/CSS via `report:bundle`;
- CI de pull request também executa em PRs empilhados, não apenas quando a base é `main`;
- Edge Functions e smoke HTTP da API permanecem no pipeline.

## Segurança

Os testes E2E usam URL/chave locais de teste. Não há credencial real de usuário, conexão do novo backend a banco remoto, migration, Vercel ou deploy.

A negação de rota sem sessão é validada no browser, mas isso **não substitui** os testes server-side de autorização/tenant.

## Baselines e pendências

### Lint

O comando `lint:baseline` mede a dívida existente e não a transforma automaticamente em falha global. `lint:changed` é o gate incremental para arquivos Web alterados.

[PENDENTE] registrar a contagem exata da dívida somente após execução comprovada no CI/local.

### Coverage

[PENDENTE] o repositório ainda não possui provider de coverage configurado no lockfile. Não foi adicionada meta arbitrária nem dependência nova apenas para satisfazer o checklist.

### E2E autenticado

[PENDENTE] fluxos autenticados de domínio exigem estratégia de fixtures/identidades controladas. Não usar credenciais reais de produção para E2E.

### Performance

O relatório de bundle cria baseline local reproduzível.

[PENDENTE] números exatos do baseline após execução comprovada; Lighthouse/Core Web Vitals em dispositivo modesto continuam pendentes.

### Acessibilidade

[PENDENTE] axe/Lighthouse a11y e auditoria completa de teclado/foco/contraste/formulários.

### Responsividade

O smoke roda em desktop e perfil mobile Chromium para superfícies públicas/proteção de rota.

[PENDENTE] homologação completa dos dashboards, tabelas, formulários, mapas, modais e PDFs.

## Critério de fechamento

A FASE 5 só pode ser marcada como concluída quando:

1. checks obrigatórios estiverem verdes;
2. auditoria de qualidade estiver aprovada;
3. evidências de 5.1–5.10 forem atualizadas no Checklist Mestre;
4. critérios de 5.11 estiverem comprovados;
5. pendências das FASES 3 e 4 que bloqueiam o Web Gate tiverem sido reconciliadas.

Portanto, este trabalho **não declara WEB READY por antecipação**.
