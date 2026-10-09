# Relatório Técnico Local: FASE 6 (PWA & Mobile-First)

**Data-base:** 2026-10-09  
**Branch:** `work/fase5-6-7-pwa-local`  
**Status:** `PWA LOCAL READY (PREPARADO PARA HOMOLOGAÇÃO)`

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
