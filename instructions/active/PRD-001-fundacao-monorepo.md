# PRD-001 — Fundação do monorepositório

## Status

`IN_PROGRESS`

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

- [x] branch de trabalho `refactor/monorepo`;
- [x] Lovable removido do runtime/build/dependências;
- [x] frontend atual executando em `apps/web`;
- [x] um único package manager;
- [x] workspace configurado;
- [x] Turborepo configurado;
- [x] build do web funcionando;
- [x] testes existentes executáveis;
- [x] aliases e service worker preservados;
- [x] Supabase preservado;
- [x] nenhum redesign;
- [x] nenhum fluxo funcional removido;
- [ ] documentação atualizada.

## Estratégia de execução

Fazer mudanças incrementais e validar a aplicação entre as etapas. Evitar refatorar componentes ou regras de domínio durante a movimentação estrutural.

## Critérios de aceite

- [x] instalação limpa funciona;
- [x] comando de desenvolvimento sobe o web;
- [x] build de produção funciona;
- [ ] testes relevantes passam (33/36 — 3 timeouts PDF pré-existentes);
- [x] rotas principais carregam;
- [x] autenticação permanece funcional;
- [x] funcionalidades offline afetadas foram verificadas;
- [x] aparência permanece equivalente ao estado anterior;
- [x] nenhuma dependência Lovable permanece;
- [ ] documentação reflete a estrutura final.

## Handoff

`instructions/active/HANDOFF-001-fundacao-monorepo.md`
