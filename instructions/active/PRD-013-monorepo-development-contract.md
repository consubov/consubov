# PRD-013 — Contrato de desenvolvimento do monorepositório

## Status

`READY FOR REVIEW`

## Objetivo

Consolidar um único contrato local e de CI para validar o monorepositório, mantendo o smoke HTTP real da API e documentando fielmente o ambiente reproduzível.

## Contexto

A Fase 1 consolidou os scripts raiz e o TypeScript local da API. A auditoria desta fase encontrou o CI ainda chamando o `lint` da API diretamente, embora a raiz já exponha `typecheck`, e não encontrou um comando agregado para a sequência de validações estáticas. O smoke HTTP existente é local e completo. O devcontainer já usa Bun 1.3.12, instalação congelada e as portas corretas.

## Escopo

### Incluído

- scripts de validação no manifesto raiz;
- CI baseado nos scripts raiz;
- documentação permanente dos comandos e do contrato de CI;
- remoção de resíduos inequívocos em `.npmrc` e `.gitignore`;
- PRD e handoff temporários desta fase.

### Fora de escopo

- código funcional de `apps/web/src` ou `apps/api/src`;
- Supabase, migrations, banco remoto, Vercel ou secrets;
- correção ou ocultação da dívida de lint do web;
- dependências de runtime e configuração compartilhada nova.

## Inventário da auditoria

- o CI instala com lockfile congelado, compila, testa e executa smoke HTTP somente em loopback;
- o typecheck da API está coberto indiretamente por um passo ad hoc executado dentro de `apps/api`, em vez do contrato raiz;
- o devcontainer já corresponde a Bun 1.3.12 e às portas 3000/8080;
- `packageManager` existe apenas na raiz e não há conflito de versão;
- o grafo do Turbo descreve tarefas reais; não há justificativa para alterá-lo;
- `.npmrc` contém somente `package-manager=bun`, duplicando o manifesto sem configurar instalação;
- `.gitignore` contém uma regra para `packages/*/dist`, embora `packages/` não exista por decisão arquitetural;
- a documentação ainda descreve o passo antigo de lint/typecheck específico da API.

## Requisitos

- [x] disponibilizar comando raiz agregado para typecheck, build e testes;
- [x] fazer o CI consumir o comando raiz de typecheck, sem falso verde de lint;
- [x] preservar o smoke HTTP real e exclusivamente local;
- [x] manter o devcontainer e `turbo.json` inalterados quando a auditoria não justificar mudança;
- [x] alinhar README e documentação permanente ao contrato executável.

## Restrições

- preservar comportamento e visual existentes;
- não executar migrations nem acessar serviços remotos;
- não usar `bunx` nem baixar tooling durante validações;
- não mudar a semântica individual de build ou testes.

## Plano aprovado

1. Registrar inventário e decisões neste PRD/handoff.
2. Adicionar o comando agregado raiz e alinhar o CI aos scripts raiz.
3. Atualizar documentação permanente e remover apenas resíduos inequívocos.
4. Executar todas as validações exigidas e comprovar que árvores proibidas não mudaram.

## Critérios de aceite

- [x] instalação congelada, typecheck, build, testes e smoke local passam;
- [x] YAML e JSON tocados são válidos;
- [x] `apps/web/src`, `apps/api/src` e `supabase/` permanecem idênticos ao baseline;
- [x] nenhuma credencial ou chamada remota é introduzida;
- [x] documentação permanente corresponde ao CI.

## Validação manual

Não há alteração visual ou funcional a validar manualmente. Conferir os comandos documentados contra `package.json` e `.github/workflows/ci.yml`.

## Riscos

- agregar validações pode esconder qual etapa falhou; os comandos continuam disponíveis isoladamente e o shell encerra na primeira falha;
- o lint completo do web permanece vermelho e deve continuar explicitamente fora do contrato verde.

## Handoff

Arquivo: `HANDOFF-013-monorepo-development-contract.md`
