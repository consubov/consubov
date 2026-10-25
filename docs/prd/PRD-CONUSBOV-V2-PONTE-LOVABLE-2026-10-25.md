# PRD P0 — Ponte de atualização CONSUBOV 1.155.0 → 2.0.0 no Lovable
**Data:** 2026-10-25. **Projeto:** Consubov.app, commit legado `f1172663b3d179419cc8d0911f10f2d9a85f5149`.
**Destino:** `https://app.consubov.com.br/baixar`. **Código do novo App:** https://github.com/consubov/consubov/pull/64 (DRAFT).
**Estado:** implementação para revisão, **NÃO PUBLICAR** nem enviar notificação antes de QA e liberação explícita.

## Objetivo e comportamento de usuário
Um único aviso de atualização, um único botão primário **Autorizar e atualizar**, texto claro informando que o usuário autoriza proteger e sincronizar seus dados para a nova aplicação. Sem outro checkbox ou seleção de arquivos, perfil, banco ou foto. Segundo botão opcional **Agora não**. Todos os processos após autorização são automáticos, com progresso simples. Instalação da PWA no iPhone exige passos do próprio SO; não prometer instalação silenciosa nem login cross-origin sem autenticação válida.

## Escopo
1. Inspecionar o código existente antes de editar, respeitar `AGENTS.md`. A UI global de versão é `UpdatePopup`; `UpdateBanner` está desativado; há `AvisoManutencao` já implantado. A campanha de migração precisa ter **releaseId único `consubov-2.0.0`**, sem empilhar avisos. Deixar **feature flag OFF por padrão** no build/preview até liberação. Não disparar push real durante implementação.
2. Quando usuário autenticado abrir o App antigo e a migração for liberada no futuro, mostrar a notificação uma vez por dispositivo/release e por usuário; a autorização inicia a preparação. Não fechar, atualizar SW ou redirecionar em trabalho crítico (salga, pesagem, visita). Se offline ou sem sessão válida, preservar dados, explicar e retomar quando online após consentimento já registrado.
3. Fazer inventário **não destrutivo** das 6 bases: `consubov-capataz`, `consubov-session`, `consubov-consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `consubov-fotos-salga`. Base ausente em perfil não utilizado ≠ falha; schema desconhecido/consulta parcial = impedir migração, preservar dados. Nunca copiar senhas, access/refresh tokens, sessão nem storage de outro tenant.
4. Sincronizar todos os domínios relevantes com mecanismos EXISTENTES (não refazer regras): Capataz `useSyncEngine` deve receber comando explícito manual/force no contexto de migração; Consultor: `drainMutations/retryFailedMutations` e `photoQueue` com fotos/Blobs; Mais Arrobas: `flushMaAndCount/sincronizarOffline`, incluindo ACKs; salga `processarFilaFotosSalga`; outras filas reais presentes no inventário. Evitar reenvio duplicado, checar pais de fotos e confirmar cada item no backend com IDs estáveis. BackupMirror de localStorage é parcial e NÃO prova backup dos seis DBs.
5. Proteção: snapshot/checkpoint de migração sem deletar objetos locais; preservação de fotos inteiras e não apenas metadados. Contagem de fila zero não é prova suficiente para concluir: exigir comprovante verificável pelo servidor dos dados/arquivos, por usuário/tenant/device/snapshot e liberação de um handoff de uso único com TTL ou protocolo equivalente autenticado. Se serviço de ACK ainda não existir, construir portas/adapters e relatório de impedimento, mantendo o botão não liberado para usuários. Não executar DDL/migration remota/RLS nem inserir dados em produção sem autorização específica.
6. Em sucesso comprovado, abrir APENAS `https://app.consubov.com.br/baixar` com referência opaca de migração no fragmento URL se protocolo disponível; nunca tokens de sessão ou PII na URL. Novo App exige login válido e reidrata dados remotos; no iOS o fragmento pode perder-se ao instalar, por isso o backend também deverá localizar handoff único por identidade autenticada. **Sem ACK completo não navegar.**
7. Manter PWA antiga íntegra mesmo depois da migração: não limpar IndexedDB, cache de trabalho, não desinstalar, não redirecionar o origin inteiro. Usuários que ficaram offline não podem ser tratados como migrados.

## Fora do escopo
Site institucional, Relatto, SyncVet, melhoria de login offline, criação de funcionalidades novas, refatoração geral, redesenho UI, mudança de hospedagem/DNS, reversão de deploy, ações nas contas reais do cliente, reconstrução do banco.

## Arquivos candidatos e conflitos
`AGENTS.md`, `src/App.tsx`, `src/components/UpdatePopup.tsx`, `src/components/AvisoManutencao.tsx`, `src/hooks/useSyncEngine.ts`, `src/lib/maisArrobasQueue.ts`, `src/lib/maOffline.ts`, `src/lib/fotoSalgaQueue.ts`, `src/lib/consultorOffline/{db,mutationQueue,photoQueue}.ts`, `public/sw.js`. Preferir novos módulos isolados em `src/platform/migration/`. **Não alterar Service Worker** sem revisão especializada; já houve incidente de tela branca no legado por `await client.navigate()` dentro de `activate`. Preservar cache atômico atual e proteção de `trabalhoEmAndamento`.

## Critérios de aceite
- Uma mensagem e um aceite explícito, sem popups duplicados e sem alterar outras superfícies.
- Zero perda e zero duplicação: enfileirados, logs, fotos e arquivos, independente de tempo offline.
- Falha de internet, autenticação, tenant divergente, schema desconhecido, Blob inválido, servidor sem ACK ou escrita concorrente: **NO-GO**, App antigo acessível e retriable.
- Não há link de destino antes da confirmação íntegra do backend; não usar resultado fake/mock como aprovação de migração.
- Sem leitura/escrita de tokens cross-origin e sem serviço role no browser.

## Testes, QA e documentação
Executar testes unitários/TypeScript/build do legado e regressão de PWA/SW, simular 6 IDBs (presentes/ausentes), filas e fotos grandes, ACK perdido, retry, queda de rede, conta trocada, 401/403, dupla autorização, escrita concorrente, usuário sem push. E2E de duas origens e Android/iPhone físicos são gates de publicação e precisam ser relatados como pendentes se não executados. Capturar resultados reais por SHA. Atualizar documentação técnica e informar diff, riscos e instruções de QA para Checklist Mestre/Obsidian.

## Git/segurança/proibições
Trabalhar na versão/código atual do Lovable com alterações mínimas; se possível criar branch isolada sem interferir no GitHub/ambiente publicado. **Não publicar**, não mudar domínio, não enviar push, não alterar Supabase remoto, schema, RLS, segredos, DNS/Vercel, não criar migração que apague dados, não remover funcionalidades de outros produtos nem forçar atualização do SW. Qualquer ferramenta pedir autorização para operação irreversível → parar e relatar; usuário aprova separadamente.

## Relatório final obrigatório
Estado antes/depois, commit/SHA, arquivos alterados, como a autorização é registrada, fontes de dados/filas cobertas, como se verifica ACK de fotos, resultado de testes reais, lacunas de integração com PR #64 e backend, GO/NO-GO, rollback e ações proibidas não realizadas.
