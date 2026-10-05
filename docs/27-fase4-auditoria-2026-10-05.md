# FASE 4 — Auditoria de paridade funcional e organização por domínio

> **Estado:** auditoria inicial supersedida pelo fechamento consolidado em `docs/28-fases0-4-fechamento-2026-10-05.md`. Este arquivo permanece como trilha dos achados que motivaram as correções.

## Escopo da auditoria

Baseline auditada: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b` em 2026-10-05, confrontada com o Checklist Mestre, contratos permanentes e código atual.

A FASE 4 **não está concluída**. Esta auditoria remove falsa evidência, corrige regressões objetivas e registra as lacunas que ainda exigem trabalho por domínio.

## Correções objetivas desta rodada

1. remover endpoints de sync `501 Not Implemented` que não existiam no baseline aprovado da FASE 3;
2. remover teste criado apenas para esses endpoints fictícios;
3. remover `useGuardrails.ts`, que retornava `true` para todos os casos e descrevia LWW em domínios onde LWW genérico é proibido;
4. restaurar o setup de testes com `fake-indexeddb/auto`, já dependenciado e usado no baseline aprovado;
5. remover configuração Vitest duplicada do Vite e restaurar o `vitest.config.ts` ao contrato da FASE 3;
6. remover artefatos acidentais detectados na árvore;
7. substituir o teste de hierarquia que mockava o próprio `PastoDetailPage` por teste do componente real com Router e `AuthProvider` reais, mockando a fronteira externa de dados/auth;
8. validar coerência `fazenda -> retiro -> pasto` antes de renderizar a página de pasto;
9. corrigir a documentação de tenancy/hierarquia, que tratava tenant como conta do usuário e afirmava detalhes de UUID sem evidência;
10. manter o parser de QR isolado e adicionar testes unitários de entrada válida e inválida.

## Estado por item do Checklist Mestre

| Item | Estado auditado | Evidência / pendência |
|---|---|---|
| 4.1 Autenticação e navegação | **PENDENTE** | Login, detecção de perfil, redirects, guards e logout existem; recuperação de senha não está evidenciada no Web atual; E2E autenticado por perfis ainda não fecha o item. |
| 4.2 Administração/gerência | **PENDENTE** | Rotas/telas existem no baseline, mas ainda falta validação sistemática de comportamento, responsividade e estados vazio/loading/erro por superfície. |
| 4.3 Estrutura pecuária | **PARCIAL / EM CORREÇÃO** | Fazendas/retiros/pastos/mapas existem. Esta rodada corrige hierarquia inconsistente e documentação. Currais, polígonos/linhas/elementos, IDs e permissões ainda precisam de evidência consolidada. |
| 4.4 QR no Web | **PARCIAL** | Emissão e conferência existem; `extractQrUuid` é usado pela conferência e recebe testes nesta rodada. Ativação/conferência completa e caso de recurso desconhecido ainda precisam de validação de fluxo. QR continua sendo identidade, não autorização. |
| 4.5 Nutrição e salga | **PENDENTE** | Fluxos existem no legado, mas fórmulas, limites e cobertura funcional ainda não estão reconciliados. Fórmula não validada não será alterada. |
| 4.6 Estoque e transferências | **P0/PENDENTE** | Existem writes críticos no cliente. `PastoDetailPage` executa atualização de origem, destino e lançamento em passos separados; falha parcial pode deixar estado inconsistente. Política de concorrência/idempotência/conflito e autoridade server-side ainda precisam de PRD específico. Não introduzir LWW genérico. |
| 4.7 Animais/lotes | **PENDENTE** | Fluxos mapeados; falta consolidar append-only, histórico e rastreabilidade por operação. |
| 4.8 Consultoria/visitas | **PENDENTE** | Fluxos de revisão/finalização/PDF existem; há reabertura/invalidação de PDF no legado, mas a política oficial pós-finalização ainda precisa ser documentada e testada. |
| 4.9 Fábrica de ração | **P0/PENDENTE** | Fluxos existem; fronteiras transacionais, idempotência de batida/baixa e preparação de concorrência ainda não estão fechadas. |
| 4.10 Pecuarista/pesagem | **P0/PENDENTE** | Existem fluxos local-first/offline e histórico; a validação completa do domínio e contratos de pesagem ainda está aberta. Integração genérica com balança continua proibida sem modelo/protocolo. |
| 4.11 Relatórios/inteligência | **PENDENTE** | Dashboards/relatórios existem; falta matriz por indicador com origem, fórmula, período, filtros, tenant, timezone e arredondamento. |
| 4.12 Landing/área pública | **PENDENTE** | Landing/CMS/leads existem. O push anônimo de lead permanece pendência documentada; SEO, abuso de formulário e restante do aceite ainda precisam de evidência. Campanhas continuam congeladas. |
| 4.13 Push/realtime | **PARCIAL** | Hardening de push foi concluído anteriormente; realtime/push estão mapeados. Ainda falta consolidar adapters futuros e provar que realtime não é usado como fonte de integridade nos fluxos em escopo. |
| 4.14 SyncVet | **PENDENTE / CONGELADO** | Rotas e acessos estão mapeados, mas o item exige inventário final, limites claros e backlog pós-produção. Sem expansão funcional. |
| 4.15 Relatto/campanhas/IA | **PENDENTE / CONGELADO** | Fronteiras existentes devem ser inventariadas e preservadas; nenhuma expansão é autorizada nesta fase. |

## Riscos prioritários

### P0 — transferência de animais no cliente

O fluxo atual de `PastoDetailPage` atualiza origem e destino separadamente e depois registra lançamento. Não há transação única no Web. A correção definitiva depende de regra server-side, idempotência, conflito e persistência adequada; não deve ser improvisada nesta rodada.

### P0 — falso guardrail

Um helper que sempre retorna sucesso não protege estoque, pesagem ou fábrica e cria falsa sensação de segurança. Ele deve ser removido até existir uma política real e testável.

### P1 — hierarquia de rota

A página de pasto carregava fazenda, retiro e pasto por IDs independentes e podia compor ancestrais incompatíveis. A correção local valida a cadeia antes de renderizar, sem tratar essa validação como autorização.

### P1 — evidência de teste inválida

O teste de hierarquia mockava o próprio componente e, portanto, não provava comportamento do `PastoDetailPage`. A nova cobertura deve exercitar o componente real.

## Decisões não tomadas

[PENDENTE] recuperação de senha Web: não há fluxo atual comprovado suficiente para inventar implementação.

[PENDENTE] políticas de conflito/idempotência/concorrência de estoque, transferências, fábrica e pesagem: exigem PRDs próprios e decisões de domínio.

[PENDENTE] fórmulas de nutrição/consumo: dependem de validação de especialista.

[PENDENTE] política oficial de edição/versionamento após finalização de visitas.

[PENDENTE] catálogo completo de indicadores e fórmulas de relatórios.

## Gate

A FASE 4 permanece **EM ANDAMENTO**. Nenhum bloco 4.1–4.15 deve ser marcado como concluído apenas porque a tela existe. O fechamento exige evidência funcional, testes, documentação e QA por domínio.

A FASE 5 pode continuar em paralelo apenas por autorização explícita já registrada; o gate `WEB READY` permanece aberto enquanto estas pendências materiais existirem.
