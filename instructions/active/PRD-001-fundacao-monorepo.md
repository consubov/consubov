# PRD-001 — Fundação do monorepositório

## Status

`IN_REVIEW`

## Objetivo

Reorganizar o Consubov em uma fundação de monorepositório preparada para crescimento, mantendo o visual e os comportamentos funcionais atuais.

## Escopo concluído

- [x] remover dependências/configuração do Lovable;
- [x] padronizar Bun como package manager;
- [x] configurar workspace e Turborepo;
- [x] mover a aplicação atual para `apps/web`;
- [x] reservar `apps/api` sem fingir build/runtime inexistente;
- [x] manter `supabase/` intacto;
- [x] remover scaffolds vazios de `packages/`;
- [x] usar variáveis de ambiente no cliente Supabase;
- [x] preservar aliases, service worker, visual e fluxos existentes;
- [x] documentar estrutura e operação local.

## Estrutura atual

```text
consubov/
├── apps/
│   ├── web/
│   └── api/        # scaffold, sem runtime
├── supabase/
├── docs/
├── instructions/
├── turbo.json
├── package.json
└── bun.lock
```

`packages/` faz parte da arquitetura futura e será criado somente quando houver código compartilhado real.

## Fora de escopo

- redesign;
- novas funcionalidades de negócio;
- migração do Supabase;
- implementação completa da API pública;
- microserviços.

## Critérios de aceite

- [x] instalação limpa com Bun;
- [x] web executa em desenvolvimento;
- [x] build da web funciona;
- [x] testes existentes executáveis;
- [x] autenticação/Supabase preservados;
- [x] offline/service worker preservados;
- [x] aparência equivalente ao estado anterior;
- [x] Lovable removido;
- [x] documentação atualizada;
- [ ] CI do Pull Request confirma build e testes após o hardening final.

## Handoff

`instructions/active/HANDOFF-001-fundacao-monorepo.md`
