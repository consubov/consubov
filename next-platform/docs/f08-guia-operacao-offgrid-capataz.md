> Registro histórico anterior à correção F23 de 05/11/2026. Seus resultados e rótulos de encerramento não aprovam a revisão dirty atual. Consulte `f23-runtime-local.md` e os recibos por fonte/SHA em `qa/reports/f23-final-local.md`; QA independente e produção permanecem separados.

# Manual de Operação em Campo Offgrid — Módulo Capataz CONSUBOV

**Público-Alvo**: Capatazes, Campeiros, Encarregados de Retiro e Técnicos de Manejo  
**Plataforma**: PWA CONSUBOV Fazendas (Instalável em Android/iOS e tablets industriais)  
**Status**: HOMOLOGADO PARA OPERAÇÃO LOCAL / DEV READY  
**Data/Hora**: 2026-11-05  
**Idioma**: Português do Brasil (pt-BR) / Suporte a Inglês (en-US)

---

## 1. Introdução e Objetivo

O **Módulo Capataz CONSUBOV** foi especialmente desenhado para o trabalho pecuário no pasto, operando com excelência mesmo em retiros e invernadas **onde não existe qualquer sinal de internet (3G, 4G ou Wi-Fi)**.

Com a arquitetura *Local-First*, todos os dados cadastrais da fazenda ficam salvos na memória do seu dispositivo móvel. Todas as tarefas de campo — como leitura de escore de cocho, fornecimento de salga, contagem de animais e fotos de pastagem — são gravadas instantaneamente no celular e enviadas automaticamente para a sede assim que você retornar a uma área com sinal.

---

## 2. Preparação na Sede da Fazenda (Com Wi-Fi / Sinal Ativo)

Antes de montar a cavalo ou sair na caminhonete para a lida diária, realize os seguintes passos rápidos na sede ou escritório da fazenda:

```
[ 1. Abrir o App ] ──> [ 2. Fazer Login ] ──> [ 3. Escolher a Fazenda ] ──> [ 4. Carga Completa ]
```

1. **Abrir o Aplicativo**:
   - Toque no ícone **CONSUBOV Fazendas** instalado na tela inicial do seu celular ou tablet.
2. **Entrar com suas Credenciais**:
   - Digite seu e-mail profissional de capataz (ex: `tiao.capataz@fazenda.com.br`) e sua senha.
   - O aplicativo valida suas credenciais e carrega suas permissões de trabalho.
3. **Seleção Consciente da Fazenda e Retiro (Anti-First-Match)**:
   - Se você opera em mais de uma fazenda ou retiro, o sistema exibirá uma tela solicitando a seleção do local onde você irá trabalhar hoje.
   - Escolha o retiro ou propriedade correta para garantir que os dados fiquem guardados na partição correta.
4. **Confirmação da Carga de Dados (Snapshot Local)**:
   - Verifique se a lista de pastos, lotes de gado e produtos de nutrição (sal mineral, proteinado, ração) está carregada na tela.
   - Pronto! O aparelho está abastecido e pronto para operar o dia inteiro sem internet.

---

## 3. Rotina Diária no Campo (100% Offline / Sem Sinal)

Ao chegar no pasto, mesmo com o celular em modo avião ou sem sinal de torre, utilize as abas operacionais do aplicativo:

### 3.1 Identificação do Pasto via QR Code
1. Aproxime-se da porteira ou cocho onde a placa de identificação com QR Code está fixada.
2. No app, selecione a aba **QR Pastos** e toque em **Escanear QR Code**.
3. Aponte a câmera para a placa. O app identifica automaticamente o pasto (ex: *Pasto 01 - Mombaça Sede*) e o lote de animais alocado nele.
4. *Contingência*: Se a placa estiver danificada por gado ou intempéries, selecione **Informar Falha no QR**, selecione o pasto manualmente na lista e registre uma justificativa rápida (ex: *Placa caída no mourão*).

---

### 3.2 Leitura do Escore de Cocho e Fornecimento de Salga
A avaliação rigorosa do cocho é a chave para o ganho de peso do lote. Utilize a escala técnica padrão CONSUBOV:

| Escore | Classificação Visual | Significado Técnico | Ação Recomendada |
| :---: | :--- | :--- | :--- |
| **0** | **Lambido** | Cocho totalmente vazio, fundo seco e raspado. | Falta de alimento. Aumentar o fornecimento de sacas. |
| **1** | **Limpo** | Cocho com resíduos mínimos (< 5% do fornecido). | Consumo ideal no ponto ótimo. Manter a dosagem. |
| **2** | **Sobra Leve** | Fundo coberto com camada fina (5% a 15%). | Aceitável para suplementação de transição. |
| **3** | **Sobra Média** | Sobra moderada (15% a 30%), farelo empedrado. | Reduzir fornecimento ou verificar aguada/sombra. |
| **4** | **Sobra Excessiva** | Cocho cheio (> 30% restante), produto molhado. | Risco de intoxicação ou perda. Limpar cocho e repor. |

#### Como Lançar no Aplicativo:
1. Abra a aba **Cocho & Salga**.
2. Selecione a nota do escore (toque no botão grande correspondente de 0 a 4).
3. Selecione o produto fornecido (ex: *Sal Mineral 80* ou *Proteinado Águas 0.1%*).
4. Informe o número de sacas abastecidas no cocho (ex: `2` sacas de 25 kg).
5. O sistema atualiza o status do cocho localmente para *lambido*, *limpo* ou *com sobra*.
6. Toque em **Gravar Leitura**. O registro é salvo imediatamente no aparelho com carimbo de hora e status **Pendente de Envio**.

---

### 3.3 Captura Fotográfica e Compressão Automática Client-Side
Para garantir a comprovação visual do estado do cocho para o Gerente da fazenda:
1. Na tela de registro, toque em **Tirar Foto do Cocho**.
2. Aponte para o interior do cocho mostrando a extensão da linha de cocho.
3. O aplicativo comprime a imagem localmente no próprio aparelho:
   - Fotos pesadas de 5MB a 12MB são convertidas em imagens leves (~120KB a 200KB), mantendo nitidez nítida.
   - Cada foto recebe um código de integridade SHA-256 e fica gravada no banco do celular.
   - O comando de texto leve é desassociado do binário da imagem, garantindo que mesmo com conexão fraca o texto suba em milissegundos.

---

### 3.4 Contagem de Rebanho e Apontamento de Mortalidade
1. Na aba **Contagem**, confirme a contagem visual do lote de gado.
2. Informe o número total de cabeças avistadas no piquete.
3. Caso identifique animais doentes ou baixas, informe a quantidade de bezerros/mortos e a causa provável (ex: *Acidente em valeta*, *Cobra*, *Causa desconhecida*).
4. Ao gravar, a contagem substitui o saldo do lote localmente de forma imediata.

---

## 4. Garantias de Durabilidade e Proteção Contra Falhas no Aparelho

O sistema conta com proteções automáticas de nível industrial:

- **Bateria Acabou ou Celular Desligou**: Todos os lançamentos efetuados antes do desligamento permanecem salvos com segurança no armazenamento protegido (`IndexedDB`). Ao ligar o aparelho novamente, nada se perde.
- **Fechamento Acidental do App**: Ao reabrir o aplicativo, sua fila de pendências continua exatamente onde estava, exibindo o contador de lançamentos prontos para envio.
- **Proteção Contra Interrupções (Travas de Quiescência)**: Se houver uma atualização de versão do sistema pronta para instalar, o aplicativo **nunca** reiniciará enquanto você estiver tirando fotos, escaneando QR code ou preenchendo formulários de cocho. A atualização só assume o controle quando o aparelho estiver completamente ocioso.

---

## 5. Retorno à Sede e Sincronização Automática

Ao final do dia de campo, ao aproximar-se da sede, curral ou alojamento com Wi-Fi:

```
[ Sinal Detectado ] ──> [ Fila Inicia Drenagem ] ──> [ ACK Confirmado ] ──> [ Fila Limpa (0) ]
```

1. **Detecção Automática**: O sistema percebe a reconexão à internet automaticamente, sem que você precise tocar em nenhum botão.
2. **Drenagem Ordenada da Fila (Outbox)**:
   - Os comandos são enviados em fila estritamente cronológica para a API central.
   - Para cada leitura aceita, o servidor devolve um comprovante atômico (**ACK**).
   - O item é removido da fila local e transferido para o histórico de sincronizados.
3. **Resolução de Leituras Concorrentes (Merge Aditivo)**:
   - Se outro campeiro também avaliou o mesmo pasto pela manhã, o sistema junta as duas observações na linha do tempo (Merge Aditivo), preservando o histórico de ambos sem apagar ninguém.
4. **Confirmação Visual**: O indicador verde no topo da tela exibirá: **"Tudo Sincronizado (0 pendências)"**.
