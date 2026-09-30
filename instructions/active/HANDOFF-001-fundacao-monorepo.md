# HANDOFF-001 — Fundação do monorepositório

## PRD relacionado

`PRD-001-fundacao-monorepo.md`

## Estado atual

Branch `refactor/monorepo` criada a partir de `main`.

A documentação permanente e a estrutura de instruções para agentes foram criadas antes da reorganização do código.

Nenhuma funcionalidade da aplicação deve ser alterada nesta fase.

## Decisões já aprovadas

- monorepositório para organizar aplicações e pacotes;
- backend como monólito modular;
- Vercel como deploy inicial;
- Supabase/PostgreSQL mantido nesta fase;
- API futura versionada em `/api/v1`;
- OpenAPI como contrato;
- portal de API próprio da Consubov;
- remoção total das dependências Lovable;
- preservação do visual atual;
- código pequeno, legível e bem documentado;
- `main` permanece branch oficial após conclusão.

## Restrições críticas

- não redesenhar telas;
- não remover fluxos existentes;
- não corrigir regra de negócio desconhecida por suposição;
- funcionalidades atualmente incompletas podem permanecer frontend-only;
- não misturar novas features com a reorganização estrutural.

## Próximo passo exato

1. registrar baseline do projeto atual;
2. remover dependências/configuração Lovable;
3. escolher e fixar um único package manager;
4. criar workspace + Turborepo;
5. mover aplicação para `apps/web`;
6. validar build, testes e execução;
7. somente depois preparar os demais pacotes.

## Validações pendentes

- [ ] baseline documentado;
- [ ] instalação limpa;
- [ ] build;
- [ ] lint;
- [ ] testes;
- [ ] aplicação local;
- [ ] autenticação;
- [ ] Supabase;
- [ ] offline/sync quando afetados;
- [ ] comparação visual.

## Regra de encerramento

Após implementação, validação e aceite, mover qualquer conhecimento permanente para `docs/` e apagar este handoff e o PRD correspondente.
