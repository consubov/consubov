# PRD PRE3-2B1 — Materializar TenantExecutionContext

## Objetivo
Fechar o item executável 2B.1 antes da Fase 3, materializando TenantExecutionContext nas fronteiras tenant-scoped sem inventar regras de membership/RBAC e sem alterar o frontend visual.

## Contexto
- main atual: d8428b7a937f547200fc51837af411cee98a104d.
- TenantExecutionContext já existe.
- Checklist aponta lacunas em queries/commands e em files/jobs/events/reporting/sync.
- Membership status adicionais, matriz RBAC e alçadas continuam PENDENTE e não fazem parte deste PRD.

## Escopo
1. Auditar assinaturas e consumidores tenant-scoped em API.
2. Tornar contexto explícito onde houver operação comprovadamente tenant-scoped:
   - files;
   - jobs;
   - events;
   - reporting;
   - sync;
   - queries/commands adicionais encontrados com evidência.
3. Preservar operações genuinamente globais.
4. Adicionar/ajustar testes de contrato e arquitetura.
5. Atualizar docs/15-ports-adapters-fundamentais.md e docs/21-tenancy-rbac-auth-auditoria.md.
6. Produzir relatório final com arquivos alterados, testes e pendências restantes.

## Fora do escopo
- Não definir novos status de membership.
- Não completar matriz RBAC ou alçadas sem evidência.
- Não alterar UI/UX, layout, rotas ou comportamento visual.
- Não conectar Supabase/PostgreSQL remoto.
- Não executar migrations remotas, deploy/Vercel ou rotação de secrets.
- Não implementar provider remoto.
- Não expandir SyncVet, Relatto, campanhas ou IA.

## Critérios de aceite
- Toda fronteira alterada mantém compatibilidade funcional.
- Operações tenant-scoped alteradas exigem contexto explícito ou carregam tenant no envelope com validação equivalente documentada.
- Ausência de tenant não vira bypass implícito.
- Domínio/application continuam provider-agnostic.
- Sem regra de negócio inventada.
- Testes relevantes verdes.
- bun run check verde.
- Edge Functions continuam verdes se afetadas indiretamente.
- Diff revisado e sem mudanças visuais acidentais.

## Testes obrigatórios
- unitários dos ports/adapters afetados;
- testes de arquitetura/camadas;
- testes de contexto tenant ausente/incorreto quando aplicável;
- bun run check;
- smoke da API se houver mudança de superfície HTTP.

## Documentação
Atualizar docs permanentes afetados e registrar explicitamente o que continua PENDENTE.

## QA
Após implementação, revisar contra este PRD e Checklist Mestre. Não declarar concluído com teste vermelho ou evidência incompleta.

## Git
- Trabalhar na main local já sincronizada.
- Commits pequenos e descritivos.
- Não force-push.
- Só executar push após validação completa.
- Não criar branch novo.

## Ações proibidas
- banco remoto;
- migrations remotas;
- deploy;
- Vercel;
- secrets;
- mudanças destrutivas;
- refactor visual.

## Relatório final esperado
- resumo;
- arquivos alterados;
- testes executados e resultados;
- itens do checklist atendidos;
- riscos/pendências;
- SHA do commit;
- confirmação de push.
