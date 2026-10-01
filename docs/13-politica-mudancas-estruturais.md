# CONSUBOV — Política de Mudanças Estruturais

> **Fase:** 0.3 — Governança  
> **Versão:** 1.0  
> **Data:** 2026-10-01  
> **Status:** VIGENTE após inclusão no repositório  
> **Objetivo:** definir quando uma mudança exige revisão arquitetural, ADR, atualização documental, compatibilidade, versionamento e validação adicional.

---

# 1. Princípio geral

Toda mudança estrutural do CONSUBOV deve ser:

- explícita;
- rastreável;
- reversível quando possível;
- compatível com tenancy;
- compatível com offline quando aplicável;
- segura;
- documentada no mesmo trabalho em que o código muda.

Código e documentação não podem evoluir de forma independente.

> **Regra obrigatória:** se uma alteração muda arquitetura, contrato, comportamento, permissão, fluxo, integração, modelo de dados ou operação, a documentação afetada deve ser atualizada no mesmo PR/tarefa.

---

# 2. O que é considerado mudança estrutural

Exige revisão arquitetural explícita qualquer alteração relevante em:

- backend/API;
- arquitetura Web;
- App/wrapper nativo;
- tenancy;
- autenticação;
- autorização/RBAC;
- modelo de dados central;
- persistência;
- migrations;
- sync/offline;
- resolução de conflitos;
- idempotência;
- storage;
- jobs/queues;
- realtime;
- API pública;
- integrações;
- webhooks;
- eventos;
- observabilidade;
- secrets/credenciais;
- infraestrutura;
- deploy;
- CI/CD;
- contratos públicos;
- dependências centrais;
- estratégia de migração;
- operação de produção.

Mudanças locais e reversíveis que não alteram contrato, regra, segurança, tenant ou infraestrutura não exigem ADR automaticamente.

---

# 3. Quando criar ou atualizar um ADR

Criar um ADR quando a mudança:

- define ou substitui uma decisão arquitetural;
- troca stack, framework, provider ou padrão principal;
- altera fronteiras entre módulos;
- muda a estratégia de persistência;
- muda a estratégia de autenticação/autorização;
- muda a estratégia de offline/sync;
- muda a estratégia de API pública;
- introduz tecnologia difícil de remover;
- introduz lock-in relevante;
- muda uma decisão já registrada em ADR anterior.

Não criar ADR para:

- bugfix local;
- refactor interno sem alteração de contrato;
- ajuste visual;
- teste adicional;
- documentação simples;
- mudança trivial e reversível.

Se um ADR vigente for superado:

- não apagar o ADR antigo;
- marcar o antigo como **Substituído/Superseded**;
- criar novo ADR;
- referenciar a decisão substituída.

---

# 4. Revisão especial obrigatória

Mudanças nestas áreas exigem atenção reforçada antes de implementar:

## 4.1 Auth / RBAC / Tenancy

Validar:

- identidade real do caller;
- tenant resolvido server-side;
- autorização por recurso/ação;
- risco de escalada;
- risco de acesso cross-tenant;
- auditoria;
- testes 401/403;
- regressão de perfis atuais.

## 4.2 Sync / Offline

Validar:

- idempotência;
- retry;
- timeout;
- command_id;
- device_id;
- base_version;
- conflito;
- cursor/checkpoint;
- retomada;
- anexos;
- troca de usuário/tenant;
- comportamento sem internet.

## 4.3 Estoque / Transferências / Pesagens / Fábrica

Validar:

- transação;
- concorrência;
- histórico;
- idempotência;
- versões;
- reconciliação;
- conflito;
- duplicidade;
- rollback.

Não usar `last-write-wins` genérico.

## 4.4 Migração / Banco

Validar:

- schema;
- constraints;
- índices;
- integridade referencial;
- compatibilidade;
- dry-run;
- reconciliação;
- rollback;
- dados legados;
- tenant isolation.

## 4.5 Storage / Arquivos

Validar:

- tenant;
- autorização;
- URLs temporárias;
- tamanho/tipo;
- retry;
- retenção;
- associação segura do arquivo;
- falha parcial.

## 4.6 API pública / Integrações

Validar:

- versionamento;
- autenticação;
- scopes;
- tenant;
- rate limit;
- idempotência;
- auditoria;
- dados expostos;
- depreciação;
- estratégia de substituição.

---

# 5. Compatibilidade e versionamento

Toda mudança de contrato deve ser classificada como:

- **compatível**;
- **compatível com depreciação**;
- **incompatível/breaking**.

## 5.1 API

A API deve permanecer versionada sob:

```text
/api/v1/...
/api/v1/sync/...
/api/public/v1/...
```

Breaking change não deve ser introduzida silenciosamente.

Quando houver quebra:

- documentar motivo;
- criar versão/rota compatível quando necessário;
- definir período de transição;
- atualizar OpenAPI;
- atualizar consumidores;
- registrar rollback/migração.

## 5.2 Eventos e Webhooks

Eventos relevantes que atravessam fronteiras devem ser versionados.

Exemplo:

```text
inventory.transfer.created.v1
weighing.recorded.v1
```

Mudança incompatível no payload deve gerar nova versão.

## 5.3 Banco

Migrations devem ser:

- versionadas;
- reproduzíveis;
- revisáveis;
- preferencialmente reversíveis;
- acompanhadas de estratégia de rollback quando necessário.

---

# 6. Política de depreciação

Antes de remover endpoint, campo, evento ou comportamento consumido:

1. identificar consumidores;
2. marcar como deprecated;
3. documentar substituto;
4. definir janela de transição;
5. atualizar OpenAPI/documentação;
6. remover somente após confirmação de migração.

Não remover contrato usado por Web/App/integração sem rastrear impacto.

---

# 7. Feature flags e configuração por tenant

Feature flag só deve ser criada quando houver necessidade real de:

- rollout gradual;
- piloto;
- comportamento por tenant;
- migração progressiva;
- desligamento seguro de recurso.

Não usar feature flag para esconder código inacabado indefinidamente.

Toda flag deve possuir:

- nome claro;
- owner;
- objetivo;
- default;
- escopo;
- data/condição para remoção;
- documentação.

Evitar forks de código por cliente.

---

# 8. Nova dependência

Antes de adicionar dependência de produção, registrar:

- problema concreto resolvido;
- alternativas existentes;
- licença;
- manutenção;
- impacto no bundle/runtime;
- risco de lock-in;
- segurança;
- compatibilidade com Bun/TypeScript;
- compatibilidade com React/App quando aplicável;
- impacto offline;
- estratégia de atualização;
- estratégia de remoção/substituição.

Dependência central nova exige revisão arquitetural.

---

# 9. Código open source

Para código copiado/adaptado de terceiros:

- registrar origem;
- registrar repositório;
- registrar versão/commit;
- registrar licença;
- preservar atribuições obrigatórias;
- revisar GPL/AGPL e licenças recíprocas;
- adaptar à tenancy/RBAC do CONSUBOV;
- criar testes próprios;
- não copiar secrets, endpoints ou configurações do projeto de origem.

Não copiar código sem origem rastreável.

---

# 10. Atualização documental obrigatória

Toda mudança relevante deve atualizar, no mesmo trabalho, os artefatos aplicáveis.

## 10.1 Instruções-Mestre

Atualizar quando houver nova decisão vigente ou quando uma pendência for resolvida.

Arquivo:

```text
CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md
```

## 10.2 ADRs

Atualizar/criar quando houver decisão arquitetural relevante.

Local:

```text
docs/adr/
```

## 10.3 Documentação técnica

Atualizar o documento temático afetado em:

```text
docs/
```

Exemplos:

- arquitetura;
- API;
- auth/tenancy;
- offline/sync;
- acesso a dados;
- fluxo de desenvolvimento.

## 10.4 OpenAPI/Swagger

Qualquer alteração em endpoint deve atualizar o contrato OpenAPI no mesmo PR/tarefa.

Cobrir:

- request;
- response;
- erros;
- auth;
- tenant;
- scopes;
- idempotência;
- exemplos quando necessário.

## 10.5 Checklist/Status

Atualizar quando:

- tarefa iniciar;
- tarefa concluir;
- tarefa for bloqueada;
- decisão mudar;
- novo risco for descoberto.

## 10.6 README / Runbooks

Atualizar quando a mudança afetar:

- setup;
- comandos;
- ambiente;
- deploy;
- operação;
- troubleshooting;
- restore;
- secrets;
- integração.

---

# 11. Regra de sincronização entre código e documentação

Uma tarefa não está concluída se:

- código mudou e documentação ficou desatualizada;
- API mudou e OpenAPI não foi atualizado;
- arquitetura mudou e ADR não foi atualizado;
- decisão foi tomada e Instruções-Mestre ainda mostram `[PENDENTE]`;
- fluxo operacional mudou e runbook não foi atualizado;
- status/checklist continua indicando estado incorreto.

> **Documentação faz parte da Definition of Done.**

---

# 12. Fluxo obrigatório para mudança estrutural

Antes de implementar:

1. identificar o tipo de mudança;
2. classificar o risco;
3. identificar documentos afetados;
4. identificar contratos afetados;
5. verificar impacto em tenancy;
6. verificar impacto em auth/RBAC;
7. verificar impacto em offline/sync;
8. verificar impacto em dados/migração;
9. verificar compatibilidade;
10. definir rollback;
11. decidir se precisa ADR;
12. definir testes.

Durante:

1. alterar o menor conjunto coerente de arquivos;
2. preservar compatibilidade;
3. evitar refactor paralelo;
4. adicionar testes;
5. atualizar documentação no mesmo trabalho.

Depois:

1. rodar validações;
2. revisar diff;
3. revisar OpenAPI;
4. revisar ADRs;
5. revisar documentação técnica;
6. atualizar checklist/status;
7. registrar pendências reais.

---

# 13. Classificação de risco

## Baixo

Exemplo:

- ajuste local;
- refactor interno;
- melhoria de teste;
- correção visual;
- mudança reversível sem contrato.

Pode seguir fluxo normal.

## Médio

Exemplo:

- API interna;
- módulo compartilhado;
- adapter;
- dependência relevante;
- fluxo compartilhado.

Exige plano curto e regressão.

## Alto

Exemplo:

- auth;
- RBAC;
- tenancy;
- banco;
- migrations;
- estoque;
- pesagem;
- sync;
- concorrência;
- segredo;
- API pública;
- infraestrutura;
- produção.

Exige:

- análise de impacto;
- rollback;
- testes específicos;
- revisão arquitetural;
- documentação obrigatória.

---

# 14. Ações que continuam exigindo autorização explícita

Esta política não autoriza automaticamente:

- apagar dados;
- `reset --hard`;
- `drop`;
- `truncate`;
- mudança de produção;
- mudança de secret;
- rotação de credencial;
- mudança de permissão administrativa;
- migration irreversível;
- commit;
- push;
- merge;
- deploy;
- release;
- publicação;
- criação de custo;
- contratação de serviço pago.

É permitido preparar código, plano, diff e comandos, mas parar antes do efeito externo/irreversível.

---

# 15. Checklist de PR/Tarefa estrutural

```text
[ ] Mudança classificada por risco
[ ] Impacto em tenant analisado
[ ] Impacto em auth/RBAC analisado
[ ] Impacto em offline/sync analisado
[ ] Impacto em dados/migração analisado
[ ] Compatibilidade avaliada
[ ] Rollback definido
[ ] ADR criado/atualizado quando necessário
[ ] OpenAPI atualizado quando necessário
[ ] Documentação técnica atualizada
[ ] Instruções-Mestre atualizadas quando necessário
[ ] Checklist/status atualizado
[ ] Testes adicionados/atualizados
[ ] Lint/typecheck/build/test executados quando aplicável
[ ] Nenhum secret/debug/arquivo acidental
[ ] Pendências declaradas
```

---

# 16. Critério de conclusão da Fase 0.3

A Fase 0.3 estará concluída quando:

- [ ] este documento estiver no repositório;
- [ ] mudanças estruturais que exigem ADR estiverem definidas;
- [ ] revisão especial por área crítica estiver definida;
- [ ] compatibilidade/versionamento estiverem definidos;
- [ ] depreciação estiver definida;
- [ ] feature flags estiverem governadas;
- [ ] nova dependência estiver governada;
- [ ] código open source estiver governado;
- [ ] atualização documental obrigatória estiver definida;
- [ ] documentação fizer parte explícita da Definition of Done.

---

# 17. Local recomendado

Adicionar este arquivo em:

```text
docs/13-politica-mudancas-estruturais.md
```

Depois de incluído, atualizar o `docs/README.md` para referenciá-lo.
