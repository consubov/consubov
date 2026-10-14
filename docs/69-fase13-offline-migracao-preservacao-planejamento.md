# FASE 13 — Consolidação Offline, Migração sem Perda e Preservação de Arquivos

**Fonte canônica de planejamento no Notion:** https://app.notion.com/p/3f98e0bd0f4d81ec9208dd80c7fd85d4

**STATUS:** PLANEJADA/BLOQUEADA; nenhuma implementação autorizada. Este documento é espelho do planejamento, não segundo PRD ativo.

> **ESTADO OFICIAL: PLANEJADA / BLOQUEADA — NÃO INICIADA.** Esta fase é o complemento posterior da FASE 12. Esta página é exclusivamente um dossiê de planejamento para futuros agentes, não é PRD de implementação autorizado. Decisão do responsável em 2026-10-13: FASE 12 só começa com novo pedido explícito; FASE 13 só pode começar após conclusão e QA aprovado da FASE 12 e autorização específica posterior. Nenhum deploy, mudança remota, eliminação de dados ou ligação da nova API ao Supabase de produção está autorizada.
> **REGRA ABSOLUTA DE PRESERVAÇÃO NESTE PLANEJAMENTO:** NÃO apagar arquivos, fotos, registros, backups, versões legadas, filas locais, objetos no Storage ou metadados; NÃO configurar TTL, expiração, prazo de validade, política de retenção numérica, job de limpeza, purge, auto-delete, lifecycle rule, nem coluna/data de expurgo por esta fase. A ideia anteriormente discutida de 90 dias para fotos é uma POSSIBILIDADE FUTURA NÃO APROVADA, não uma regra vigente. Não se deve inferir prazo para tombstones/checkpoints. Auditoria do cron existente é permitida somente leitura; qualquer alteração da rotina atual depende de autorização separada.
## 0. Finalidade e integração com o roadmap
Criar uma transição sem perda de dados do CONSUBOV legado para o produto SaaS multitenant offline-first. A nova API Bun/TypeScript será autoridade de domínio; PostgreSQL continua direção canônica; React/Vite PWA e IndexedDB são a arquitetura mobile vigente. O legado operacional deve continuar funcionando até cutover explicitamente autorizado e comprovadamente reversível.
**NÃO duplicar:** FASE 7 já é responsável pela implantação e QA da persistência IndexedDB, migração das seis bases locais, filas, sync e caos; FASE 8 já cobre mapeamento e ensaio de migração de banco remoto/staging; FASE 9 cobre rollout, backup e piloto; FASE 12 cobre hardening de RLS/grants/policies/Auth/Storage/RPC. FASE 13 será consolidação/aperfeiçoamento posterior e reconciliação final, não pretexto para adiar P0 offline da FASE 7.
## 1. Evidências confirmadas e limites
- [x] **Repositório**: branch ativa work/fase5-6-7-pwa-local; PR #43 draft; FASES 5–7 não aprovadas integralmente. Código atual do capataz usa sincronização principal manual/forçada, não automática na reconexão. Pesagens também exigem ação manual. Consultor/Conferência/Mais Arrobas têm tentativas de autosync diferentes.
- [x] **Risco de falsa confirmação offline**: saveLancamento no offlineDb legado retorna fallback mesmo se IndexedDB falhar; interface pode mostrar “Salvo offline”. Fila Mais Arrobas inicia persistência sem esperar confirmação durável; falha é registrada, mas não impede confirmação no chamador. Precisam ser eliminadas essas falsas garantias antes do uso novo em campo.
- [x] **Progresso aproveitável**: IndexedDbLocalDatabase, IndexedDbAtomicCommandQueue, commandPolicy e localSyncRound implementados/testados isoladamente com tenant/user, fila transacional, idempotencyKey e ACK. Esses componentes ainda não constituem sync real da nova API integrado aos seis bancos/fluxos legados.
- [x] **Inventário local comprovado**: consubov-capataz v7, consubov-session v1, consubov-consultor-offline v2, mais-arrobas-offline v1, mais-arrobas-sync v2 e consubov-fotos-salga v1, além de backups/pendências no localStorage. PRESERVAR todos até reconciliação/ACK; nenhuma migração automática destrutiva.
- [x] **Banco remoto**: 132 tabelas public, 107 sem RLS, grants anon amplos e separação tenant ainda não implementada canonicamente no legado; FASE 12 é pré-requisito de segurança para FASE 13. A nova API atualmente não está conectada ao PostgreSQL remoto, conforme proibição vigente.
- [x] **Fotos e armazenamento**: Storage possui fotos de campo/visitas/despesas, relatórios e outros objetos; 92 lançamentos têm imagens inline em base64 (\~59,6 MB) na coluna foto_cocho_url. O backup do banco não substitui o backup físico dos objetos Storage nem protege filas que ainda estão apenas no aparelho.
- [x] **Rotina preexistente a verificar, SEM MUDAR NESTA FASE**: pg_cron já tem job ativo “limpar-fotos-diario” (agenda 06:30) que invoca função SQL de limpeza de referências de fotos; não se concluiu exclusão física de objetos por esse job. O desejo de não ter validade futura não significa que a rotina antiga foi desativada. Auditoria/decisão sobre a rotina corrente pertence à FASE 12, mediante autorização expressa.
- [ ] **Não comprovado**: entrega automática real em campo; 100% das filas migradas; backend autenticado com ACK durável; preservação frente a logout, troca de tenant, expulsão do storage pelo SO, múltiplos aparelhos; backup/restore real; homologação iOS/Android; compatibilidade de schema legado com destino; atualização da PWA antiga para a nova com todos os dados.
## 2. Decisão arquitetural registrada
**Recomendação:** NÃO recomeçar com banco vazio, NÃO desligar o app legado, NÃO conectar a nova API ao banco remoto de produção agora. Projetar schema PostgreSQL canônico atrás de repositories/adapters e preparar mapeamentos, scripts e ensaios com fixture local ou staging isolado quando este for autorizado; preservar IDs, Auth, Storage, históricos e dados offline nos aparelhos. Um schema novo seguro pode ser necessário, mas deverá receber migração reconciliada, não importação sem testes e muito menos substituição destrutiva.
**Conexão/cutover:** somente após os gates FASES 5–9 aplicáveis, segurança P0 corrigida, compatibilidade, homologação offline e autorização de conexão/staging/produção. Usar comparações de leitura e ensaios não destrutivos; proibir dual-write de estoque, pesagens ou transferências sem protocolo transacional/idempotente provado. Não assumir que dois apps escrevendo nas mesmas tabelas são automaticamente compatíveis.
## 3. Plano futuro de trabalho FASE 13 (NENHUM ITEM INICIADO)
### 13.1 Matriz completa de preservação
- [ ] Inventariar cada tabela, FK, view, função, trigger, relatório, tenant/proprietário, Auth ID, bucket/objeto/caminho, imagem base64, QR, histórico, fila e comando pendente por perfil.
- [ ] Classificar fontes de verdade: PostgreSQL; Supabase Auth; Storage físico; local IndexedDB/Blob/ArrayBuffer; localStorage e PDFs; comparar origem/destino com IDs, versão e hash. Não expor dados pessoais nos relatórios.
- [ ] Mapear 1:1 e transformações necessárias para entidades/admin/consultor/gerente/capataz/pesador/SyncVet; documentar relações entre fazendas de consultoria e fazendas operacionais, sem vincular pelo nome.
### 13.2 Experiência offline sem fricção
- [ ] Mesmo formulário, QR, GPS, câmera e fluxo de trabalho com e sem internet; não exigir “modo offline” manual. Mostrar confirmação **somente depois de commit local durável**. Se IndexedDB/quota/permissão falhar, bloquear confirmação falsa e oferecer recuperação.
- [ ] Salvar registros e fotos localmente em transações apropriadas; permitir inspeção discreta de pendências e erro recuperável, sem bombardear o usuário com estados de rede; não esconder perda, conflito ou falha que demande ação.
- [ ] Separar dados/cache por tenant, user e dispositivo autorizado; conservar dados não enviados em troca de conta e impedir envio sob outra identidade; preparar autorização e revogação com reconciliação segura.
- [ ] Tratamento de storage.persist(), quota, evicção, updates de Service Worker e telas previamente carregadas; PWA iOS/Android não garante execução imediata de sync com app totalmente fechado.
### 13.3 Motor único de sincronização e contratos de banco
- [ ] Unificar os fluxos antigos (salga, pesagem, conferência, Mais Arrobas, consultoria, fotos) sobre fila durável com commandId, idempotencyKey estáveis, tenant/user/device, aggregate ID, baseVersion, causalidade, anexos e correlationId.
- [ ] Autosync quando app estiver executando e detectar retorno/estabilização de conexão, abertura/visibilidade, e reintentos programados pelo cliente, com backoff e jitter; não depender somente de [navigator.onLine](http://navigator.onLine), não perder eventos durante app fechado.
- [ ] Backend autorizado valida role, tenant, fazenda/retiro/pasto, dependências, versão, operação e permissões atuais; aplica comando e ACK estável em transação; reenvio após timeout retorna mesmo resultado ou conflito explícito, não duplica lançamentos/estoque/pesagens.
- [ ] Pull incremental autenticado, cursor persistente do servidor, snapshot paginado, checkpoint somente após commit local; baixar tombstones para impedir ressurgimento de registros removidos no servidor **sem TTL/expurgo automático**.
- [ ] Não usar last-write-wins em estoque, transferências, pesagens ou operações críticas. Definir matriz por domínio; erro definitivo/conflito exige usuário responsável, nunca sumir com o dado local.
### 13.4 Anexos e fotos (SEM EXCLUSÃO PROGRAMADA)
- [ ] Upload por fila separada com Blob durável, compressão opcional mantendo original até ACK verificável, checksum/path estável, reenvio seguro, confirmação física do objeto, vínculo da linha e verificação de referência antes de confirmar.
- [ ] Segregar Storage por tenant/usuário/perfil conforme autorização, arquivos privados e URLs assinadas; reduzir miniaturas quando necessário, sem substituir/expurgar originais sem autorização e regra aprovada.
- [ ] Planejar migração futura de fotos base64 do banco para Storage privado por cópia+verificação+reconciliação. **Não limpar coluna, não remover original, não apagar backup** nesta fase documental.
- [ ] Apenas documentar possibilidade técnica de descarte futuro de imagens exclusivamente comprobatórias; **nenhum prazo, contagem regressiva, expires_at, delete_after, job ou função de expurgo será implementado/ativado até decisão separada**.
### 13.5 Compatibilidade banco legado e novo
- [ ] Revisar mapa de origem-destino PostgreSQL, colunas, tipos, PK, FK, checks, defaults, enums, times/timezones, roles, auth, RLS, Storage, métodos API e regras de negócio; gerar migrations locais com rollback testável antes de qualquer remoto.
- [ ] Preservar regras de integridade, saldo, histórico e idempotência; não propagar grants inseguros/RPCs privilegiadas do legado para o novo schema; validar efeitos de RLS corrigidos na FASE 12 sobre clientes ainda em produção.
### 13.6 Prova de migração sem perda
- [ ] Extrair backups completos apropriados de PostgreSQL/Auth/Storage e fazer restore em staging separado quando expressamente autorizado; testar integridade/hash de arquivos e linhas, FK, saldos, cronologia, auditoria e objetos orfãos.
- [ ] Simular dados ainda não sincronizados em vários dispositivos; preservar seis bases locais, localStorage, fotos e filas durante instalação, upgrade, perda de rede, reabertura e rollback; nenhum “copia concluída” até reconciliação.
- [ ] Ensaiar idempotentemente reexecução, queda no meio, conflito de mudanças, IDs antigos, migração parcial, compatibilidade de URLs e retomada; relatórios de diferença = ZERO para dados obrigatórios antes de aceite.
### 13.7 Estratégia de virada (cutover) sem indisponibilizar o legado
- [ ] Preparar ambiente isolado, autenticação/tenant e contratos; testar **somente leitura/shadow** de dados reconciliados; não colocar nova app e legado realizando dual-write livre sobre mesmas tabelas.
- [ ] Definir plano de piloto por tenant com reversão, janela de transição, observabilidade, conciliação, critérios de bloqueio/abort e responsável por cada gate. Manter app atual operacional até liberação comprovada.
- [ ] Habilitar produção só com aprovações separadas para uso de ambiente remoto, migration/deploy, mudança de tráfego/credenciais e desligamento do legado. Desligar o antigo SOMENTE quando todas as fontes (incluindo aparelhos ainda offline) estiverem protegidas/reconciliadas.
### 13.8 Retenção futura — REGISTRADA COMO IDEIA, NÃO COMO REGRA
- [ ] Futuramente, em decisão independente e expressa do responsável, avaliar se imagens exclusivamente de conferência podem receber uma política de descarte e eventual automação por pg_cron + Edge Function + Storage API oficial. Nenhum critério temporal nem exclusão já foi aprovado.
- [ ] Antes de qualquer política futura: inventário jurídico/operacional, arquivos referenciados, PDFs, snapshots offline, backups, auditoria, seleção por categoria, modos dry-run/relatório, hold legal, autorização e QA. Tombstones críticos não são equivalentes a fotos descartáveis.
## 4. Critérios de aceite (futuros, não executados)
- [ ] Salvações exibidas como concluídas têm prova de persistência local durável; falha/quota nunca gera sucesso falso.
- [ ] Um comando é aplicado no servidor no máximo uma vez por chave idempotente, incluindo timeout/ACK perdido/reboot/multiaba; nenhum dado desaparece até confirmação e reconciliação.
- [ ] Isolamento e autorização por tenant/user/fazenda/retiro/pasto no backend e no app; sessão alterada/revogação não mistura filas.
- [ ] Fotos, PDFs, históricos, Auth, Storage e todas as seis bases offline da versão anterior preservados e reconciliados; nenhum apagamento, expiração automática ou limpeza não aprovada.
- [ ] Campo rural: testes em iPhone/Safari e Android/Chromium com rede 0, oscilante e lenta, dias contínuos offline, atualização/fechamento do app, dois dispositivos, quota insuficiente e recuperação após erro; relatório real de QA e piloto.
- [ ] Saldos, lançamentos, pesagens, auditoria e contagens reconciliados entre versões, sem duplicação, perda ou alteração não autorizada; rollback demonstrado.
## 5. Testes, QA e evidências obrigatórias no futuro
- [ ] Suite Node + Vitest + Playwright Chromium/WebKit, IndexedDB real/fake-indexeddb, rede intermitente, crash, offline prolongado, fotos grandes, autorização cross-tenant, corrida multitab e conflito por domínio.
- [ ] Tests E2E de migration e cutover com fixtures anonimizadas e checksum das quatro classes de dados: DB/Auth/Storage/local; relatórios por SHA e ambiente; piloto físico rural.
- [ ] Aplicar gate qualidade-visionario na revisão de implementação. **QA REPROVADO = não concluída**; não marcar pronto por existir documento ou testes históricos de outro SHA.
## 6. Fora do escopo e ações proibidas AGORA
- Nenhuma mudança de código da aplicação, fila ou API; nenhuma SQL DDL/DML, migration remota, ativação RLS, alteração cron, bucket, permissão, Auth, secrets, deploy, CI hospedado, merge ou alteração da main.
- Nenhuma exclusão (física/lógica em dados reais) e nenhuma configuração de retenção/validade, nem mesmo de 90 dias; nenhuma desativação do app atual, nenhum dual-write produtivo, nenhum banco recém-criado remoto ou cópia real sem autorização.
- Sem delegação/agente executor nesta fase de planejamento; antes de futura implementação conferir Checklist Mestre, PR #43, alterações locais/stashes e elaborar PRD aprovado com escopo, exclusões, critérios, testes, QA, Git e relatório.
## 7. Git, documentação, conflitos e relatório futuro
- Preservar main, trabalhar somente na branch autorizada, não usar reset --hard, push forçado nem merge/deploy sem aprovação; revisar arquivos compartilhados com agentes das FASES 5–9/12.
- Atualizar no bloco de implementação efetiva: docs/ADR/schema/OpenAPI, Checklist Mestre no Notion, documentação Git e handoff. Não declarar QA ou migração comprovados sem evidência.
- Relatório futuro obrigatório: SHA e branches; operações executadas/não executadas; matriz de migração; contagem/hash/diffs; anexos e dispositivos; cobertura offline; decisões de conflitos; falhas/rollback; autorização; QA; pendências e proibição de expurgo.
## 8. Fontes de verdade e referências cruzadas
- Checklist Mestre Notion: <mention-page url="https://app.notion.com/p/3ec8e0bd0f4d816d9bb5d807e8e2cdc9">CONSUBOV — Checklist Mestre de Execução</mention-page>
- FASE 7: <mention-page url="https://app.notion.com/p/3ec8e0bd0f4d8151a486ed1481fd22db"/>
- FASE 8: <mention-page url="https://app.notion.com/p/3ec8e0bd0f4d8103a93cc106cc1530ca"/>
- FASE 9: <mention-page url="https://app.notion.com/p/3ec8e0bd0f4d81dfb392e880325636af"/>
- FASE 12, PRÉ-REQUISITO: <mention-page url="https://app.notion.com/p/3f98e0bd0f4d81dab582edcf1c304138"/>
- GitHub: docs/62-offline-legacy-migration.md; docs/63-offline-vnext-foundations.md; docs/66-offline-atomic-queue.md; docs/19-exclusao-sync-futuro.md; docs/67-local-snapshot-rehearsal.md; docs/68-sincronizacao-local-e-agentes.md; instructions/active/ROADMAP-PRD-HANDOFF-2026-10-09-FASES5-9-LOCAL.md.
