# PRD — Fechamento consolidado da FASE 2

## Objetivo
Concluir de uma única vez as pendências arquiteturais da FASE 2/2A/2B sem alterar o frontend, sem conectar infraestrutura remota e sem inventar permissões ou regras de negócio.

## Escopo
- Fechar o contrato de timezone de tenant/relatórios sem escolher um timezone padrão arbitrário.
- Fechar o gate da API pública futura mantendo-a desabilitada até existir primeiro consumidor real.
- Consolidar membership atual com único status canônico comprovado: ACTIVE.
- Fechar TenantExecutionContext em queries/commands por contrato e completar a fronteira de sync.
- Formalizar RBAC como matriz evidence-first com autorização deny-by-default para células não aprovadas.
- Formalizar alçadas conhecidas e negar por padrão o que não possui decisão/evidência.
- Atualizar documentação permanente da FASE 2.
- Executar suíte completa e QA antes de commit/push.

## Fora do escopo
- Alterar layout, UX, rotas ou comportamento do frontend.
- Criar novas permissões ALLOW sem evidência.
- Inventar status de membership.
- Definir timezone comercial/padrão por suposição.
- Publicar API externa.
- Conectar Supabase/PostgreSQL remoto.
- Executar migrations remotas.
- Configurar Vercel/deploy.
- Rotacionar ou alterar secrets.

## Implementação esperada
1. Timezone
   - Criar contrato de timezone IANA explícito para tenant/relatórios.
   - Tenant pode estar sem timezone configurado nesta fase; relatórios que dependam de período civil devem exigir resolução explícita antes do cálculo.
   - Nenhum fallback silencioso por timezone do browser ou valor arbitrário.

2. API pública
   - Registrar política atual: exposição pública desabilitada e mecanismo de credencial ainda não configurado.
   - Manter credentialReference opaca e lifecycle já existente.
   - Nenhum endpoint público real.

3. Tenancy
   - Manter MembershipStatus somente ACTIVE.
   - Definir wrappers tipados para query/command tenant-scoped.
   - Completar SyncQueueReader/Writer/SyncTransport com TenantExecutionContext.
   - Cache/realtime permanecem sem adapter concreto; qualquer implementação futura deverá exigir contexto explícito.

4. RBAC
   - Manter matriz completa de perfis x recursos.
   - PENDENTE/DENY/N/A nunca autorizam.
   - Somente ALLOW explicitamente aprovado pode autorizar.
   - Não usar frontend como evidência de autorização.

5. Alçadas
   - Modelar ações do checklist.
   - create-user/manage-admin: exigir administrador conforme evidência atual.
   - demais ações sem decisão: DENY_UNTIL_APPROVED.
   - contrato não deve alterar comportamento do frontend legado.

## Critérios de aceite
- Nenhum arquivo funcional do frontend alterado.
- Nenhum novo ALLOW inventado.
- Nenhum timezone padrão arbitrário.
- API pública permanece desabilitada.
- Sync transport/queue exige TenantExecutionContext.
- Query/command tenant-scoped possui contrato explícito.
- RBAC não autoriza PENDENTE.
- Alçadas sem evidência ficam deny-by-default.
- Membership continua apenas ACTIVE.
- Documentação da FASE 2 reconciliada com o código.
- bun run check verde.
- git diff revisado sem segredo, PII, debug ou arquivo acidental.

## Testes obrigatórios
- bun test apps/api/src/modules/identity-tenancy
- bun test apps/api/src/modules/sync
- bun run check

## Documentação
Atualizar:
- docs/18-identificadores-tempo.md
- docs/20-extensibilidade-api-integracoes.md
- docs/21-tenancy-rbac-auth-auditoria.md
- docs/15-ports-adapters-fundamentais.md se necessário.

## QA
- Revisar código e documentação contra este PRD.
- Não considerar concluído se qualquer teste falhar.
- Confirmar que o frontend não foi alterado.

## Regras de Git
- Trabalhar na main.
- Não criar branch.
- Commit atômico.
- Push somente após QA aprovado.
- Sem force-push.

## Ações proibidas
- Infraestrutura remota.
- Deploy.
- Migration remota.
- Alteração visual.
- Regra de negócio inventada.
- Permissão ALLOW inferida de menu/rota.
- Expor segredo ou credencial material.

## Relatório final esperado
- Arquivos alterados.
- Pendências convertidas em contrato/gate.
- Testes executados e resultado.
- SHA do commit.
- Confirmação de push.
- Confirmação de que a FASE 2 pode ser marcada como concluída no Checklist Mestre.
