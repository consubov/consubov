# Relatório Técnico Local: FASE 6 (PWA & Mobile-First)

**Data-base:** 2026-10-09  
**Branch:** `work/fase5-6-7-pwa-local`  
**Status auditado:** `PWA LOCAL READY PENDENTE — base implementada, QA integral NÃO APROVADO`

## 1. Escopo e Diretrizes P0
- **Upgrade Old -> New sem Perda de Dados:** O novo Service Worker foi projetado para atualizar *in-place* sem apagar os dados do `IndexedDB` das versões legadas (`consubov-capataz`, `consubov-session`, etc.) nem limpar o `localStorage`.
- **Atomicidade do Precache:** `vite.config.ts` injeta dinamicamente todos os chunks de rotas lazy no Service Worker, garantindo precache completo e atômico da aplicação para funcionamento offline sem telas brancas por falta de JS.
- **Controle de Atualização:** Atualizações só ocorrem via ação explícita ("Atualizar Agora"), evitando reloads indesejados durante operações críticas de campo (ex: pesagem, lançamento de lote, registro de foto).

## 2. Validações Locais
- **Testes de Integridade SW (`sw-integrity.test.cjs`):** PASS (garante que navegações servem o `index.html` do shell instalado).
- **Testes de Guarda de Operação Crítica (`sw-registration-integrity.test.cjs`):** PASS.
- **Capability Detection:** Fallbacks implementados para Câmera, GPS e Leitor de QR Code quando APIs Web nativas não estiverem disponíveis.

## 3. Pendências de Homologação
- **HOMOLOGAÇÃO REAL PENDENTE:** Validação física em dispositivos reais (iOS/Android) sob rede de dados instável ou ambiente rural deve ser realizada na FASE 9 antes de qualquer liberação de produção.

## 4. Reconciliação independente — 2026-10-09

**Risco P0 corrigido:** `forceRefresh` antes eliminava caches/unregister mesmo com a PWA offline, podendo romper a instalação em campo. Agora solicita atualização verificada ou faz reload com o SW e o shell existentes. O banner não recarrega só por detectar `version.json` divergente. Foram executados **10/10 testes locais Node do módulo de registro de SW**, inclusive interrupção de operação crítica e ausência de purge.

**Ampliação do teste de navegador:** `apps/web/pwa-fixtures/upgrade.spec.ts` inclui agora um cenário com os nomes das **seis bases legadas**, registros fictícios representativos de fila, pesagem, sessão, visita, foto Blob, ArrayBuffer e chaves de `localStorage`; verifica offline após a troca de SW no mesmo origin. O teste **não foi executado em Playwright neste ambiente** e não substitui migração real da PWA anterior para a nova. A análise estática TypeScript apontou zero erros de parsing.

**Pendências para PWA LOCAL READY:** build Vite/manifest auditado na execução final; Playwright Chromium/WebKit green; upgrade da **versão legada de produção** com dados fictícios de esquema real; validação do botão de atualização, quotas/rollback e zero perdas; check completo 5–7. Homologação física obrigatória para liberar usuários em pré-produção.
