# Design: Finalização da FASE 5 e Início da FASE 6 (App Shell)

## 1. Contexto
Este documento detalha a estratégia técnica para concluir os requisitos pendentes da Fase 5 (Web Ready) e iniciar a arquitetura de empacotamento mobile da Fase 6.

## 2. Objetivos da Fase 5 (Finalização)
- Completar 100% do checklist de qualidade.
- Garantir que a pipeline de CI (lint, typecheck, test, build) esteja passando todos localmente.
- Validar acessibilidade (Axe) e performance (Lighthouse).

## 3. Plano de Ação Passo a Passo

### Passo 1: Auditoria e Limpeza do Ambiente Local
- **Ação:** Executar `bun check` para identificar falhas imediatas.
- **Ação:** Corrigir erros de lint e tipagem encontrados no `apps/web`.
- **Ferramentas:** `bun`, `eslint`, `tsc`.

### Passo 2: Consolidação de Testes E2E e Smoke
- **Foco:** `apps/web/e2e/phase5-web-ready.spec.ts`.
- **Ação:** Expandir os testes Playwright para cobrir:
    - Login e Logout.
    - Redirecionamentos de permissão (Admin vs Usuário).
    - Responsividade em telas de tablet/mobile (simulação de viewport-size).
- **Ferramentas:** `playwright`.

### Passo 3: Qualidade de Interface (Axe/Lighthouse)
- **Ação:** Rodar o servidor de preview local do `apps/web`.
- **Ação:** Executar `@axe-core/cli` nas páginas de login e home.
- **Ação:** Gerar relatórios Lighthouse para validar métricas de LCP, CLS e TBT.
- **Ferramentas:** `@axe-core/cli`, `lighthouse`.

### Passo 4: Auditoria de Bundle e Segurança
- **Ação:** Analisar o tamanho do bundle de produção.
- **Ação:** Verificar se há segredos expostos nos arquivos gerados.
- **Meta:** Ajustar o budget de bundle se necessário.

### Passo 5: Início da Fase 6 (App Shell)
- **Ação:** Criar a branch `feature/phase6-app-shell`.
- **Ação:** Definir a tecnologia de empacotamento (Capacitor vs Tauri).
- **Ação:** Criar as interfaces de contrato (Ports) para recursos nativos (Câmera, GPS).

## 4. Critérios de Sucesso
- Todos os itens do checklist de Fase 5 marcados como `[x]`.
- Pipeline de CI local rodando de forma limpa sem erros.
- Relatórios de performance e acessibilidade acima de 90.
- Branch de Fase 6 criada com arquitetura de base definida.
