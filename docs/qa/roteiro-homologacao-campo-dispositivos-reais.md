# Protocolo de Homologação em Campo - Dispositivos Reais & PWA
**ID do Documento:** `docs/qa/roteiro-homologacao-campo-dispositivos-reais.md`  
**Referência:** `docs/74-roteiro-homologacao-fisica-campo.md` & `16-PRD-PWA-INSTALACAO-RETOMADA.md` (Obsidian)  
**Projeto:** CONSUBOV (PWA / Offline-First / Agronegócio)  
**Data:** 2026-10-29  
**Versão:** 1.0.0 (Pronto para Execução em Campo)  

---

## 1. Introdução e Objetivos de Engenharia de QA

Este documento consolida o **Roteiro Prático e Detalhado de Homologação Física em Dispositivos Reais** para o ecossistema CONSUBOV. Ele traduz as garantias arquiteturais offline-first, a fila atômica idempotente baseada em IndexedDB, a compressão de imagens local e o gerenciamento crítico de ciclo de vida do Service Worker em cenários operacionais de campo de alta fidelidade técnica.

O objetivo deste roteiro é fornecer um checklist executável e reproduzível para o responsável de campo validar as capacidades do aplicativo nos piores cenários (ausência total de conexão, fechamento abrupto de app, transição intermitente de rede, e hardware móvel sobrecarregado).

---

## 2. Matriz de Dispositivos e Requisitos de Hardware para Testes

Os testes em campo devem ser distribuídos na seguinte matriz de dispositivos físicos reais:

| ID de Teste | Plataforma / OS | Dispositivos Homologados | Navegadores Exigidos | Hardware de Apoio |
| :--- | :--- | :--- | :--- | :--- |
| **DEV-01 (Android)** | Android 11+ (Ex: Samsung Galaxy A14/A23/A54) | Hardware com restrição de RAM e bateria | Google Chrome (Blink) | Balança Tru-Test / Coimma via Bluetooth, Bastão RFID Allflex |
| **DEV-02 (iOS)** | iOS 16.4+ ou iOS 17+ (Ex: iPhone 12/13/14 Pro/15) | Hardware premium, WebKit restrito | Mobile Safari (WebKit) | Balança Tru-Test / Coimma via Bluetooth, Bastão RFID Allflex |

---

## 3. Matriz de Cobertura de Perfis (Os 9 Perfis Operacionais)

A homologação exige validação de escopo e segmentação por perfil para garantir que as rotas e caches salvos localmente não se cruzem de forma insegura (Tenant Isolation & Role Security).

| # | Perfil do Usuário | Foco do Teste de Campo (Fluxo Crítico Offline) | Critério de Aceitação da Rota e Visibilidade |
| :-: | :--- | :--- | :--- |
| **1** | **Admin (Administrador)** | Painel de controle de contingência, visualização de sincronizações globais, gerenciador de filas e logs de auditoria. | Acesso completo a logs. Acesso exclusivo à limpeza assistida de filas locais obsoletas. |
| **2** | **Gerente de Campo / GMD** | Visualização do GMD (Ganho Médio Diário), fechamento de lotes zootécnicos, uso do seletor circular infinito (`CircularMonthSelect`). | Bloqueio de fechamento de lote caso haja pesagem pendente na fila local. Dados carregados do cache local de tela (`screenCache.ts`). |
| **3** | **Capataz de Curral** | Manejo de pesagem de lotes em massa, movimentação de pasto, leitura de brincos e registro de apartação. | Carregamento ultrarrápido (<100ms) de registros offline. Fila local atômica ativa em `consubov-capataz`. |
| **4** | **Consultor Técnico** | Visitas de diagnóstico, cálculo de score corporal, score de pastagem, planejamento nutricional e fotos de vistoria. | Dados de diagnóstico salvos localmente na base `consubov-consultor-offline`. |
| **5** | **Escritório** | Lançamento de faturamento, romaneios, cadastro base de animais e conferência de auditorias fiscais. | Acesso via navegador convencional em desktop/tablet. Bloqueio de dupla entrada se os dados estiverem pendentes na fila do curral. |
| **6** | **Pesador** | Operação rápida de pesagem individualizada ligada à balança eletrônica, conferência de brinco versus peso. | Bloqueio estrito de timeout de hardware. Registro sequencial sem tela de espera. |
| **7** | **Pecuarista (Proprietário)** | Relatórios executivos de rendimento de carcaça, dashboards financeiros agregados e projeções de abate. | Rota limpa de leitura e dashboards cacheados. Sessão de visualização sem capacidade de mutação destrutiva offline. |
| **8** | **Operador de Fábrica** | Lançamento de ordens de produção de ração, pesagem de ingredientes, controle de estoque de sal mineral e suplementos. | Fórmulas nutricionais guardadas localmente. Sincronização de batidas de ingredientes. |
| **9** | **SyncVet (Manejo Sanitário)**| Aplicação de vacinas, medicamentos em lote, controle de carências de fármacos e protocolo de IA (Inseminação). | Alerta de carência ativo offline. Bloqueio de liberação de animal sob efeito de carência sanitária. |

---

## 4. Protocolos de Integração Física de Hardware

### 4.1. Integração com Balanças Eletrônicas via Bluetooth (Tru-Test / Coimma)
As balanças eletrônicas transmitem as pesagens em tempo real via Bluetooth em formato de string serial contínua ou sob demanda (ex: `"ST,   245.5,kg\r\n"`).
*   **Ação de Homologação Física:**
    1.  Conectar o smartphone à balança eletrônica através do menu de emparelhamento do aplicativo (ou emular a conexão usando um terminal Bluetooth/MTS).
    2.  No Modo Avião (Offline), colocar pesos sucessivos na balança (ou simular eventos de pesagem).
    3.  **Fluxo de Teste:** Registrar o peso recebido na interface. O aplicativo deve capturar o valor imediatamente, associá-lo ao animal atual e gravá-lo no IndexedDB na fila atômica, disparando a próxima leitura de brinco em menos de 100ms.
    4.  **Cenário de Instabilidade:** Desligar a balança no meio de uma pesagem ativa. O aplicativo deve disparar um aviso visual discreto ("Conexão com a balança perdida") e permitir que o operador digite o peso manualmente de forma opcional sem que o aplicativo trave ou reinicie.

### 4.2. Bastões/Leitores RFID de Gado (Keyboard Wedge ou Bluetooth)
Os leitores RFID transmitem o número do brinco eletrônico (Ex: ISO 11784/11785 - `982000123456789`) simulando um teclado físico que digita o código seguido de uma quebra de linha (`Enter`) ou através de eventos de Clipboard/Input diretos.
*   **Ação de Homologação Física:**
    1.  Posicionar o foco do cursor no campo "Brinco Eletrônico".
    2.  Realizar a leitura rápida de 5 bastões/brincos em sequência rápida.
    3.  **Fluxo de Teste:** O app deve escutar o evento `keydown` (Enter) ou a alteração rápida de input, realizar a busca offline do animal no cache em milissegundos, disparar o bipe sonoro de sucesso e avançar para o campo de peso de forma automatizada.
    4.  **Deduplicação Obrigatória:** Ler o mesmo brinco duas vezes seguidas em menos de 2 segundos. O app deve ignorar a leitura duplicada e manter o fluxo ativo para evitar registros repetidos (debounce e deduplicação de hardware de 2000ms).

### 4.3. Captura e Compressão de Fotos sem Rede (Módulo de Cocho e Pastagem)
As câmeras dos smartphones modernos tiram fotos de alta resolução (12MP a 48MP) que geram arquivos pesados (4MB a 15MB). Sem rede, salvar várias dessas fotos cruas estouraria o limite do IndexedDB e travaria a memória do navegador.
*   **Ação de Homologação Física:**
    1.  Acessar a tela de "Leitura de Cocho" e acionar a câmera para capturar uma foto de um pasto.
    2.  **Mecanismo de Compressão (Client-Side Canvas Resize):** O aplicativo deve processar a imagem no navegador usando um elemento `canvas`, redimensionando-a para no máximo `1600px` de largura/altura com qualidade JPEG ajustada para `0.75` (75%).
    3.  **Fluxo de Armazenamento:** Converter o resultado compactado em um `Blob` binário (`image/jpeg`) com tamanho final entre `200KB` e `500KB`.
    4.  Gravar o binário diretamente no banco `consubov-fotos-salga`.
    5.  Confirmar que 5 fotos tiradas em sequência não geram lentidão, vazamentos de memória ou o fechamento forçado da página pelo sistema operacional (especialmente no iOS Safari, altamente suscetível a erros de limite de memória de Canvas).

### 4.4. Resumos de Ciclo de Vida do Aplicativo (Kill & Resume e Warm Start)
Testar o comportamento quando o aplicativo perde o foco ou é encerrado pelo sistema operacional por falta de memória.
*   **Testes de Warm Start (Alternância de Apps):**
    *   Com uma pesagem preenchida e incompleta na tela, abrir o WhatsApp ou tirar uma foto na câmera nativa e retornar ao CONSUBOV.
    *   *Resultado esperado:* O aplicativo deve manter a tela exatamente no mesmo estado, preservando todos os campos preenchidos, foco e filtros de scroll intactos.
*   **Testes de Cold Start (Kill & Resume):**
    *   Preencher parcialmente um formulário de vistoria e fechar o aplicativo arrastando-o para cima na bandeja do SO (Force Close). Reabrir o app a partir do ícone da tela inicial.
    *   *Resultado esperado:* O mecanismo de `RouteMemory` deve restaurar a rota autorizada com a sessão ativa. Se a sessão for válida, reabrir na rota do formulário restaurando o progresso (se aplicável) ou na Dashboard principal com segurança de identidade (sem reutilizar rotas ou caches de outros usuários que fizeram logout).

---

## 5. Roteiro Passo a Passo de Execução de Homologação

Abaixo estão definidos os **5 Cenários Sequenciais Obrigatórios** que o técnico em campo deve executar.

```
┌──────────────────────────────────────────────┐
│  CENÁRIO 1: Instalação e Login (Online)     │
└──────────────────────┬───────────────────────┘
                       │ (Sucesso)
                       ▼
┌──────────────────────────────────────────────┐
│  CENÁRIO 2: Operação em Modo Avião           │
│  - 20 pesagens e brincos                     │
│  - Captura e compactação de fotos de cocho   │
└──────────────────────┬───────────────────────┘
                       │ (Modo Avião Ativo)
                       ▼
┌──────────────────────────────────────────────┐
│  CENÁRIO 3: Simulação de Abruptos            │
│  - Kill & Resume do App                     │
│  - Troca de Aplicativos (Multitarefa)       │
│  - Teste de Logout Estrito                  │
└──────────────────────┬───────────────────────┘
                       │ (Sucesso)
                       ▼
┌──────────────────────────────────────────────┐
│  CENÁRIO 4: Teste de Imunidade de Update     │
│  - Ativar rede móvel/intermitência          │
│  - Detectar vNext (Banner de Atualização)   │
│  - Operação Crítica (Bloqueio SW)           │
│  - Consentimento e Atualização Limpa        │
└──────────────────────┬───────────────────────┘
                       │ (Update Aplicado)
                       ▼
┌──────────────────────────────────────────────┐
│  CENÁRIO 5: Drenagem e Auditoria Final       │
│  - Conexão Wi-Fi Sede da Fazenda             │
│  - Sincronização automática e idempotente    │
│  - Auditoria dos 6 IndexedDBs                │
└──────────────────────────────────────────────┘
```

---

### CENÁRIO 1: Primeiro Acesso, Instalação PWA e Login (Sede da Fazenda - ONLINE)

1.  **Acesso Inicial:** No navegador do aparelho (Chrome no Android, Safari no iOS), acessar a URL oficial de homologação.
2.  **Validação de Origem:** Confirmar que a URL acessada é no domínio oficial (ex: `app.consubov.com.br`) e não em subdomínios legados ou mistos.
3.  **Instalação da PWA:**
    *   *Android Chrome:* Aceitar o banner de instalação ou ir em Menu -> "Instalar aplicativo".
    *   *iOS Safari:* Ir no botão Compartilhar -> "Adicionar à Tela de Início".
4.  **Abertura Standalone:** Fechar o navegador. Abrir a aplicação exclusivamente através do novo ícone criado na tela inicial do aparelho.
5.  **Critério de Aceitação 1 (PWA Limpa):** O app deve abrir em tela cheia (sem a barra de endereços do navegador superior ou inferior), com visualização fluida e sem oferecer uma segunda instalação se já estiver rodando em modo standalone.
6.  **Login & Download:** Fazer login com o usuário correspondente ao perfil técnico de teste. Aguardar a carga de download de todos os catálogos básicos (animais, lotes, pastos, etc.).

---

### CENÁRIO 2: Operação em Curral sem Conectividade (Offline Estrito - MODO AVIÃO)

1.  **Modo Avião:** Sair da sede, deslocar-se para o curral e ativar o **Modo Avião** nos smartphones de teste (Wi-Fi e Dados Móveis desativados).
2.  **Inicialização Fria Offline:** Fechar a aplicação na bandeja do sistema e abri-la novamente pelo ícone da tela inicial.
3.  **Critério de Aceitação 2:** O app deve carregar em menos de `1.5s`, exibindo o indicador visual nítido de **"Modo Offline"**. O formulário de pesagem e de vistoria de campo devem estar perfeitamente acessíveis.
4.  **Pesagem de Lote (Simulada ou Real com Hardware):**
    *   Abrir a tela de pesagem e realizar o manejo de **20 animais**.
    *   Efetuar a leitura do brinco de gado pelo bastão (ou digitar no campo brinco).
    *   Receber o peso da balança via Bluetooth (ou digitar manualmente).
    *   Salvar o registro.
5.  **Leitura e Foto de Cocho:**
    *   Abrir a tela de Manejo de Cocho.
    *   Selecionar 3 pastos e registrar nota de consumo de 0 a 5.
    *   Tirar **2 fotos reais** por pasto/cocho com a câmera integrada.
6.  **Critério de Aceitação 3:** Cada registro de animal deve salvar instantaneamente (<100ms) sem travar a interface de digitação. As fotos de alta resolução do aparelho devem ser reduzidas localmente para menos de 500KB e salvas no banco `consubov-fotos-salga` sem fechar ou resetar a página por falta de memória.

---

### CENÁRIO 3: Abrupção de Ciclo de Vida (Kill & Resume, Multitask e Logout)

1.  **Teste de Multitarefa (Alternar entre Apps):**
    *   Em uma pesagem em andamento (pesando o 10º animal do lote), minimizar o CONSUBOV, abrir a câmera nativa do celular e tirar uma foto, abrir outro app pesado e reabrir o CONSUBOV.
    *   *Critério de Aceitação 4:* O app deve restaurar de forma imediata na mesma tela com o 10º animal pré-preenchido e os dados anteriores persistidos no cache local.
2.  **Teste de Kill (Forçar Fechamento):**
    *   Em uma tela de preenchimento, fechar o aplicativo de forma abrupta removendo-o da bandeja de processos do sistema operacional.
    *   Reabrir o aplicativo pelo ícone da tela inicial.
    *   *Critério de Aceitação 5:* O app executa o Cold Start. O mecanismo de `RouteMemory` lê os dados de sessão válidos, valida o usuário e redireciona de volta à última rota válida sem expor dados de sessões ou contas anteriores.
3.  **Teste de Logout Estrito:**
    *   Tocar no botão **"Sair"** (Logout).
    *   *Critério de Aceitação 6:* O app deve limpar todas as credenciais de sessão de forma síncrona, invalidar tokens locais e retornar à tela de Login. Se o operador colocar o aparelho em Modo Avião e tentar voltar pelo botão físico "Back/Voltar" do aparelho ou digitar a rota `/app` na URL, o sistema deve impedir a restauração e redirecionar estritamente à tela de Login.

---

### CENÁRIO 4: Atualização de Shell (SW Update) sob Operação Crítica

1.  **Notificação de Nova Versão:** Com a aplicação em Modo Avião e operações de pesagem de lote ativas, a equipe de desenvolvimento publica um novo build vNext (ex: v1.155.0).
2.  **Restabelecer Rede Móvel:** Desativar o Modo Avião para permitir conectividade móvel ou aproximar-se da rede Wi-Fi.
3.  **Download em Background:** O Service Worker em segundo plano detecta a nova versão e baixa os novos assets para o cache secundário sem incomodar o usuário.
4.  **Banner de Update:** Surge o banner visual de atualização: *"Nova versão disponível — Atualizar agora"*.
5.  **Teste de Operação Crítica:**
    *   O operador inicia uma pesagem (animal posicionado na balança, tela de pesagem preenchida).
    *   **Ação Provocadora:** O operador toca propositalmente no botão "Atualizar agora".
    *   *Critério de Aceitação 7 (Bloqueio Fail-Closed):* O aplicativo **NÃO deve atualizar** nem recarregar a tela. Graças à propriedade `hasCriticalOperations() === true`, o sistema intercepta a ação e exibe uma notificação de segurança: *"Operação crítica em andamento. A atualização será aplicada com segurança após a conclusão do registro."*
6.  **Atualização sob Consentimento:**
    *   Salvar a pesagem atual.
    *   Com a tela de pesagem vazia e em repouso zootécnico, tocar em "Atualizar agora".
    *   *Critério de Aceitação 8:* A aplicação roda `applyPendingUpdateNow()` e atualiza de forma limpa, carregando a nova versão em `/` sem telas de erro 404.

---

### CENÁRIO 5: Drenagem Sincronizada de Dados e Auditoria Final

1.  **Drenagem Automática:** Retornar à sede da fazenda e conectar-se ao sinal Wi-Fi da Starlink/Sede.
2.  **Processamento da Fila Atômica:** O `LocalQueueDrainer` deve ativar de forma imediata e silenciosa, enviando os dados acumulados lote a lote usando chaves de idempotência UUID para o backend.
3.  **Critério de Aceitação 9:** Os registros de pesagem e as fotos de cocho compactadas devem transicionar de status de forma sequencial de `PENDING` -> `SYNCING` -> `SYNCED`.
4.  **Auditoria contra Duplicações:** Acessar o sistema do escritório e confirmar que todos os 20 animais pesados no curral estão lançados corretamente com seus respectivos pesos e sem nenhuma linha duplicada gerada (idempotência perfeita).
5.  **Verificação dos 6 Bancos IndexedDB:** Executar uma verificação para garantir que a atualização de versão e o processo de sincronização mantiveram as bases locais de forma íntegra.

---

## 6. Ata Oficial de Campo e Ficha de Registro de Homologação

Abaixo segue a ficha técnica de validação para ser preenchida e assinada digitalmente ou fisicamente pelos testadores de campo autorizados.

```text
================================================================================
CONSUBOV — FICHA OFICIAL DE ACEITE E HOMOLOGAÇÃO FÍSICA DE CAMPO
================================================================================
Fazenda Piloto: ________________________________________________________________
Localização (Município / UF): __________________________________________________
Data da Execução do Teste: ____/____/2026

DADOS DOS DISPOSITIVOS DE TESTE:
┌─────────┬─────────────────┬───────────────────┬──────────────────────────────┐
│ ID Disp │ Marca e Modelo  │ Versão do SO      │ Navegador Base Utilizado     │
├─────────┼─────────────────┼───────────────────┼──────────────────────────────┤
│ DEV-01  │                 │ Android _____+    │ Chrome Mobile                │
├─────────┼─────────────────┼───────────────────┼──────────────────────────────┤
│ DEV-02  │                 │ iOS ______+       │ Safari Mobile (WebKit)       │
└─────────┴─────────────────┴───────────────────┴──────────────────────────────┘

STATUS DA AUDITORIA POR CRITÉRIO DE ACEITE:
[ ] CA-01: Instalação PWA inicial sem duplicações de prompt e rodando standalone.
[ ] CA-02: Execução de 20 pesagens e brinco 100% offline em Modo Avião sem lags.
[ ] CA-03: Leituras de cocho e 6 fotos capturadas e comprimidas localmente (<500KB).
[ ] CA-04: Mudança de apps (multitarefa) preserva formulários e foco perfeitamente.
[ ] CA-05: Encerramento abrupto (Force Close) restaura última rota legítima do usuário.
[ ] CA-06: Logout estrito limpa credenciais e impede retrocesso de rota (Back Button).
[ ] CA-07: Bloqueio de SW Update ativa perfeitamente quando operação crítica está ativa.
[ ] CA-08: Atualização de Service Worker executada sob consentimento mantendo dados.
[ ] CA-09: Sincronização idempotente ao reconectar na sede (zero perdas, zero dups).

================================================================================
 PARECER DA EQUIPE DE QA DE CAMPO:

 ( ) APROVADO INTEGRALMENTE - Sistema robusto e pronto para liberação comercial.
 ( ) REPROVADO COM RESSALVAS - Corrigir falhas listadas abaixo antes do rollout.

 Observações de Campo / Ajustes Necessários:
 _______________________________________________________________________________
 _______________________________________________________________________________
 _______________________________________________________________________________

 Assinatura do Responsável Técnico de QA: _______________________________________
 Assinatura do Gerente de Pecuária / Piloto: _____________________________________
================================================================================
```

---

## 7. Regras de Ouro e Procedimentos de Aborto para Testadores

### 7.1. Regra de Ouro Inviolável de Dados Offline
> **NUNCA execute "Limpar dados", "Limpar armazenamento de cookies" ou "Remover Aplicativo" caso existam registros na fila offline local.** Toda ação corretiva de P0 deve priorizar a extração segura ou escoamento da fila IndexedDB acumulada para evitar perdas financeiras e de dados de campo.

### 7.2. Matriz de Contenção e Contramedidas

*   **Sintoma: Tela branca persistente no Safari / Chrome Mobile**
    *   *Solução rápida:* Fechar a aba ou aplicativo por completo e reabrir pelo ícone. Se o problema persistir, o Service Worker CONSUBOV recuperará automaticamente a versão de cache redundante (Safe Recovery SW).
*   **Sintoma: Erro de limite de cota de armazenamento de fotos (QuotaExceededError)**
    *   *Solução rápida:* O sistema oferece um botão "Backup de Emergência JSON" no menu administrativo. Use esta opção para baixar a fila local e re-importar no painel administrativo mais tarde.
*   **Sintoma: Desconexão constante do bluetooth do leitor ou balança**
    *   *Solução rápida:* Usar a digitação manual de contingência e o buffer integrado que enfileira os registros na ordem certa e os processa sequencialmente.
