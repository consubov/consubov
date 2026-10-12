# FASE 11 — Auditoria, PRD e handoff de perfis e hierarquia

**Data da auditoria documental:** 2026-10-12. **Projeto:** CONSUBOV. **Status:** PLANEJADA; implementação NÃO iniciada; QA NÃO executado. **Branch analisada:** work/fase5-6-7-pwa-local (PR #43). **Destino no roadmap:** após FASE 10, sem bloqueio automático para análise ou trabalhos independentes; iniciar alterações só com escopo/compatibilidade e QA acordados.

## 1. Objetivo e decisão de produto

Evoluir a gestão de perfis de pessoas, proprietários, gerentes, capatazes, fazendas e seus vínculos, preservando o sistema existente, histórico, rotas e operações offline. **Proprietário do cliente não é administrador global da plataforma.** A organização (tenant) pode ter múltiplas fazendas; fazenda pode ter múltiplos gerentes e retiros; um capataz pode atuar em múltiplos retiros e fazendas autorizados ao longo da carreira. Não assumir que tenant = fazenda.

Nesta fase, PLANEJAR: cadastro/edição e foto dos perfis; CPF do capataz; hierarquia de gestão; histórico/currículo e ranking; login Google como caminho de acesso; exportação PDF; inativação/desvinculação sem exclusão física por UI. **Não implementar agora.**

**Fora da FASE 11:** remediação de RLS/Edge Functions, revisão geral de segurança da plataforma, mudanças de banco remoto, migrations, alteração de credenciais/providers, deploy, CI hospedado, substituição de stack, SyncVet/Relatto/IA, criação de scores zootécnicos inventados. O planejamento de permissões funcionais faz parte da feature; a remediação de segurança preexistente pertence às fases correspondentes e não deve ser contabilizada como FASE 11.

## 2. Metodologia e limite da auditoria

Inspeção SOMENTE LEITURA do GitHub (branch de trabalho), do Checklist Mestre do Notion e dos documentos de arquitetura. Observações do esquema legado foram previamente levantadas por consulta de metadados de leitura; nesta rodada não houve operação no banco remoto. Não foram executados login real, testes, simulação E2E, build, alteração de dados ou validação do ambiente de clientes. Classificar 'existe no código' separadamente de 'funciona integralmente em produção'.

## 3. Inventário auditado — estado comprovado

| Área | Evidência no código/contrato | Lacuna para FASE 11 |
| --- | --- | --- |
| Papéis e rotas | apps/web/src/hooks/useAuth.tsx detecta administrador, gerente, capataz, escritório, operador_fabrica, consultor, pesador, pecuarista e syncvet; apps/web/src/lib/authNavigation.ts e apps/web/src/App.tsx definem home e rotas | Não existe papel proprietário separado no union/rotas examinados; incluir sem renomear administrador nem quebrar redirect/cache de perfil |
| Login | apps/web/src/pages/Login.tsx usa e-mail/senha e useAuth.signIn | Botão e jornada Google OAuth não identificados; definir vínculo seguro de conta existente sem duplicar usuário/identidade |
| Gerente | apps/web/src/pages/GerentesPage.tsx lista, cria, edita, ativa/inativa e associa múltiplas fazendas via gerentes_fazendas; espelha gerentes.fazenda_id como principal; criação usa create-user | É tela administrativa /admin/gerentes; não existe gestão delegada de equipe pela rota /gerente examinada; não há CPF/foto de gerente nesses formulários |
| Capataz | apps/web/src/pages/CapatazesPage.tsx possui nome, e-mail, telefone, ativo e vínculos capatazes_retiros; capatazes.retiro_id espelha o principal; apps/web/src/pages/CapatazDashboard.tsx troca retiro e usa estado offline | CPF e foto não estão no formulário nem nas colunas inspecionadas; não foi identificada tela 'meu perfil' editável pelo próprio capataz |
| Fazenda | apps/web/src/pages/FazendasPage.tsx cria/edita nome, cidade, estado e ativo; usa administrador_id; apps/web/src/pages/FazendaDetailPage.tsx apresenta e edita fazenda e retiros | Perfil enriquecido da fazenda, foto, contatos/responsáveis e vínculo explícito com proprietário ainda não materializados nos formulários examinados |
| Retiro/pasto | apps/web/src/pages/RetirosPage.tsx, FazendaDetailPage.tsx, RetiroDetailPage.tsx e docs/04-tenant-hierarchy.md usam fazenda -> retiro -> pasto; retiros.capataz é texto | Não confundir campo textual do capataz com identidade estável; enriquecer foto/dados somente com política e modelo explícitos |
| Perfis adicionais | EscritoriosPage.tsx, ConsultoresPage.tsx, PesadoresPage.tsx, ConsultorConfiguracoesPage.tsx e components/PesadorConfigModal.tsx; este último já envia logo para relatório PDF | Definir evolução visual comum sem forçar todos a ter os mesmos dados; não transformar logos profissionais em fotos pessoais |
| Ranking existente | apps/web/src/lib/scoreCapataz.ts e scoreCapatazData.ts calculam score por retiro; GerenteDashboard.tsx exibe aba de ranking; components/ranking/PremiacaoSemestral.tsx ordena retiros e exibe capataz como nome | Não é currículo portátil de pessoa, nem ranking consolidado por identidade ao longo de diferentes fazendas; preservar fórmulas aprovadas e atribuir evidências ao user_id/identidade correta |
| Operação/histórico | lib/operacaoReporter.ts registra eventos iniciados/cancelados/sincronizados; components/gerente/PainelOperacoes.tsx acompanha capataz/retir o; campos do legado: operacoes_capataz.user_id, fazenda_id, retiro_id e ocorrido_em | Eventos de telemetria não bastam para eficiência nem vínculo empregatício; histórico profissional precisa período formal, autoria, origem e critérios definidos |
| Exportação | Existem módulos PDF em apps/web/src/lib (visitaPdf, autoSalgaPdf, pesagemPdf, etc.) e componentes de relatórios | Criar PDF específico de perfil/currículo com controles de visibilidade, sem copiar relatórios operacionais indiscriminadamente |
| Exclusão | FazendasPage.tsx, GerentesPage.tsx, CapatazesPage.tsx, RetirosPage.tsx e RetiroDetailPage.tsx usam delete físico em fluxos existentes | Meta de produto: inativar/encerrar vínculo preservando histórico. NÃO alterar fluxo agora; modelar transição e impacto em integrações/cadastros relacionados |

**FATOS adicionais:** docs/21-tenancy-rbac-auth-auditoria.md e authority-matrix.ts registram create_user ADMIN_REQUIRED e create_capataz/self_register_farm como DENY_UNTIL_APPROVED no contrato atual; não presumir que gerente pode hoje criar contas apenas pela tela. O backend da reconstrução é Bun/TypeScript; Web React/Vite; direção ativa PWA/IndexedDB. A tabela legada fazendas_consultor tem campo texto proprietario, que NÃO constitui perfil autenticado de proprietário.

**[PENDENTE]:** inspecionar em futura descoberta versão realmente implantada, regras reais de auth/tenant, políticas efetivas no ambiente autorizado, cardinalidade completa e qualidade do legado, dados históricos suficientes para atribuição do score, disponibilidade Google OAuth, suporte de upload/foto e relatórios já prontos. Não transformar ausência de evidência em ausência absoluta no sistema.

## 4. Hierarquia-alvo e regras de perfil (produto)

- **Administrador global CONSUBOV:** funções globais e operações de gestão da plataforma, separadas das fazendas dos clientes; sem exclusão física por interface.
- **Proprietário do tenant/organização:** perfil próprio; administra fazendas e gerentes da própria organização; pode cadastrar fazenda e gerente; visualiza dados permitidos da organização.
- **Gerente:** administra fazenda(s) às quais está explicitamente vinculado(a), pode cadastrar fazenda em nome do tenant autorizado, cadastra capatazes/equipes subordinadas e estruturas subordinadas conforme alçada aprovada; NÃO cadastra/edita proprietário nem administrador global.
- **Capataz:** cria/completa/edita seu próprio perfil (nome, CPF, e-mail, telefone, foto), mantém seus dados pessoais; opera retiros autorizados; NÃO cadastra gerente, proprietário ou administrador; não edita resultados validados.
- **Escritório, consultor, pesador, operador e demais perfis atuais:** preservar rotas, escopos e cadastros; incluir apenas campos comuns aprovados, sem conceder permissão por analogia.
- **Inativação, transferência e encerramento de vínculo:** preservar referência histórica a pessoa, fazenda, retiro e período; 'remover' no produto significa revogar/desvincular quando apropriado, não apagar histórico. Tratamento legal futuro de dados pessoais permanece separado.
- **Mais de uma fazenda/tenant:** pessoa mantém identidade estável, com vínculos e papéis por organização/fazenda; não agregar dados de tenants distintos sem finalidade, consentimento e permissão definidos.

A matriz funcional exata (ação × recurso × tenant × fazenda) deve ser proposta no PRD, aprovada e incorporada aos contratos existentes quando da IMPLEMENTAÇÃO futura; nenhum ALLOW entra agora em production/runtime. Não usar ACL baseada apenas em rota/menu/UI.

## 5. Onde cada mudança futura deve entrar

| Bloco | Ponto de integração a revisar no futuro | Condição de compatibilidade |
| --- | --- | --- |
| 11.1 Modelo proprietário/organização | apps/api/src/modules/identity-tenancy/domain/*; apps/api/src/modules/farms/domain/*; apps/web/src/hooks/useAuth.tsx; apps/web/src/lib/authNavigation.ts; apps/web/src/App.tsx | Acrescentar papel sem redefinir admin; manter user_id, tenant/fazenda e cache offline atuais; mapear legado antes de criar tabelas |
| 11.2 Administração dos gerentes | apps/web/src/pages/GerentesPage.tsx; GerenteDashboard.tsx; apps/web/src/components/gerente/*; gerentes_fazendas | Reutilizar lista e vínculo principal; fluxo novo via API do domínio, sem conceder privilégios via create-user legado |
| 11.3 Cadastro/autoperfil do capataz | apps/web/src/pages/CapatazesPage.tsx; CapatazDashboard.tsx; CapatazRoute.tsx; apps/web/src/App.tsx | Dados novos optativos na migração; não apagar capatazes_retiros, nem alterar IDs/filas offline |
| 11.4 Perfis de fazenda/retiro | apps/web/src/pages/FazendasPage.tsx; FazendaDetailPage.tsx; RetirosPage.tsx; RetiroDetailPage.tsx | Preservar rotas, relações fazenda/retiro/pasto, filtros, relatórios e painéis antigos |
| 11.5 Mídia/fotos | adapters por FileStoragePort em apps/api/src/modules/files; telas de perfil; revisar components/PesadorConfigModal.tsx como referência de UX somente | Novos anexos referenciam identidade e escopo; falha de upload não elimina dado principal; fotos e URLs privadas |
| 11.6 Vínculos/currículo | novos contratos de vínculo profissional no Identity/Tenancy e projeções read-only de operações, lançamentos e auditorias | Versionar início/fim do vínculo; manter histórico anterior; não inferir vínculo pelo nome do retiro ou capataz textual |
| 11.7 Ranking profissional | apps/web/src/lib/scoreCapataz.ts; scoreCapatazData.ts; components/ranking/PremiacaoSemestral.tsx; GerenteDashboard.tsx | NÃO reescrever fórmulas; ranking atual é por retiro, novo por pessoa requer vínculo ID+período e regras de comparabilidade aprovadas |
| 11.8 Google Login | apps/web/src/pages/Login.tsx; hooks/useAuth.tsx; Auth adapters/Identity/Tenancy; recuperação de conta e role redirect | OAuth opcional por adapter; associação verificada à mesma identidade sem criar duplicatas nem ampliar acesso |
| 11.9 PDF perfil/currículo | apps/web/src/lib/downloadPdf.ts e demais helpers PDF; reporting API e storage adapter | Exportar só dados autorizados/consentidos; período, fonte e versão do score explícitos |
| 11.10 Contratos/testes/docs | apps/api/src/openapi.ts; apps/api/src/modules/identity-tenancy/*; tests Web/API e QA local; docs/ e Checklist Mestre | Contratos versionados, interfaces estáveis, testes positivos/negativos, offline e rollback de dados |

**Nenhuma linha acima representa mudança executada ou migração autorizada.**

## 6. Backlog detalhado e critérios de aceite

### 11.0 — Inventário e baseline
- [x] Identificar pontos principais do código, papéis e vínculos e registrar evidências desta auditoria documental.
- [ ] Quando começar desenvolvimento, validar git status/branch/PR/alterações de outros agentes e recarregar a revisão corrente.
- [ ] Inventariar telas realmente entregues e comparar schema local/legado, contratos, consumidores e automações com evidência.
- [ ] Formalizar matriz de ações por perfil, tenant, fazenda e retiro; marcar células desconhecidas como PENDENTE.

### 11.1 — Identidade do proprietário
- [ ] Definir cadastro/perfil do proprietário distinto do admin global e associação a tenant/organização.
- [ ] Definir proprietário com múltiplas fazendas e gerentes; vínculos e permissões por escopo.
- [ ] Definir fluxo proprietário -> criação/convite de gerente, sem assumir que create-user permite chamada direta.
- [ ] Projetar edição, inativação, saída de organização e transferência de titularidade com histórico preservado.
- [ ] Definir critérios de aceite: proprietário não visualiza tenant alheio nem converte função global por cadastro.

### 11.2 — Gerente e estrutura
- [ ] Mapear atribuições atuais de gerentes_fazendas/principal e regras de criação por proprietário.
- [ ] Projetar cadastro de fazenda pelo gerente autorizado e pelo proprietário; validar empresa contratante.
- [ ] Projetar gerente -> capataz, equipe, retiro e subordinados; impedir criação/edição de níveis superiores.
- [ ] Projetar mover/inativar/reativar usuário e vínculo sem excluir dados históricos.
- [ ] Aceitar gerente com múltiplas fazendas, inclusive troca de contexto, sem vazamento nem perda de filtros.

### 11.3 — Capataz e demais perfis
- [ ] Especificar edição própria de nome, e-mail, telefone e foto do capataz, separando campos pessoais de dados administráveis.
- [ ] Especificar CPF (validação, visibilidade, máscara e coleta mínima), sem exibição irrestrita em ranking/PDF.
- [ ] Manter capataz ativo/inativo e associação múltipla capatazes_retiros com campo principal legado.
- [ ] Projetar perfil de escritório, consultor, pesador, operador e equipe, respeitando peculiaridades; não migrar tudo para formulário genérico sem prova.
- [ ] Planejar sem perda de dados e sem deslocar os perfis existentes da home/rota.

### 11.4 — Fazendas, retiros e fotos
- [ ] Definir perfil de fazenda: identificação existente, endereço/contato aprovados, proprietário, fotos e responsáveis.
- [ ] Definir perfil de retiro e fotos sem perder fazenda_id, pastos, QR, ciclos, estoque, operações ou mapas.
- [ ] Especificar upload opcional/retomável, tamanho/formatos/armazenamento e substituição sem exclusão inadvertida.
- [ ] Planejar adição de campos sem NOT NULL imediato e leituras compatíveis com registros antigos sem foto/CPF.

### 11.5 — Histórico/currículo
- [ ] Modelar vínculos com pessoa, organização, fazenda, retiro, papel, datas de início/fim, motivo de encerramento e origem.
- [ ] Separar experiências confirmadas das informações autodeclaradas e da telemetria de operação.
- [ ] Planejar perfil histórico portátil por identidade estável; não transformar 'retiros.capataz' textual em prova de autoria.
- [ ] Definir quais períodos, fazendas e resultados podem aparecer para terceiros, sujeito à aprovação de visibilidade.

### 11.6 — Ranking de eficiência
- [ ] Inventariar score por retiro e premiação semestral atuais; não duplicar cálculo.
- [ ] Vincular score à pessoa somente com regra de atribuição temporal verificável (múltiplos capatazes, trocas e períodos).
- [ ] Definir métricas, origem, versão da fórmula, filtros, cobertura mínima e tratamento de dados insuficientes.
- [ ] Validar prevenção de manipulação de desempenho e comparação de contextos diferentes; aprovação de regra de negócio antes do código.
- [ ] Criar especificação da aba ranking/currículo e nível de visibilidade por tenant/perfil, sem publicar CPF.

### 11.7 — Google e exportação
- [ ] Especificar login Google como opção adicional, vinculação de identidade e recuperação de acesso; manter login por senha funcional.
- [ ] Especificar callback/redirect Web/PWA e experiência offline sem autenticação remota obrigatória durante operação autorizada.
- [ ] Especificar PDFs de perfil, histórico e ranking com consentimento, período, data e origem.
- [ ] Definir autorização por perfil para emitir e baixar PDF sem revelar informações de terceiros.

### 11.8 — Migração/compatibilidade e QA
- [ ] Planejar schema/adapters incrementais e compatibilidade de APIs/rotas/IDs, sem executar migrations agora.
- [ ] Criar inventário origem->destino, backfill somente com prova, dry-run local, rollback e reconciliação; não colapsar identidades por nome/e-mail.
- [ ] Cobrir cenários existentes: login de todos os papéis; admin/gerente/capataz; fazendas/gerentes/retiros; inativação; históricos; upload; geração PDF.
- [ ] Cobrir cenário negativo de elevação de papel, troca entre fazendas/tenants, capataz editando score e duplicação de contas Google.
- [ ] Cobrir Web/PWA instalada, rede ausente, troca de perfil/tenant, imagens pendentes, sync e reabertura preservando dados.
- [ ] Atualizar OpenAPI, documentação do domínio, testes e Checklist Mestre junto com a futura implementação.
- [ ] Emitir relatório de QA da fase conforme skill qualidade-visionario com evidências por SHA; não considerar implementada/aprovada até critérios atendidos.

## 7. Política de mudança sem quebra

1. Partir da revisão viva e preservar PR #43/alterações concorrentes; não criar refatoração transversal.
2. Adotar mudanças aditivas e optativas, compatibilidade de resposta/consumidores, adapters e feature flag somente se necessário.
3. Introduzir entidade de proprietário e vínculos de perfil sem sobrescrever nem ressignificar administrador_id, gerente_id, capataz_id, user_id ou campos 'principal' existentes.
4. Distinguir conta autenticada, perfil pessoal, papel por organização e emprego/vínculo histórico. Não usar nome/e-mail/CPF como chave primária.
5. Preservar operações offline e filas, evitar expor CPF/fotos no cache genérico e não alterar mecanismo de sincronização sem análise de impacto.
6. Realizar testes de regressão em infraestrutura local antes de qualquer migração/deploy futuro; manter rollback realista.
7. Não assumir zero regressão sem testes e homologação por perfil; a documentação atual não prova implementação.

## 8. Critérios de aceite finais (futuros)

- Proprietário separado do administrador; proprietário pode criar gerente e fazenda na organização autorizada.
- Gerente pode gerir fazendas/recursos e cadastrar capataz dentro de sua alçada; não pode criar superior.
- Capataz edita apenas seus dados pessoais, inclui CPF/foto conforme regra aprovada; não edita resultado histórico.
- Fazenda, retiro e usuário possuem perfil editável com arquivos opcionais e vínculos corretos.
- Transferência/inativação preserva vínculo e histórico; nenhuma exclusão física exposta no fluxo novo.
- Currículo mostra datas e vínculos rastreáveis; ranking mostra score com origem e período, sem atribuição por nome.
- OAuth Google opcional não duplica usuário nem substitui senha forçosamente.
- PDF só exporta dados autorizados.
- Nenhum fluxo/regressão crítica existente se perde; testes e QA aprovados na revisão da implementação.

## 9. Governança, Git e ações proibidas

**Somente planejamento documental nesta entrega.** Não alterar: apps/, supabase/, migrations, contratos runtime, auth, RLS, secrets, infraestrutura, dispositivos ou banco remoto. Não rodar deploy, testes remotos, CI hospedado, reset hard, force push, merge, limpeza de dados reais. Futuro executor somente com PRD/autorizações específicas, revisão de conflitos/arquivos compartilhados e gates de QA. Ao desenvolver, preservar branch e worktree, não reescrever histórico; alterações de código exigem documentação e OpenAPI proporcionais. Publicação de código/DB não autorizada por este documento.

## 10. Relatório final exigido ao futuro executor

Informar fase/subitem, mudança/arquivos, SHA, contratos alterados, migração/backfill, evidências lint/typecheck/build/testes/E2E, matriz de papéis executada, validação offline, regressão, rollback, documentação, QA APROVADO/REPROVADO e pendências objetivas. Sem alegar testes que não rodaram.

## 11. Handoff e pendências de decisão

**Fonte operacional:** Checklist Mestre Notion e CONSUBOV_CHECKLIST_MESTRE.md. **FASE 11:** criada somente para organização futura; não iniciar implementação por este documento; pode realizar descoberta independente sem aguardar fechamento de todas as fases anteriores. Revisar a versão vigente do repositório antes de atribuir agentes.

**[PENDENTE]** matriz detalhada de permissões de proprietário/gerente; proprietários múltiplos e transferência da organização; modelo de vínculo profissional; métrica e critério de comparabilidade de capatazes; visibilidade inter-fazendas/terceiros do currículo/ranking; política de CPF/foto e divulgação; vínculo de conta Google; dados legados cuja atribuição histórica não pode ser comprovada.

**Compatibilidade relevante:** FASES 5–7 têm QA integral pendente, PR #43 continua draft. FASE 11 não entra no PRD ativo das FASES 5–9 e não altera suas evidências, exceto que qualquer novo commit documental precisará ser reconciliado com a SHA do ramo de trabalho.

**Referências:** CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md; docs/04-tenant-hierarchy.md; docs/21-tenancy-rbac-auth-auditoria.md; docs/22-baseline-funcional-web.md; docs/62-offline-legacy-migration.md; docs/66-offline-atomic-queue.md; apps/web/src/pages/{GerentesPage,CapatazesPage,FazendasPage,FazendaDetailPage,RetirosPage,RetiroDetailPage,GerenteDashboard,CapatazDashboard,Login}.tsx; apps/web/src/lib/{scoreCapataz,scoreCapatazData,operacaoReporter,authNavigation}.ts; apps/api/src/modules/identity-tenancy/domain/{authority-matrix,rbac-matrix}.ts; Notion Checklist Mestre.
