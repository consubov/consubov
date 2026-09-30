# PRD-001 — Fundação do monorepositório

## Status

`PLANNED`

## Objetivo

Reorganizar o repositório atual do Consubov em uma fundação de monorepositório preparada para crescimento, mantendo o visual e os comportamentos funcionais atuais.

## Contexto

O projeto atual é uma aplicação React/Vite integrada ao Supabase e originada no Lovable. A partir desta fase, o desenvolvimento será independente do Lovable.

A reorganização deve preparar a base para:

- web;
- API;
- contratos;
- domínio;
- integrações;
- autenticação/autorização;
- documentação OpenAPI futura;
- crescimento de equipe e agentes IA.

## Escopo

### Incluído

- remover dependências e configuração do Lovable;
- padronizar package manager;
- criar workspace de monorepositório;
- introduzir Turborepo;
- mover a aplicação atual para `apps/web`;
- preparar `apps/api`;
- preparar `packages/`;
- manter `supabase/`;
- corrigir referências de build/configuração necessárias;
- manter testes e comportamento atual;
- atualizar documentação.

### Fora de escopo

- redesenho visual;
- novas funcionalidades de negócio;
- reescrita ampla de telas;
- migração do Supabase;
- alteração de regras funcionais;
- implementação completa da API pública;
- microserviços.

## Estrutura alvo inicial

```text
consubov/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── domain/
│   ├── database/
│   ├── auth/
│   ├── contracts/
│   ├── integrations/
│   └── ui/
├── supabase/
├── docs/
└── instructions/
```

## Requisitos

- [ ] branch de trabalho `refactor/monorepo`;
- [ ] Lovable removido do runtime/build/dependências;
- [ ] frontend atual executando em `apps/web`;
- [ ] um único package manager;
- [ ] workspace configurado;
- [ ] Turborepo configurado;
- [ ] build do web funcionando;
- [ ] testes existentes executáveis;
- [ ] aliases e service worker preservados;
- [ ] Supabase preservado;
- [ ] nenhum redesign;
- [ ] nenhum fluxo funcional removido;
- [ ] documentação atualizada.

## Estratégia de execução

Fazer mudanças incrementais e validar a aplicação entre as etapas. Evitar refatorar componentes ou regras de domínio durante a movimentação estrutural.

## Critérios de aceite

- [ ] instalação limpa funciona;
- [ ] comando de desenvolvimento sobe o web;
- [ ] build de produção funciona;
- [ ] testes relevantes passam;
- [ ] rotas principais carregam;
- [ ] autenticação permanece funcional;
- [ ] funcionalidades offline afetadas foram verificadas;
- [ ] aparência permanece equivalente ao estado anterior;
- [ ] nenhuma dependência Lovable permanece;
- [ ] documentação reflete a estrutura final.

## Handoff

`instructions/active/HANDOFF-001-fundacao-monorepo.md`
