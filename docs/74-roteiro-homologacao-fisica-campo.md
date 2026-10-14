# Roteiro e Protocolo de Homologação Física de Campo (Piloto Real Android & iOS)

**Documento:** `docs/74-roteiro-homologacao-fisica-campo.md`  
**Fase do Projeto:** FASE 9 — Pré-Produção, Runbooks & Homologação de Piloto  
**Data-base:** 2026-10-14  
**Status:** PROTOCOLO OFICIAL DE HOMOLOGAÇÃO FÍSICA (PLANEJADO PARA PILOTO CONTROLADO)  
**Pré-requisito:** Conclusão de todos os gates locais automatizados (FASE 5 a 8 DEV LOCAL READY).

---

## 1. Visão Geral e Objetivos do Piloto de Campo

O presente roteiro estabelece o protocolo operacional para execução do **piloto de campo em ambiente pecuário real** (fazendas produtoras de corte e recria) com vaqueiros, capatazes e consultores técnicos.

O objetivo do piloto é comprovar fisicamente em smartphones reais (Android e iOS), sob condições de curral e pasto (ausência total de internet, poeira, sol, oscilações térmicas e intermitência de sinal), as seguintes garantias arquiteturais do CONSUBOV:
1. **Instalação PWA e Escopo Estrito:** Instalação transparente na tela de início mantendo a mesma origem e escopo `/` (sem encapsulamento nativo obsoleto).
2. **Atualização Sob Consentimento Explícito:** Entrega não intrusiva do build vNext via `UpdateBanner` sem reiniciar a aplicação de surpresa ou descartar o shell durante o trabalho.
3. **Imunidade de Operações Críticas:** Bloqueio fail-closed de atualização de Service Worker caso pesagens, leituras de cocho ou captura de fotos estejam em andamento (`hasCriticalOperations() === true`).
4. **Preservação Integral de Dados Legados:** Zero perda, zero sobrescrita e zero corrupção das 6 bases IndexedDB legadas e chaves de `localStorage`.
5. **Drenagem Offline e Sincronização Idempotente:** Acumulação de pesagens e fotos em IndexedDB local no curral offline e reconciliação idempotente com o servidor ao retornar à sede da fazenda (Wi-Fi/Starlink).
6. **Contenção e Abort:** Procedimentos claros de contingência caso ocorra falha de hardware, bateria ou interrupção no dispositivo do operador de campo.

---

## 2. Amostragem de Dispositivos e Perfis de Usuários

### 2.1. Matriz de Dispositivos Reais para Homologação

A homologação física deve ser realizada obrigatoriamente na seguinte matriz de aparelhos físicos homologados:

| ID | Plataforma | Dispositivo Típico de Campo | Navegador / Motor | Perfil Operacional | Justificativa Técnica |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEV-01** | Android 11+ | Samsung Galaxy A14 / A23 / A54 | Google Chrome (Blink) | Capataz de Curral | Aparelho predominante em fazendas; validação de performance em hardware modesto e gestão agressiva de RAM. |
| **DEV-02** | Android 12+ | Motorola Moto G52 / G73 | Google Chrome (Blink) | Vaqueiro de Manejo | Validação de persistência de Service Worker sob agressivo battery-saver da fabricante. |
| **DEV-03** | iOS 16.4+ | Apple iPhone 11 / 12 / 13 | Mobile Safari (WebKit PWA) | Consultor Técnico | Validação da política de 7 dias de evicção de IndexedDB do WebKit e comportamento de Web Locks no Safari. |
| **DEV-04** | iOS 17+ | Apple iPhone 14 / 15 Pro | Mobile Safari (WebKit PWA) | Gerente / Proprietário | Validação de câmera de alta resolução (compressão de fotos de cocho de 48MP para Blobs de 500KB no cliente). |

### 2.2. Perfis de Acesso e Responsabilidades

- **Capataz de Curral:** Operação de pesagem de lotes, pesagem individual com balança, contagem de animais, registro de lote/pasto.
- **Vaqueiro de Manejo:** Registro de ronda, leitura de cocho (notas de consumo 0 a 5), fotos de cocho e registro de salga/suplemento.
- **Consultor Técnico:** Visitas técnicas, diagnóstico zootécnico, avaliação visual de pasto (GMD estimado), score corporal e fotografias com geolocalização.
- **Gerente de Campo:** Acompanhamento de painel de contingência local, verificação de fila pendente e autorização de fechamento de lote.

---

## 3. Ambientes de Teste e Cenários de Conectividade

O piloto de campo deve ser executado simulando a rotina real de um ciclo de manejo:

```
[Sede da Fazenda]             [Curral / Pasto Distante]            [Retorno à Sede]
  (Wi-Fi / Starlink)             (Sem Conexão / Modo Avião)           (Reconexão Automática)
          │                                  │                                  │
  1. Login & Sync Inicial ────────► 2. Pesagens & Fotos Offline ──────► 3. Drenagem Idempotente
  (Download de Cadastros)            (Gravação Local IndexedDB)          (Confirmação Servidor)
```

1. **Zona A — Sede da Fazenda (Online):** Conexão Wi-Fi ou Starlink estável (latência < 80ms, 10+ Mbps). Utilizada para login inicial, provisionamento do shell offline e sincronização final.
2. **Zona B — Curral de Manejo (Offline Restrito):** Sem sinal celular ou sinal residual intermitente (Edge/GPRS instável de 0 a 1 barra). **Regra de Homologação:** Todos os aparelhos devem ser configurados em **Modo Avião com Wi-Fi desativado** durante toda a etapa de curral para garantir teste offline determinístico.
3. **Zona C — Pasto e Cocho de Salga (Offline Completo):** Distante 5 a 15 km da sede, relevo acidentado, sol pleno. Fotos de cocho e leituras sob alta luminosidade.
4. **Zona D — Transição Rural (Fringe Connectivity):** Caminho de volta do curral para a sede; o sinal 3G/4G oscila entre 0 e 2 barras, provocando frequentes conexões semi-abertas (*Half-Open TCP sockets*).

---

## 4. Checklist Sequencial de Execução de Campo

### Bloco 1: Preparação e Instalação da PWA Base

- [ ] **1.1. Inspeção de Pré-Voo no Aparelho:**
  - Bateria do smartphone com carga mínima de 70%.
  - Armazenamento livre superior a 2 GB para fotos temporárias e IndexedDB.
  - Horário e fuso horário sincronizados automaticamente (BRT / UTC-3).
- [ ] **1.2. Acesso à Aplicação via Navegador Oficial:**
  - No Android: Abrir Google Chrome, acessar a URL da aplicação e observar o carregamento inicial.
  - No iOS: Abrir Mobile Safari, acessar a URL da aplicação.
- [ ] **1.3. Instalação como Web App (PWA):**
  - No Android: Acionar "Instalar aplicativo" no menu do Chrome ou no banner nativo.
  - No iOS: Tocar no botão Compartilhar -> "Adicionar à Tela de Início".
  - **Critério de Sucesso:** Ícone criado na tela inicial com nome "CONSUBOV", abrindo em modo `standalone` sem barra de endereços do navegador e escopo `/`.
- [ ] **1.4. Autenticação Inicial e Carga de Catálogos (Online):**
  - Realizar login com as credenciais do operador.
  - Aguardar download dos catálogos essenciais (lotes, pastos, animais ativos, metas nutricionais).
  - Confirmar no console/painel local que o snapshot baseline foi gravado no IndexedDB.

---

### Bloco 2: Deslocamento para o Curral & Operação 100% Offline

- [ ] **2.1. Ativação do Modo Offline Rigoroso:**
  - Ao sair da sede, ativar o **Modo Avião** nos aparelhos de teste.
  - Fechar e reabrir a aplicação PWA a partir do ícone da tela inicial.
  - **Critério de Sucesso:** Shell PWA abre instantaneamente (< 1.5s), sem tela branca, exibindo indicador visual discreto de "Modo Offline".
- [ ] **2.2. Registro de Pesagem de Lote (Operação Crítica de Curral):**
  - Acessar a tela de Pesagem.
  - Realizar a pesagem de um lote de 20 animais com registros individuais (brinco visual, brinco RFID/eletrônico, peso em kg, lote de destino).
  - Gravar cada pesagem e observar a resposta imediata da UI (< 50ms) com armazenamento na fila atômica (`IndexedDbAtomicCommandQueue`).
- [ ] **2.3. Captura e Armazenamento de Fotos de Cocho:**
  - Acessar o módulo de Manejo de Cocho no pasto.
  - Registrar leitura de consumo de 3 cochos distintos (Nota 0, 3 e 5).
  - Capturar 2 fotos reais por cocho através da câmera do aparelho.
  - **Critério de Sucesso:** Fotos capturadas, redimensionadas e salvas em IndexedDB local como `Blob`/`ArrayBuffer` criptograficamente íntegros, sem travamento da aplicação ou perda por restrição de memória.

---

### Bloco 3: Publicação da Atualização e Teste de Proteção de Atualização

- [ ] **3.1. Disponibilização da Nova Versão (vNext):**
  - A equipe técnica publica o novo build da PWA contendo melhorias de interface e nova versão de Service Worker.
- [ ] **3.2. Retorno Momentâneo de Conectividade com Operação em Andamento:**
  - O operador desativa o Modo Avião no curral (ou aproxima-se de um ponto de rede móvel).
  - O Service Worker detecta a atualização em background e faz o download assíncrono dos novos assets para o CacheStorage secundário.
  - O banner visual de atualização surge na tela: *"Nova versão disponível — Atualizar agora"*.
- [ ] **3.3. Teste de Imunidade a Operações Críticas (`hasCriticalOperations`):**
  - Com o banner na tela, o operador inicia uma nova pesagem crítica (animal balançando na balança).
  - Tocar intencionalmente no botão "Atualizar agora".
  - **Comportamento Obrigatório Esperado:** A aplicação **NÃO reinicia**. O sistema exibe aviso: *"Operação crítica de pesagem em andamento. A atualização será aplicada com segurança após a conclusão do registro."*
  - A pesagem é gravada com sucesso sem interrupção de hardware ou perda de dados.
- [ ] **3.4. Aplicação do Update sob Consentimento:**
  - Após a finalização da pesagem e com o operador em momento de repouso, acionar "Atualizar agora".
  - A aplicação invoca `applyPendingUpdateNow()`, executa `SKIP_WAITING` e recarrega para o novo shell vNext.
  - **Critério de Sucesso:** Recarregamento limpo, versão atualizada confirmada, sem tela de erro 404 e com a mesma URL raiz `/`.

---

### Bloco 4: Auditoria de Preservação e Sincronização

- [ ] **4.1. Verificação de Preservação das Bases Legadas:**
  - Imediatamente após a atualização para o vNext, inspecionar o status das 6 bases IndexedDB locais:
    - `consubov-capataz`: intacta.
    - `consubov-session`: sessão mantida sem exigir novo login em campo.
    - `consubov-consultor-offline`: dados de visita técnica preservados.
    - `mais-arrobas-offline`: registros zootécnicos íntegros.
    - `mais-arrobas-sync`: ponte de sincronização preservada.
    - `consubov-fotos-salga`: todas as fotos em formato binário acessíveis e renderizáveis na tela.
    - Chaves de `localStorage` (`pending_backup`, `pending_backup_at`, `ma-offline-mode`) preservadas.
  - **Critério de Sucesso:** NENHUM dado foi expurgado, resetado ou corrompido durante a transição do Service Worker.
- [ ] **4.2. Drenagem Ordenada e Sincronização com o Servidor (Na Sede):**
  - Retornar à sede da fazenda e conectar-se à rede Wi-Fi principal.
  - Observar o acionamento automático do `LocalQueueDrainer` e `localSyncRound`.
  - Transmissão lote a lote dos comandos com suas respectivas chaves de idempotência.
  - Recepção dos ACKs de sucesso do servidor.
  - **Critério de Sucesso:** Status de todos os comandos transiciona de `PENDING` -> `SYNCING` -> `SYNCED`. Nenhuma duplicidade de peso gerada no servidor. Todas as fotos enviadas e associadas aos lançamentos corretos.

---

## 5. Critérios de Abort de Campo e Plano de Contenção Operacional

Em caso de comportamento anômalo durante o piloto físico, o operador e a equipe de campo devem seguir rigorosamente a matriz de abort:

### 5.1. Matriz de Severidade e Ações de Contenção

| Sintoma Observado | Severidade | Ação Imediata do Operador | Ação Técnica de Suporte |
| :--- | :---: | :--- | :--- |
| **Tela branca persistente após recarregar** | **P0 (Crítica)** | **NÃO LIMPAR DADOS DO NAVEGADOR**. Não desinstalar o app. Fechar a aba e reabrir via ícone. | Service Worker ativa automaticamente o cache de contingência N-1 (`consubov-shell-v-*`). Inspecionar console via cabo USB (ADB / Safari Web Inspector). |
| **Erro de gravação de pesagem no IndexedDB (QuotaExceededError)** | **P0 (Crítica)** | Pausar pesagem. Não reiniciar o aparelho. Acessar menu "Backup Rápido". | Executar exportação de snapshot de contingência local em arquivo `.json` via botão de emergência. Liberar espaço em disco do smartphone (vídeos do WhatsApp, apps pesados). |
| **Fotos não anexam ou aplicativo reinicia por falta de memória** | **P1 (Alta)** | Continuar pesagem numérica (prioridade zootécnica). Registrar anotação manual das fotos para re-captura. | Algoritmo de compressão de imagem no client-side reduziu canvas para resolução máxima de 1600px. Reavaliar limite de alocação de memória no WebKit iOS. |
| **Conflito de sincronização ou recusa de comando (409 Conflict)** | **P1 (Alta)** | Prosseguir com os demais itens. O comando com conflito fica marcado com aviso amarelo. | O motor de reconciliação isola o registro em fila de revisão zootécnica sem interromper os demais registros e sem aplicar sobrescrita cega (LWW proibido). |
| **Consumo excessivo de bateria (> 20%/hora com tela desligada)** | **P2 (Média)** | Desativar GPS contínuo e habilitar geolocalização pontual sob demanda no momento do clique. | Ajustar intervalos de heartbeat do background sync e desativar polling ativo quando `document.visibilityState === "hidden"`. |

### 5.2. Regra de Ouro da Contenção de Dados em Campo

> **REGRA DE SEGURANÇA MÁXIMA:** Sob nenhuma hipótese o operador ou o técnico de suporte deve executar `Limpar dados do aplicativo`, `Limpar cache e cookies` ou `Excluir aplicativo` caso existam registros pendentes na fila local. Toda e qualquer ação de recuperação deve priorizar o escoamento dos dados acumulados no IndexedDB.

---

## 6. Ata de Homologação Física e Formalização de Aceite de Campo

Para que a PWA CONSUBOV seja considerada apta para liberação comercial em produção, a seguinte ata física deverá ser assinada pelos responsáveis do piloto:

### 6.1. Ficha de Registro de Teste em Aparelho Físico

```text
================================================================================
CONSUBOV — FICHA DE HOMOLOGAÇÃO FÍSICA DE CAMPO (PILOTO OPERACIONAL)
================================================================================
Fazenda Piloto: ________________________________________________________________
Município / UF: ________________________________  Data da Realização: __/__/____
Responsável Técnico: ___________________________________________________________
Capataz / Operador: ____________________________________________________________

DISPOSITIVOS TESTADOS:
[ ] DEV-01: Samsung Galaxy (Android) - Versão SO: ______ Navegador: ____________
[ ] DEV-02: Motorola Moto G (Android) - Versão SO: ______ Navegador: ____________
[ ] DEV-03: Apple iPhone (iOS Safari) - Versão iOS: ______ Modelo: ______________

ITENS HOMOLOGADOS EM CAMPO:
[ ] 1. Instalação PWA inicial concluída com sucesso no escopo raiz "/"
[ ] 2. Operação 100% offline em Modo Avião no curral (sem falhas ou travamentos)
[ ] 3. Registro de pesagens individuais e de lotes sem lentidão (< 100ms)
[ ] 4. Captura de fotos de cocho e pasto persistidas localmente em formato binário
[ ] 5. Surgimento do banner de atualização "Atualizar agora" sem travamento
[ ] 6. Bloqueio de atualização comprovado com pesagem em andamento (hasCriticalOps)
[ ] 7. Aplicação do update para o vNext mantendo 100% dos dados legados intactos
[ ] 8. Drenagem e sincronização total ao conectar ao Wi-Fi da sede (zero perdas)
[ ] 9. Ausência de registros duplicados no servidor de homologação

STATUS FINAL DO PILOTO:
( ) HOMOLOGADO INTEGRALMENTE — Liberado para planejamento de rollout gradual.
( ) REPROVADO COM RESSALVAS — Corrigir apontamentos de campo na lista de contingência.

Assinatura do Responsável Técnico: _____________________________________________
Assinatura do Gerente de Pecuária: _____________________________________________
================================================================================
```
