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
