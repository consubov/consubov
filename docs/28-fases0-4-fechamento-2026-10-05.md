# Fechamento consolidado — FASES 0–4

Data: 2026-10-05  
Linha de consolidação: `fix/fase4-audit-20261005` / PR #36

## Resultado

As FASES 0, 1, 2, 2A, 2B e 3 foram revalidadas contra o Checklist Mestre, documentação permanente, testes arquiteturais e gates atuais. Nenhuma regressão material dessas fases permanece aberta nesta linha.

A FASE 4 fica concluída **no escopo permitido antes de banco remoto/FASE 8**: o legado funcional foi preservado, regressões comprovadas foram corrigidas, superfícies foram inventariadas, fronteiras críticas receberam contratos explícitos e os fluxos que dependem da persistência autoritativa futura foram preparados sem conectar infraestrutura remota nem inventar regra de negócio.

Isso não antecipa FASE 5, FASE 7 ou FASE 8.

## Revalidação FASES 0–3

| Fase | Resultado | Evidência principal |
|---|---|---|
| 0 — governança | APROVADA | ADRs, política estrutural, política de terceiros e instruções vigentes permanecem no repositório. |
| 1 — segurança do legado | APROVADA | Edge Functions endurecidas permanecem cobertas; suíte Edge e security scans fazem parte do gate atual. |
| 2 / 2A / 2B | APROVADAS | monólito modular, ports/adapters, OpenAPI, tenancy/RBAC deny-by-default, auditoria e contratos de integração permanecem protegidos pelos testes da API. |
| 3 — fundação Web/API | APROVADA | guardrail de imports Supabase, repositories incrementais, API local sem banco remoto, IndexedDB de teste e invariantes offline continuam cobertos. |

## FASE 4 — aceite por bloco

### 4.1 Autenticação e navegação por perfil — CONCLUÍDO

- login legado preservado;
- recuperação e redefinição de senha materializadas sobre o provider legado por repository dedicado;
- erros da recuperação são genéricos e não expõem existência de conta nem detalhe do provider;
- todos os nove papéis possuem destino explícito em `authNavigation.ts`;
- `ProtectedRoute` continua aguardando resolução do papel e negando papel incompatível;
- sessão offline/refresh e logout explícito permanecem no `AuthProvider`;
- Playwright cobre login público, recuperação, rota protegida, login autenticado simulado para administrador e gerente, redirect por perfil e mobile/desktop;
- testes unitários cobrem recuperação/redefinição e mapa de redirects.

### 4.2 Administração/gerência — CONCLUÍDO POR PARIDADE

O baseline funcional documenta e preserva Admin/Gerente: dashboards, usuários, fazendas, retiros, pastos, produtos, ciclos, mapas, QR, auditoria, fotos, relatórios, notificações, premiação e fábrica. Nenhuma dessas superfícies foi removida nesta fase.

Estados e responsividade continuam responsabilidade das telas existentes; o smoke Playwright protege acesso público/protegido e ausência de overflow no fluxo de autenticação. A homologação extensiva visual pertence ao gate da FASE 5 e não é antecipada aqui.

### 4.3 Estrutura pecuária — CONCLUÍDO

- fazenda → retiro → pasto permanece a hierarquia operacional comprovada;
- `PastoDetailPage` rejeita combinação de rota cujo retiro não pertence à fazenda ou cujo pasto não pertence ao retiro;
- tenant continua organização contratante, não fazenda nem conta de usuário;
- IDs são tratados como estáveis/opacos; versão de UUID não é inferida;
- mapas e elementos existentes permanecem preservados;
- curral/polígono/linha só são considerados quando existirem no fluxo legado; nenhuma entidade nova foi criada para preencher checklist;
- autorização real continua server-side/tenant-scoped; coerência de rota é apenas proteção de contexto/UX.

### 4.4 QR no Web — CONCLUÍDO

- emissão existente preservada;
- conferência usa parser isolado `extractQrUuid`;
- QR representa identidade de recurso, nunca autorização;
- parser aceita identificador em valor puro/URL e rejeita entrada sem identificador;
- lookup de conferência trata recurso ausente/inativo como não encontrado;
- `QrScanner` permanece port de plataforma para futura leitura local no App.

### 4.5 Nutrição e salga — CONCLUÍDO POR INVENTÁRIO/PARIDADE

Produtos, categorias/dietas, lançamentos, solicitações, consumo, relatórios/PDF e seus pontos de dados permanecem mapeados no baseline e no mapa de bounded contexts.

Fórmulas e parâmetros zootécnicos existentes **não foram alterados**. Qualquer fórmula ainda não validada por especialista continua explicitamente fora da autoridade desta fase; o fechamento significa preservar/inventariar o comportamento atual, não homologar cientificamente fórmulas.

### 4.6 Estoque e transferências — CONCLUÍDO NO GATE PRÉ-PERSISTÊNCIA

O legado mantém entradas, saídas, movimentações, transferências, recebimentos, destinos e cálculo de saldo já existente.

Para a arquitetura futura, `CRITICAL_WRITE_POLICIES` torna obrigatório para estoque e transferência:
- idempotency key;
- versão conhecida;
- autoridade atômica server-side;
- estratégia de conflito explícita por domínio antes de conectar persistência;
- realtime não autoritativo;
- LWW genérico proibido.

A estratégia concreta de resolução de conflito **não é inventada** nesta fase. Ela precisa ser definida quando o adapter autoritativo existir. O Web legado não é promovido a autoridade transacional.

### 4.7 Animais/lotes — CONCLUÍDO POR PARIDADE

O inventário cobre ocupação, movimentações, mortalidade, abate, categorias, lotes e histórico. Eventos/históricos existentes continuam preservados.

Operações históricas que já funcionam não são reescritas nem apagadas. Mudanças futuras que exigirem append-only/versionamento devem respeitar rastreabilidade e o contrato de escrita crítica.

### 4.8 Consultoria e visitas — CONCLUÍDO POR PARIDADE

Visitas, curral/confinamento quando existentes, fábrica, escores, indicadores, fotos, tópicos, assinaturas, Penn State, despesas, comprovantes, revisão, PDF e histórico permanecem cobertos pelo inventário.

O legado já invalida/reabre PDF quando uma conferência finalizada é editada. A política futura autoritativa de versionamento pós-finalização deve preservar histórico e não pode ser inventada antes do backend autoritativo.

### 4.9 Fábrica de ração — CONCLUÍDO NO GATE PRÉ-PERSISTÊNCIA

Matérias-primas, entradas, estoque, fórmulas, ingredientes, produção/batidas, baixas, ajustes, transferências, recebimentos, destinos e operadores permanecem mapeados/preservados.

`feed_mill_batch` está incluído no contrato de escrita crítica: idempotência, versão conhecida, autoridade atômica, conflito explícito por domínio, realtime não autoritativo e proibição de LWW genérico. Testes de concorrência com persistência real ficam para a fase em que existir o adapter real.

### 4.10 Pecuarista e pesagem — CONCLUÍDO NO GATE PRÉ-PERSISTÊNCIA

Clientes, fazendas, lotes, categorias, animais, histórico de pesos, pesagem individual/lote, apartação, busca, resumo/exportação e filas local-first existentes permanecem preservados.

A suíte offline protege UUID/local-first, reenvio idempotente e reconciliação já comprovados. `weighing` participa do contrato de escrita crítica. Nenhum suporte genérico a balança é prometido sem modelo/protocolo validado.

### 4.11 Relatórios e inteligência — CONCLUÍDO POR INVENTÁRIO/PARIDADE

Dashboards, indicadores, gráficos/consumo, relatórios de visita/despesa/salga e PDFs/exportações permanecem inventariados.

Origem/filtros/RPCs comprovados estão registrados no baseline e no mapa de dados. Timezone de relatórios segue o contrato IANA explícito já definido na FASE 2. Fórmula ou arredondamento não comprovado não é alterado nem “ajustado para bater”.

### 4.12 Landing e área pública — CONCLUÍDO NO ESCOPO ATUAL

Landing, CMS/configuração, parceiros e leads permanecem existentes. A entrada de autenticação é pública; rotas protegidas negam sessão ausente.

O hardening de push já impede capacidade privilegiada anônima. A notificação push do lead anônimo continua desabilitada até existir fluxo server-side apropriado; registro do lead/notificação in-app preservados. Campanhas permanecem congeladas.

SEO técnico básico preserva metadados/entrada pública atuais; expansão de marketing não faz parte da fase.

### 4.13 Push/realtime — CONCLUÍDO

Push mantém a autorização server-side endurecida da FASE 1. Realtime atual está inventariado.

`RealtimeProvider` formaliza realtime como canal de leitura/invalidação: evento realtime não autoriza nem finaliza escrita crítica; estado autoritativo deve ser relido pelo repository/API. Notificações e realtime têm fronteiras substituíveis sem antecipar provider novo.

### 4.14 SyncVet — CONCLUÍDO COMO MÓDULO CONGELADO

Rotas, Edge Functions e repositories SyncVet existentes estão inventariados. A reorganização não cria feature nova nem redefine domínio por inferência.

Backlog de expansão fica para FASE 10/pós-produção. O fechamento desta fase significa **preservar e limitar**, não expandir.

### 4.15 Relatto/campanhas/IA — CONCLUÍDO COMO FRONTEIRA CONGELADA

Integrações existentes permanecem inventariadas:
- Relatto demo via `relatto-demo-signup`;
- IA de análise de retiro via `analisar-retiro`;
- landing/campanhas permanecem no legado existente.

Nenhuma expansão funcional foi feita. Novas features de Relatto/campanhas/IA permanecem para pós-produção/novo escopo.

## Correções de auditoria incorporadas

- endpoints sync 501 sem implementação removidos;
- guardrail fake/no-op de LWW removido;
- documentação de tenant/UUID corrigida;
- setup IndexedDB/Vitest reconciliado;
- teste que mockava o próprio `PastoDetailPage` substituído;
- artefatos acidentais removidos;
- coerência fazenda/retiro/pasto validada;
- parser QR testado;
- recuperação de senha criada atrás de repository;
- guardrail de Supabase ajustado para permitir provider somente na fronteira de repository, mantendo páginas/hooks sem novos imports diretos;
- tipagens de writes em `pastos` corrigidas;
- contrato de writes críticos evita inventar estratégia concreta de conflito.

## Fronteiras que continuam em fases posteriores

Estas não são pendências da FASE 4:

- homologação visual/a11y/performance/coverage completa: FASE 5;
- wrapper nativo: FASE 6;
- motor offline definitivo/SQLite: FASE 7;
- banco/storage/staging e transações reais da nova API: FASE 8;
- deploy/produção: FASE 9;
- expansão SyncVet/Relatto/campanhas/IA: FASE 10.

## Gate final

Para considerar este fechamento válido, o HEAD final do PR #36 deve manter:
- `bun run check` verde;
- Playwright FASE 4 verde em desktop/mobile;
- Edge Functions verdes;
- smoke HTTP/OpenAPI verde;
- SAST verde;
- dependency vulnerability scan verde;
- secret scanning verde;
- diff sem arquivo acidental;
- QA `AUDITORIA DE QUALIDADE` aprovado.

Se qualquer gate falhar após alteração deste documento, o fechamento volta a `REPROVADO` até correção.
