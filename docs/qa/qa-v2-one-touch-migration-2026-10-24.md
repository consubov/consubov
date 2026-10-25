# CONSUBOV 2.0 — Consentimento único e migração entre origens

**Estado:** código preparatório em branch isolada; NÃO PUBLICADO, sem conexão ao banco remoto e sem disparo de notificação.

**Fontes:** Checklist Mestre e PRD existente da FASE 6.3A no Notion; avaliação do legado Lovable vinculada ao repositório consubov-app/sweet-sync-forge (a conexão GitHub atual não permite escrita no legado); PRs #60–#63 abertos. Dossiê: Obsidian PLANO-UM-TOQUE-RELAY-V2.

## Requisito e UX (24/10/2026)

O operador da aplicação antiga recebe **uma única mensagem** com uma única ação primária:

> **Atualização CONSUBOV 2.0**
> Ao autorizar, seus lançamentos, fotos e informações pendentes serão protegidos e enviados com segurança. Se houver falha, nada será apagado no aplicativo atual.
>
> **Autorizo a transferência e quero atualizar**

O toque no botão autoriza somente a transferência delimitada ao usuário/tenant autenticado; não exige checkbox adicional. Há opção "Agora não". A permissão deve ser auditada no backend (identidade, data e versão do texto). Sem consentimento registrado, nenhuma sincronização de migração começa.

Depois de um único comando: verificar → backup local durável → sincronização de filas e fotos → ACK durável do servidor → nova inspeção local → handoff de uso único → abrir app.consubov.com.br. **Não** navegar se faltar qualquer registro/foto, houver transação crítica ou surgir pendência durante a transferência.

A aplicação antiga permanece acessível, com os seis bancos e anexos intactos até o novo app confirmar a reidratação. Não limpar IndexedDB nem tratar cópia reduzida do localStorage como prova de backup completo.

## Código preparatório nesta etapa

- `apps/web/src/platform/migration/oneTouchMigrationFlow.ts`: coordenador FAIL-CLOSED com interfaces de serviços. Exige auditoria das seis bases, prova de backup de Blob, recibo do servidor e checagem final.
- `apps/web/src/platform/migration/V2MigrationConsentDialog.tsx`: um aviso, um botão de autorização e progresso automático, com opção de recusa.
- Arquivos de teste: autorização, sem rede, origem errada, tenant errado, backup parcial, fotos não confirmadas, recibo expirado, novas pendências e duplo clique.
- Destino: `https://app.consubov.com.br/baixar` com referência opaca curta de uso único **no fragmento**. O novo App deve exigir autenticação e trocar essa referência com o backend. Não é JWT/token de login.

## Fora do escopo deste commit

- **Não** montado na PWA de produção; nenhum push enviado.
- **Não** implementados adaptadores reais dos seis bancos, upload de Blob ou endpoints no backend. Sem esses adaptadores a migração NÃO funciona ponta a ponta. Este código jamais considera backup fictício como comprovado.
- Sem ligação ao Supabase/PostgreSQL remoto, Auth/RLS, migration, `service_role` no cliente ou dados reais.
- Sem deploy, merge, DNS/Cloudflare/Vercel, limpeza local, mudanças em Relatto, SyncVet, site, nem login offline para nove perfis (requisito separado).

## Contratos necessários antes de liberar

1. **Legado Lovable:** montar aviso atrás de feature flag inativa até publicação autorizada e implementar adaptadores por usuário/tenant: Capataz, Consultor, Mais Arrobas, fotos, dados auxiliares; não exportar tokens da base `consubov-session`.
2. **Backend/API:** JWT verificado, tenant/RBAC, consentimento auditável, operações/anexos idempotentes com ACK durável, controle de integridade, TTL, rate-limit e código de uso único; nunca aceitar identidade do cliente como autoridade.
3. **Novo App:** autenticar, resgatar referência por POST e reidratar dados autorizados/caches via API. Se SSO não estiver homologado, solicitar uma autenticação no novo domínio.
4. **Infraestrutura:** confirmar fonte remota comum, schemas e autorização; não ligar a nova API ao banco remoto sem aprovação específica.
5. **Aviso:** uma campanha única por release/dispositivo e modal in-app de fallback; push exige permissão e conexão.

## Testes e critérios de aceite

- [ ] Typecheck, unitários, Web/API/Edge, E2E e lint no SHA (testes unitários provam apenas o coordenador).
- [ ] E2E entre origens e dispositivo real com seis DB, Blob grande, rede interrompida, ACK perdido, retries, IDs idempotentes, tenant errado, contas trocadas e armazenamento esgotado.
- [ ] iPhone/Android físicos: um aviso e um aceite; instalação na tela inicial pode exigir ações nativas do SO. Nunca prometer instalação silenciosa universal.
- [ ] Sem consentimento, recibo durável ou migração concluída: **zero redirecionamento e zero exclusão** no legado.
- [ ] Security Scan, SAST, segredos, audit HIGH 0 no candidato integrado, inclusive Zod transitivo pendente do PR #63.
- [ ] Rollback aprovado e legado acessível para usuários offline por longos períodos.
- [ ] Atualizar Notion Checklist/FASE 6.3A/21 e Obsidian com SHA e resultados; GO/NO-GO somente com evidências.

## Git, proibições e relatório final

Branch `feat/consubov-v2-migration-consent-20261024` baseada em `main` `aed2e0e`; PR draft. Não sobrescrever PRs #60–#63. Proibidos: merge na main, reset/force-push, deploy, disparo de push, alteração remota de banco, DNS ou secrets sem autorização.

O próximo executor deve entregar: arquivos/SHA, adaptadores e rotas implementados, recibo/consentimento, prova de preservação e ACK por domínio, testes reais, segurança, limites iOS, rollback, Notion e Obsidian atualizados. Não declarar "pronto para produção" por passing mocks.


### 25/10/2026 — Ordem aprovada pelo responsável
- Depois de um consentimento: **enviar dados ao servidor primeiro** com idempotência, **preservando os dados locais**, depois fazer backup completo das seis bases/Blobs/fotos, conferir ACK durável e ausência de pendências, e somente então permitir instalação/recepção no destino. O código exige que o adaptador de sync declare `originalsPreserved: true`; isso **não substitui** QA nem integridade real de adaptadores. Sem backend/ACK a migração fica bloqueada.
- Não remover o PWA antigo por automação: atualização de origem não pode desinstalar a instalação anterior, cujo backup local deve permanecer disponível até a nova confirmar migração.

## 25/10/2026 — Correção isolada: entrada obrigatória na instalação da CONSUBOV 2.0

**Demanda:** quando o aplicativo Lovable antigo direciona o usuário para `https://app.consubov.com.br/baixar`, deve aparecer a instalação nova, **mesmo com a antiga instalada** ou marcador de instalação/standalone persistido.

**Modificações na branch do PR #64, sem alterar produção/legado:**

- `apps/web/src/lib/appSurface.ts`: `isConsubovV2DownloadRoute()` impede `resolveSurfaceRedirect` de levar `/baixar` para `/app` quando standalone na superfície nova, mantendo o caminho de Relatto e a abertura normal do ícone via `/`.
- `apps/web/index.html`: não executa o redirecionamento HTML antecipado de `/baixar` em `app.consubov.com.br` (ou preview `consubov-*.vercel.app`), inclusive quando detecta modo standalone.
- `apps/web/src/pages/BaixarAppPage.tsx`: sempre oferece o botão **Baixar e Instalar App Consubov 2.0** na rota de instalação do app; não aceita marcador de app antigo como prova da instalação da v2; respeita fallback de instalação Android/iOS. A aceitação de `beforeinstallprompt` não é tratada como instalação concluída até `appinstalled`.
- `apps/web/src/App.tsx`: não pula do link de instalação da v2 para o login em mudanças de display-mode; após instalação confirmada, a própria página mantém a lógica de navegação.
- `apps/web/src/lib/appSurface.v2-download.test.ts` e `apps/web/src/pages/BaixarAppPage.v2.test.tsx`: cenários de marcador antigo, standalone, prompt, fallback, regressão de Relatto.

**Critérios de aceite:** link explícito `/baixar` com CTA visível em aba normal e standalone, abertura pelo ícone da nova PWA através de `/` continua indo ao sistema, usuário não perde dados nem é obrigado a desinstalar o legado, Relatto permanece intacto.

**QA pendente de verificação real no novo commit:** GitHub CI/typecheck/build/lint, teste no celular físico Android/iPhone, confirmação de instalação nativa e reabertura. Os testes criados não são evidência de execução até o workflow concluído.

**Gates de release anteriores continuam válidos:** Security Scan HIGH e pendências de backend, restore real, tenant/RLS e backup impedem declarar migração de dados 2.0 pronta. Não habilitar flag de migração, não disparar notificação aos usuários e não promover produção por este ajuste isolado.


### 25/10/2026 — Identidade de instalação nova + correção do CI

- O usuário verificou fisicamente que `https://app.consubov.com.br/baixar` seguia abrindo login. **Causa de produção:** a Vercel ainda entregava `main` SHA `aed2e0ef20ed856efe7d8316bc1b6ffef0afeb30`, e a correção PR #64 não tinha sido implantada.
- Causa adicional no manifesto da branch: `manifest-consubov-v2.json` tinha `id: "/"`, igual ao `manifest.json` já instalado no mesmo origin. Foi alterado para **`id: "/consubov-v2"`**, nome `Consubov 2.0` e `start_url: "/"`, permitindo que navegadores compatíveis distingam a instalação 2.0 sem desinstalar uma PWA anterior. A identidade deve permanecer estável nos patches seguintes; não colocar build timestamp ou números de patch no `id`. Isso **não** move dados entre origens.
- No fluxo v2 `appinstalled` da página de baixar, permanecer na página e orientar abertura pelo novo ícone; não injetar `activateStandaloneSession()` numa aba comum e não saltar para o login. No iOS, o clique em “Já adicionei à Tela de Início” apenas mostra as instruções para abrir o novo ícone, sem declarar instalação verificada ou forçar login.
- CI #297 reprovara por **uma asserção antiga** em `src/test/appSurface.test.ts` que ainda esperava `/baixar -> /app` em `standalone`. Essa asserção foi alinhada ao comportamento atual aprovado: `/baixar` explícito para a nova superfície fica na instalação, enquanto `/` via ícone continua `/app`. Criado/estendido teste do ID distinto e do evento de instalação.
- **Prova pendente:** CI do novo HEAD, browser/Android/iOS físicos, instalação e separação de ícones. O Security Scan ainda reprovava por DOMPurify, Vite launch-editor, Zod e 19 avisos SAST; esses itens pertencem a PRs em andamento #61–#63, não devem ser corrigidos às cegas aqui. **NO-GO** para promover o PR inteiro a `app.consubov.com.br` até correções e validação real. A aplicação antiga no Lovable não foi tocada.
