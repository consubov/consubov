# Relatório Técnico Local: FASE 8 (PostgreSQL Local Dry-Run & Contratos)

**Data-base de Execução:** 2026-10-14T09:42:01Z até 2026-10-14T09:42:03Z  
**Branch:** `work/fase5-6-7-pwa-local` (PR #43 draft)  
**HEAD Commit:** `6cf987874a7c6bf20c1bb9243cfb4c36a7331600`  
**Working Tree:** `dirty=true`  
**Registro de Evidência:** `.qa/runs/20261014T094201Z-phase8-6cf987874a7c-539/result.json`  
**Status do Gate:** `PASS` (`commandExitCode: 0`, `sourceUnchanged: true`, `exitCode: 0`)  
**Fingerprint de Integridade:** `3c840e4537278f4cc99b4f0a6ef3f99cfae8cbf7c8566f71408acf1299c00bb1`  

---

## 1. Resumo Executivo da Fase 8

A FASE 8 comprova a prontidão do ecossistema de dados relacionais e contratos server-side do CONSUBOV em regime estritamente local (dry-run hermético sem conexões remotas ao Supabase ou nuvem):
1. **Matriz de Origem-Destino Canônica (`docs/70-matriz-origem-destino-postgresql.md`):** Mapeamento exaustivo de todas as 6 bases legadas do IndexedDB (`consubov-capataz`, `consubov-session`, `consubov-consultor-offline`, `mais-arrobas-offline`, `mais-arrobas-sync`, `consubov-fotos-salga`) e comandos da FASE 7 para as tabelas relacionais PostgreSQL correspondentes (`lancamentos`, `pesagens`, `observacoes`, `fotos_salga`, `leituras_balancao_pecuarista`, `visitas_tecnicas`, etc.).
2. **Schema Canônico e Migrações Idempotentes:** Criação de `supabase/migrations/20261014000000_phase8_unified_relational_contracts.sql` (UP) implementando a tabela `public.atomic_command_log`, constraints únicas de idempotência (`uq_atomic_commands_tenant_idempotency` e `uq_atomic_commands_tenant_command`), índices de performance e Row Level Security (RLS) habilitado com política estrita de tenant. Rollback completo e reversível fornecido por `supabase/migrations/down/20261014000000_phase8_unified_relational_contracts.down.sql` (DOWN).
3. **Idempotência Criptográfica e Reversibilidade (UP -> DOWN -> UP):** Ciclo completo de migrações validado por `scripts/qa/migration-idempotency-runner.mjs`. A comparação de hashes SHA-256 do catálogo de schema comprova 100% de idempotência (`hash(State 1) === hash(State 2)`), reversibilidade sem resíduos (`hash(State 3) === hash(State 0)`) e determinismo de re-aplicação (`hash(State 4) === hash(State 1)`).
4. **Alinhamento Estrito com TypeScript e Domínio:** Validação estática de contratos via `scripts/tests/phase8-relational-contracts.test.mjs`, garantindo correspondência 1:1 entre as propriedades da interface `LocalCommand` (`apps/web/src/platform/offline/commandPolicy.ts`), os tipos do Supabase (`apps/web/src/integrations/supabase/types.ts`) e a topologia de dependência relacional da API (`apps/api/src/modules/sync/domain/queue.ts`).
5. **Dry-Run Relacional, Integridade Referencial e Multi-Tenancy:** Simulação relacional in-memory via `scripts/tests/phase8-relational-rls-dryrun.test.mjs`, comprovando rejeição fail-closed de chaves estrangeiras órfãs (código PostgreSQL 23503), deleção em cascata controlada (`ON DELETE CASCADE`), rejeição de duplicação de chave de idempotência (código PostgreSQL 23505), zero vazamento de dados entre tenants distintos e bloqueio de injeção trans-tenant via cláusula RLS `WITH CHECK`.

---

## 2. Matriz de Execução e Cobertura de Testes

| Etapa | Ferramenta / Suíte | Escopo Testado | Total | PASS | FAIL | SKIP | Duração |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | Preflight & Doctor | Verificação de Git, Node, Bash e presença física das migrações e documentação | 1 | 1 | 0 | 0 | ~30ms |
| 2 | `sql-ddl-validator.mjs` + `migration-idempotency-runner.mjs` | Validação estática de DDL PostgreSQL, tipos, constraints e ciclo criptográfico UP->UP->DOWN->UP | 2 | 2 | 0 | 0 | ~45ms |
| 3 | `scripts/tests/phase8-ddl-schema-integrity.test.mjs` | Integridade DDL, parse de tipos, constraints de unicidade, índices e policies RLS | 12 | 12 | 0 | 0 | 129ms |
| 4 | `scripts/tests/phase8-relational-contracts.test.mjs` | Correspondência DDL ↔ `LocalCommand`, 130+ tabelas em `types.ts`, topologia FK de visitas | 8 | 8 | 0 | 0 | 134ms |
| 5 | `scripts/tests/phase8-relational-rls-dryrun.test.mjs` | Integridade referencial FK (23503), unicidade idempotente (23505), isolamento RLS multi-tenant | 6 | 6 | 0 | 0 | 105ms |
| **Total** | **Gate `task qa:phase8` Consolidado** | **Pipeline completo da FASE 8 (Local Dry-Run & Contratos)** | **29** | **29** | **0** | **0** | **~2.8s** |

---

## 3. Comprovação das Garantias Técnicas

### 3.1. Idempotência e Reversibilidade Criptográfica
As assinaturas SHA-256 do catálogo de schema durante as etapas do runner de idempotência comprovam o comportamento determinístico:
- **Estado 0 (Baseline inicial):** `8615f7c153185fde1c040b68b72b658a1fe2f88889efc95b0dc4561cbae05574`
- **Estado 1 (UP aplicado 1ª vez):** `8de5713ec2ecc174a26f7b09ab8fe3d237f8efe44113802165b1cfc1cdcf8b0a`
- **Estado 2 (UP re-aplicado 2ª vez):** `8de5713ec2ecc174a26f7b09ab8fe3d237f8efe44113802165b1cfc1cdcf8b0a` (`isIdempotent = true`)
- **Estado 3 (DOWN rollback executado):** `8615f7c153185fde1c040b68b72b658a1fe2f88889efc95b0dc4561cbae05574` (`isReversible = true`)
- **Estado 4 (UP re-aplicado após rollback):** `8de5713ec2ecc174a26f7b09ab8fe3d237f8efe44113802165b1cfc1cdcf8b0a` (`isDeterministic = true`)

### 3.2. Isolamento de Tenancy via Row Level Security (RLS)
- O DDL habilita `ALTER TABLE public.atomic_command_log ENABLE ROW LEVEL SECURITY`.
- A política `tenant_isolation_atomic_command_log` restringe as operações à organização ativa (`app.current_tenant_id`).
- No teste de simulação relacional `phase8-relational-rls-dryrun.test.mjs`, o isolamento foi validado em ambos os sentidos:
  - Sessão do Tenant A não retorna registros do Tenant B (`assert.equal(rowsA.length, 1)` e `assert.equal(rowsA[0].tenant_id, tenantA)`).
  - Tentativa de injeção de registro com `tenant_id = Tenant B` por um usuário com sessão do Tenant A é bloqueada com erro explícito de violação de `WITH CHECK`.

### 3.3. Integridade Referencial e Detecção de Dependências
- A hierarquia de Visitas Técnicas (`visitas_tecnicas` -> `visita_pastos`/`currais`/`topicos` -> `avaliacoes_score` -> `visita_fotos`) documentada em `apps/api/src/modules/sync/domain/queue.ts` está perfeitamente alinhada com as chaves estrangeiras.
- Filhos inseridos sem o registro pai disparam erro de chave estrangeira (`23503`), acionando a rotina de diferimento (`isDependencyError`) sem consumir retries indevidamente.
- Remoção do registro pai (`lancamentos`) aciona exclusão em cascata (`CASCADE`) de suas fotos dependentes (`fotos_salga`), prevenindo arquivos e referências órfãs.

### 3.4. Governança, Ausência de Conexões Remotas e `sourceUnchanged: true`
- **Zero Tráfego Externo**: Nenhuma conexão foi aberta contra o Supabase remoto ou endpoints de terceiros.
- **Estabilidade do Código**: O hash de integridade do código da árvore de trabalho permaneceu inalterado antes e depois da execução do gate (`sourceUnchanged: true`, fingerprint `e65a7290a6d23bbe3d4b3a0247605aeff2579f5bcab045992bdf6f6c7a728ce8`).

---

## 4. Status de Homologação e Próximos Passos

- **DEV LOCAL READY (FASE 8):** **APROVADO.** Todos os schemas relacionais, mapeamento das 6 bases legadas, testes DDL, contratos TypeScript e simulações RLS passaram 100% (29/29 verificações verdes) localmente via `task qa:phase8`.
- **PRÓXIMA FASE (FASE 9 — Pré-Produção & Homologação de Piloto):** Prosseguir para elaboração de runbooks operacionais, procedimentos de contingência, reconciliação de dados anonimizados e especificação do checklist de homologação física em campo.
