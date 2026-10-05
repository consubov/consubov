# PRD-F04-AUDIT — Auditoria e remediação da FASE 4 Web

## 1. Objetivo
Auditar integralmente a FASE 4 do Checklist Mestre do CONSUBOV contra o código real da `main`, corrigir regressões objetivas introduzidas durante o início da fase e registrar, sem inferência, o que permanece pendente antes de qualquer marcação de conclusão.

## 2. Contexto
- Base auditada: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b`.
- FASE 3: concluída e integrada.
- FASE 4: em andamento no Notion; nenhum item 4.1–4.15 está concluído.
- FASE 5: em paralelo no PR #35; QA continua reprovado para WEB READY enquanto a FASE 4 não for reconciliada.
- A nova arquitetura continua proibida de conectar Supabase/PostgreSQL remoto, Vercel ou migrations remotas.

## 3. Escopo
### Incluído
- confrontar os itens 4.1–4.15 com rotas, hooks, páginas, testes e documentação existentes;
- remover artefatos acidentais e código/testes que dão falsa evidência;
- remover endpoints de sync inventados/placeholder não aprovados;
- restaurar setup Vitest/IndexedDB ao último baseline comprovado da FASE 3;
- corrigir documentação incorreta sobre tenant/hierarquia;
- corrigir o teste de hierarquia para renderizar o componente real com Router e `AuthProvider`, mockando apenas fronteiras externas;
- validar a coerência fazenda → retiro → pasto na navegação Web sem tratar isso como autorização server-side;
- consolidar parser de QR e testes unitários de QR válido/inválido;
- produzir auditoria permanente da FASE 4 com pendências reais;
- atualizar Checklist Mestre no Notion com o resultado da auditoria.

### Fora do escopo
- concluir por inferência todos os itens 4.1–4.15;
- reescrever acesso legado ao Supabase em massa;
- retomar a Issue #5 inteira;
- conectar banco/storage/auth remoto novo;
- migrations/schema remoto;
- Vercel/deploy/release;
- definir fórmulas zootécnicas;
- inventar políticas de conflito, sessão offline, RBAC ou integração de balança;
- expandir SyncVet, Relatto, campanhas ou IA.

## 4. Arquivos/áreas esperadas
- `apps/api/src/routes.ts`;
- testes acidentais de rotas de sync;
- `apps/web/src/test/setup.ts`;
- `apps/web/vite.config.ts` e `apps/web/vitest.config.ts` somente para restaurar baseline comprovado;
- `apps/web/src/pages/PastoDetailPage.tsx`;
- `apps/web/src/test/pages/PastoDetailPage.test.tsx`;
- `apps/web/src/lib/qrUtils.ts` e testes;
- `docs/`;
- `instructions/active/`;
- artefatos acidentais detectados na raiz/testes.

## 5. Regras de segurança
- frontend não é autoridade de autorização;
- validação de hierarquia de rota é consistência/UX, não substitui tenant/RBAC no backend;
- nenhuma credencial real;
- nenhum relaxamento de auth/RBAC/tenant isolation;
- estoque, transferências e pesagens não recebem LWW genérico;
- nenhum guardrail fake que sempre retorna sucesso;
- nenhuma regra de negócio não comprovada.

## 6. Critérios de aceite
- [ ] nenhum endpoint novo fictício de sync permanece publicado;
- [ ] nenhum helper de guardrail fake/no-op permanece como falsa proteção;
- [ ] teste de PastoDetailPage usa componente real, Router real e AuthProvider real;
- [ ] teste detecta hierarquia válida e ancestral inconsistente;
- [ ] documentação não trata tenant como conta do usuário nem como fazenda;
- [ ] documentação não inventa UUID/versionamento/provider;
- [ ] parser QR possui testes de entrada válida e inválida;
- [ ] setup IndexedDB usa o polyfill já dependenciado e comprovado;
- [ ] artefatos acidentais detectados são removidos;
- [ ] relatório 4.1–4.15 separa evidência de pendência;
- [ ] `bun run check` verde no branch;
- [ ] CI/security verdes;
- [ ] QA final executado no track AUDITORIA DE QUALIDADE.

## 7. Testes obrigatórios
- testes unitários do parser QR;
- teste de integração de hierarquia com `MemoryRouter/Routes/Route` + `AuthProvider`;
- caso de ancestralidade inconsistente;
- suíte Web completa;
- suíte API completa;
- typecheck/build;
- gates existentes do repositório;
- repetir após qualquer integração com `main`.

## 8. Validações obrigatórias
- revisar diff;
- confirmar ausência de segredo/PII/debug/arquivo acidental;
- confirmar que PR #35 não foi sobrescrito;
- confirmar que nenhuma conexão remota foi criada;
- comparar novamente com Checklist Mestre.

## 9. Documentação a atualizar
- documento permanente de auditoria FASE 4;
- documento de hierarquia/tenancy incorreto;
- `docs/README.md` quando aplicável;
- Checklist Mestre no Notion;
- handoff da FASE 4;
- Handoff global somente após estado estabilizado/mergeado.

## 10. Ações proibidas
- merge automático;
- force push/reset hard;
- deploy/release;
- migration/schema remoto;
- rotação de secrets;
- conexão da nova API ao Supabase/PostgreSQL remoto;
- marcar item da FASE 4 como concluído sem evidência;
- inventar comportamento para preencher checklist.

## 11. Convivência com outros agentes
- PR #35 da FASE 5 está em paralelo e parte de base anterior;
- não sobrescrever seus arquivos silenciosamente;
- após esta correção, a linha da FASE 5 deverá reconciliar a nova `main` e repetir gates;
- Issue #5 permanece pausada salvo mudança explícita do responsável.

## 12. Gate de QA
Track: `AUDITORIA DE QUALIDADE`.

Resultado permitido:
- `QA: APROVADO`; ou
- `QA: REPROVADO`.

Se reprovado: corrigir, repetir testes e repetir QA. Não declarar FASE 4 concluída enquanto houver reprovação ou pendência material.

## 13. Regras de Git
- branch: `fix/fase4-audit-20261005`;
- base: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b`;
- commits pequenos/coerentes;
- sem merge automático;
- preservar trabalho paralelo;
- revisão final de diff obrigatória.

## 14. Relatório final obrigatório
- resultado da auditoria 4.1–4.15;
- correções aplicadas;
- testes executados e evidência;
- QA;
- riscos/pendências;
- estado do Notion;
- branch/PR/SHAs;
- impacto sobre PR #35;
- próximo passo;
- HANDOFF: SIM/NÃO.

## 15. Evidência inicial que motivou a remediação
Foram observados na `main`:
- teste de PastoDetailPage que mocka o próprio componente;
- arquivo de teste duplicado com caractere `\`` no nome;
- `useGuardrails.ts` retornando `true` e descrevendo LWW em domínios críticos;
- documento de hierarquia chamando tenant de conta de usuário e afirmando UUIDv13;
- endpoints de sync 501 não aprovados;
- setup IndexedDB substituído por stubs manuais apesar de `fake-indexeddb` já estar disponível;
- arquivos/entradas acidentais como `placeholder.txt`, `.root.env.test` e `superpowers`.

## 16. Prompt de execução
Audite e corrija somente fatos comprovados pelo código e Checklist Mestre. Preserve comportamento legado quando não houver evidência para mudar regra de negócio. Remova falsa evidência, mocks que testam o próprio mock, placeholders não aprovados e documentação inventada. Não toque infraestrutura remota. Só marque checklist com evidência real.
