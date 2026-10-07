# CONSUBOV — Handoff e Continuidade entre Conversas

> **Versão:** 1.3  
> **Data:** 2026-10-07  
> **Função:** manter continuidade entre conversas diferentes do ChatGPT dentro do Projeto CONSUBOV.  
> **Local principal:** Fontes do Projeto CONSUBOV no ChatGPT.  
> **Cópia opcional:** raiz do repositório para agentes de código.

---

# 1. Regra principal

Este arquivo existe para que uma nova conversa consiga continuar o CONSUBOV sem depender da memória do chat anterior.

Toda nova conversa deve recuperar o estado do projeto a partir de:

1. `CONSUBOV_HANDOFF_CONTINUIDADE.md`;
2. `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`;
3. Checklist Mestre do CONSUBOV no Notion;
4. demais fontes do Projeto que sejam relevantes à tarefa;
5. código/repositório atual quando a tarefa depender de implementação real.

> O Checklist Mestre no Notion é a referência operacional mais atual para saber o que está concluído, em andamento, bloqueado ou livre.

---

# 2. Protocolo obrigatório ao iniciar uma nova conversa

Antes de propor trabalho, gerar PRD ou dizer qual é o próximo passo:

1. ler este Handoff;
2. ler as Instruções-Mestre;
3. consultar o Checklist Mestre no Notion;
4. identificar tarefas `🟡 EM ANDAMENTO`;
5. identificar PRDs já existentes;
6. evitar duplicar trabalho de outros agentes;
7. identificar o próximo item livre;
8. só então responder.

A primeira resposta da nova conversa deve ser curta e informar:

```text
FASE ATUAL:
...

EM ANDAMENTO:
...

PRÓXIMO ITEM LIVRE:
...
```

---

# 3. Fontes do ChatGPT x arquivos do repositório

Nem todo arquivo existente em `docs/` precisa obrigatoriamente estar carregado como Fonte do Projeto ChatGPT.

## 3.1 Fontes mínimas recomendadas no Projeto ChatGPT

Manter sempre:

```text
CONSUBOV_HANDOFF_CONTINUIDADE.md
CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md
Consubov_Pre_Requisitos_Plataforma_v1.docx.pdf
```

Também podem ser adicionados como fontes documentos que sejam usados com frequência.

## 3.2 Documentos existentes apenas no repositório

Se uma tarefa depender de um arquivo como:

```text
docs/13-politica-mudancas-estruturais.md
docs/14-politica-codigo-terceiros.md
docs/adr/*
docs/README.md
```

e ele não estiver disponível nas Fontes do Projeto, a conversa não deve inventar seu conteúdo.

Nesse caso:

- usar o que já estiver consolidado nas Instruções-Mestre/Handoff/Notion;
- pedir ou acessar o arquivo específico somente se a tarefa realmente depender de seu conteúdo detalhado.

A ausência de um arquivo secundário não deve bloquear automaticamente uma conversa de planejamento quando Master + Handoff + Notion forem suficientes.

---

# 4. Hierarquia de fonte de verdade

Quando houver conflito, usar esta ordem:

```text
1. pedido explícito mais recente do responsável pelo projeto;
2. decisão registrada mais recente e aprovada;
3. segurança, integridade de dados e isolamento de tenant;
4. requisitos/PRDs e critérios de aceite aprovados;
5. código/configuração comprovadamente em uso;
6. ADRs/documentação técnica atualizados;
7. Checklist Mestre atualizado;
8. CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md;
9. documento de pré-requisitos;
10. comportamento observado do legado;
11. hipótese.
```

Não substituir decisão específica do CONSUBOV por preferência genérica de arquitetura.

---

# 5. Decisões vigentes

Toda nova conversa deve partir destas decisões:

```text
PROJETO:
CONSUBOV

TIPO:
SaaS multitenant de gestão pecuária.

BACKEND:
Bun + TypeScript.

ARQUITETURA:
monólito modular, API-first, ports/adapters.

WEB / BACKOFFICE:
React + Vite + TypeScript atuais, evoluídos incrementalmente.

BANCO — DIREÇÃO:
PostgreSQL atrás de repositories/adapters.

API:
versionada em /api/v1;
OpenAPI/Swagger obrigatório;
preparada para Web, App, Sync e API pública futura.

APP/PWA:
PWA instalável sobre React/Vite é a direção mobile vigente para iOS e Android;
WebNative/Capacitor fica adiado até pós-produção.

PERSISTÊNCIA LOCAL PWA:
IndexedDB atrás de LocalDatabase; SQLite somente em eventual wrapper futuro.

ORDEM DE ENTREGA:
Web → PWA → Offline PWA → infraestrutura remota/staging → produção → wrapper opcional pós-produção.

CAPACIDADES DO DISPOSITIVO:
GPS, câmera/foto/vídeo, microfone/áudio, QR/barcode, arquivos/share, push, badges, clipboard, wake lock, orientação, conectividade, sensores e WebRTC via capability detection/fallbacks.

REMOTO AGORA:
não conectar a nova arquitetura ao Supabase/PostgreSQL remoto;
não configurar Vercel/deploy;
não executar migration remota.

EXTENSIBILIDADE:
integrações futuras por ports/adapters;
eventos, webhooks e API pública previstos sem overengineering.

MÓDULOS CONGELADOS PARA EXPANSÃO:
SyncVet, Relatto, campanhas e IA, salvo nova decisão explícita.
```

---

# 6. Forma de trabalhar no chat

Responder:

- curto e direto;
- sem introduções longas;
- com passos executáveis;
- detalhado somente quando solicitado;
- sem inventar resultado de teste, comportamento ou regra de negócio;
- distinguindo, quando necessário:

```text
FATO:
SUPOSIÇÃO:
PENDENTE:
```

Fazer no máximo uma pergunta quando ela for realmente necessária para decidir.

---

# 7. Fluxo de execução do projeto

Quando o usuário perguntar “qual o próximo passo?”:

1. consultar o Notion;
2. verificar itens em andamento;
3. verificar dependências;
4. escolher o próximo item livre sem conflito;
5. explicar resumidamente;
6. se o usuário autorizar execução por agente, gerar PRD Markdown;
7. marcar no Notion como `🟡 EM ANDAMENTO` somente quando a tarefa tiver sido realmente atribuída/iniciada.

Ao concluir:

1. validar evidências;
2. atualizar documentação;
3. atualizar o Notion;
4. marcar `✅ CONCLUÍDO` somente com evidência;
5. indicar o próximo item livre.

---

# 8. Padrão obrigatório de PRD para agentes

Todo PRD entregue a agente deve conter, conforme aplicável:

```text
1. objetivo
2. contexto
3. escopo
4. fora do escopo
5. arquivos/áreas esperadas
6. regras de segurança
7. critérios de aceite
8. testes obrigatórios
9. validações obrigatórias
10. documentação a atualizar
11. ações proibidas
12. convivência com outros agentes
13. gate de QA
14. regras de Git
15. relatório final obrigatório
16. prompt pronto para o agente
```

Para tarefas de alto risco, considerar explicitamente:

- auth;
- tenancy;
- RBAC;
- secrets/PII;
- logs;
- idempotência;
- concorrência;
- rollback;
- testes negativos;
- impacto offline/sync.

---

# 9. QA obrigatório quando definido no PRD

Para revisão de implementação, preferir a skill:

```text
qualidade-visionario
```

Track:

```text
AUDITORIA DE QUALIDADE
```

Resultado:

```text
QA: APROVADO
```

ou:

```text
QA: REPROVADO
```

Se reprovado:

1. corrigir;
2. repetir testes;
3. repetir QA;
4. não fazer push enquanto a reprovação permanecer.

Não afirmar que QA foi executado sem evidência.

---

# 10. Git e trabalho paralelo

Antes de alterar código:

```sh
git status
git branch --show-current
```

Quando apropriado e seguro:

```sh
git pull --ff-only
```

Em trabalho paralelo:

- não apagar trabalho de outro agente;
- não sobrescrever cegamente;
- não usar `reset --hard`;
- não usar force push;
- revisar conflitos;
- repetir testes depois da integração.

Commit/push só devem ocorrer:

- quando explicitamente autorizados pelo usuário; ou
- quando o PRD aprovado contiver autorização explícita.

Quando houver autorização de push, exigir antes:

- implementação concluída;
- testes relevantes verdes;
- QA aprovado quando exigido;
- documentação atualizada;
- diff revisado;
- ausência de arquivos acidentais.

---

# 11. Ações externas/irreversíveis

Não executar automaticamente sem autorização explícita:

- exclusão de dados reais;
- migration remota;
- alteração de schema remoto;
- alteração/rotação de secrets;
- alteração de produção;
- deploy;
- release;
- publicação;
- force push;
- `reset --hard`;
- `drop`;
- `truncate`;
- criação de custo relevante;
- alteração crítica de permissões administrativas.

---

# 12. Documentação obrigatória

Toda mudança relevante deve atualizar, no mesmo trabalho e quando aplicável:

```text
código
docs/
ADRs
OpenAPI/Swagger
CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md
Checklist Mestre no Notion
README/runbooks
handoff/status
```

Uma tarefa não está concluída se o código mudou e a documentação oficial correspondente ficou desatualizada.

---

# 13. Estado atual — snapshot

> **Data do snapshot:** 2026-10-07  
> **Regra:** sempre confirmar o estado real no Notion e repositório antes de atribuir trabalho novo.

```text
DECISÃO MOBILE:
PWA mobile-first em iOS e Android.

EMPACOTAMENTO NATIVO:
ADIADO até pós-produção; apps/mobile/ experimental fica congelado.

PERSISTÊNCIA LOCAL PWA:
IndexedDB atrás de LocalDatabase.

FASE 5:
[PENDENTE] reconciliar evidência final de QA/CI antes de tratar o gate como definitivamente fechado.

FASE 6:
planejamento atualizado para PWA; implementação do novo checklist ainda pendente.

FASE 7:
offline-first será construído sobre a PWA/IndexedDB.

PRÓXIMO ITEM LIVRE:
reconciliar FASE 5 e, em seguida, executar o gate PWA MOBILE READY da FASE 6.
```

---

# 14. Atualização deste Handoff

Este arquivo é dinâmico.

Gerar uma nova versão para substituir a Fonte do Projeto quando houver mudança relevante, por exemplo:

- fase concluída;
- novo PRD criado;
- tarefa atribuída;
- tarefa concluída;
- bloqueio importante;
- decisão arquitetural alterada;
- mudança do próximo passo.

Não registrar histórico infinito.

Manter apenas:

- decisões vigentes;
- estado atual;
- trabalhos em andamento;
- bloqueios;
- próximo passo.

---

# 15. Encerramento de uma conversa de trabalho

Ao finalizar um bloco relevante, registrar resumidamente:

```text
RESULTADO:
...

EM ANDAMENTO:
...

DOCUMENTOS/PRDs:
...

NOTION:
...

GIT:
...

PENDÊNCIAS:
...

PRÓXIMO PASSO:
...

HANDOFF:
precisa atualizar? SIM | NÃO
```

Se `HANDOFF: SIM`, gerar a versão atualizada para o usuário substituir nas Fontes do Projeto.

---

# 16. Prompt mínimo para abrir uma nova conversa

Na primeira mensagem de um novo chat dentro do Projeto CONSUBOV, o usuário pode escrever apenas:

> Leia primeiro `CONSUBOV_HANDOFF_CONTINUIDADE.md` e `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md` nas Fontes do Projeto. Depois consulte o Checklist Mestre no Notion, identifique o que está em andamento e continue a partir do próximo item livre, seguindo o padrão definido no Handoff. Responda curto e direto.

---

# 17. Regra final

Toda decisão relevante deve responder:

> **Isso continua correto quando existem vários tenants, usuários diferentes, internet ruim, retry, conflito, dados legados e operação real em fazenda?**

Se a resposta for não, a solução ainda não está adequada ao núcleo do CONSUBOV.