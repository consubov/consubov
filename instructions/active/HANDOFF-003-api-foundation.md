# HANDOFF-003 — Fundação local da API

## PRD relacionado

`PRD-003-api-foundation.md`

## Branch

`feat/api-foundation`

## Estado atual

A branch foi criada a partir da `main` após a conclusão da fundação GitHub Free/Codespaces.

`apps/api` ainda é um scaffold sem runtime.

## Restrições

- sem Supabase remoto;
- sem banco;
- sem Vercel;
- sem alteração do web;
- sem regras de negócio novas;
- sem merge automático.

## Próxima ação do executor

1. ler `AGENTS.md`;
2. ler `docs/README.md`;
3. ler este PRD/handoff;
4. inspecionar `apps/api`, root `package.json`, `turbo.json` e versão instalada do Turborepo;
5. implementar o menor runtime local que cumpra o PRD;
6. executar instalação, build e testes;
7. atualizar este handoff com:
   - dependências adicionadas e justificativa;
   - estrutura criada;
   - contratos;
   - comandos executados;
   - resultados;
   - riscos/pendências;
8. abrir PR para `main`;
9. parar para revisão.

## Observação operacional

A tentativa de controlar o Codex Cloud pelo Browser MTS no chat fornecido falhou por timeout WebSocket do próprio Browser MTS. Nenhum código da API foi alterado por esse motivo. Este PRD deixa o trabalho pronto e rastreável para o executor assim que a sessão do navegador estiver acessível.
