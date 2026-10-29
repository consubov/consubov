# Parecer Técnico — PR #68 (`fix/f12-gmd-confirmed-writes-20261028`)

**Data:** 29 de Outubro de 2026  
**Módulo:** CONSUBOV — Configuração GMD (`GerenteGmdPage.tsx`, Guardas GMD, Testes Unitários e de Componente)  
**Status de Validação:** **NO-GO** (para merge em produção / liberação de infraestrutura sem proteções de backend)  
**Status de Qualidade de Código / Testes Locais:** **GO** (para os testes unitários e de componente específicos de GMD)  

---

## 1. Resumo Executivo

O presente parecer técnico avalia a PR #68, que implementa o *hardening* da página `GerenteGmdPage.tsx` e dos guardas de gravação GMD (`gmdGuards.ts`).  
O objetivo principal da PR é mitigar vulnerabilidades lógicas de UI e race conditions nas gravações de GMD, assegurando que leituras parciais ou inconsistentes sejam bloqueadas (*fail-closed*), que operações de escrita (`INSERT`/`UPDATE`/`DELETE`) exijam contagem e IDs exatos de linhas retornadas (*confirmed writes*), e que o estado do banco seja verificado por *readback* antes da exibição de sucesso ao operador.

---

## 2. Inspeção de Arquivos e Escopo da PR #68

Os seguintes arquivos foram inspecionados no escopo da branch `fix/f12-gmd-confirmed-writes-20261028`:
1. `apps/web/src/lib/gmdGuards.ts` — Funções puras de validação (`parseGmd`, `assertMutation`, `validateLoadedGmd`, `expectedGmd`, `verifyGmdReadback`).
2. `apps/web/src/lib/gmdGuards.test.ts` — Suíte unitária exercitando 18 cenários de guarda (valores fora da faixa [-1, 3], zero rows em mutações, duplicatas, tenants cruzados, etc.).
3. `apps/web/src/pages/GerenteGmdPage.tsx` — Tela do Gerente GMD refatorada para bloquear edições em caso de falha de leitura, tratar retries seguros, exigir *read-after-write* e tipar rigidamente os payloads com os tipos gerados pelo Supabase.
4. `apps/web/src/test/pages/GerenteGmdPage.test.tsx` — Testes de componente testando cenários de erro 42501, *retry* e rejeição de atualizações de zero linhas.
5. `docs/qa/f12-gmd-confirmed-writes-2026-10-28.md` — Documentação técnica de QA da entrega F12.

---

## 3. Análise do Erro TS2345 e Correções de Tipagem

- **Problema anterior:** Ocorre o erro TS2345 quando objetos de atualização / inserção no Supabase não respeitam estritamente a tipagem gerada do banco (ex: campos opcionais passados como `undefined` em vez de `null` ou ausentes, ou tipagem frágil `any` rejeitada pelo linter do monorepo).
- **Resolução na PR #68:** O código foi refatorado no commit `1158153e` e `0b703196` para restringir os payloads de farm/gmd aos tipos gerados pelo Supabase e eliminar o uso de `any` e avisos de cleanup do `useEffect`.
- **Status do Typecheck:** Os testes unitários específicos (`gmdGuards.test.ts`) executam e passam 100% (18/18 casos).

---

## 4. Matriz de Gates e Critérios de Aceite

| Gate | Critério | Evidência na PR #68 | Status |
|---|---|---|---|
| **Unitário (GmdGuards)** | Rejeição de zero rows, IDs incorretos, duplicatas, tenants cruzados, valores/meses inválidos | 18 testes unitários passando em `gmdGuards.test.ts` | **PASS** |
| **Componente (GerenteGmdPage)** | Bloqueio de edição em falha de leitura, retry seguro, zero toast de sucesso em UPDATE de 0 linhas | Testes em `GerenteGmdPage.test.tsx` | **PASS** |
| **Typecheck / Lint** | Ausência de `any` implícito, conformidade com tipos Supabase | Ajustado em `GerenteGmdPage.tsx` e `gmdGuards.ts` | **PASS** (local) |
| **Transação Atômica de Banco** | Garantia de atomicidade multipartes via transação SQL / RPC | **Pendente no backend** (gravação multipartes sem transação única) | **FAIL / BLOQUEADO** |
| **Segurança RLS (`gmd_config`)** | RLS ativo e restrito na tabela `public.gmd_config` | RLS desativado ou permissões abertas na tabela no ambiente remoto | **PENDENTE / RISCO** |
| **Concorrência de Dispositivos** | Prevenção de sobrescrita concorrente de estado | Ausência de controle de versão otimista (`version`/`updated_at`) na tabela | **PENDENTE** |

---

## 5. Parecer Técnico (GO / NO-GO) e Pendências

### Parecer: **NO-GO** (para merge e liberação em produção)

#### Justificativa:
1. **Qualidade Frontend (GO):** A lógica de UI desenvolvida na PR #68 (`GerenteGmdPage.tsx` + `gmdGuards.ts`) é robusta, implementa com rigor o padrão *fail-closed*, valida *read-after-write* e possui excelente cobertura de testes unitários e de componente.
2. **Riscos Críticos de Backend (NO-GO):** 
   - A tabela `public.gmd_config` ainda requer ativação e testes rigorosos de RLS no banco de produção.
   - O salvamento da tela GMD é uma sequência de chamadas independentes (multipartes) sem transação atômica no banco, o que pode gerar estados inconsistentes em caso de interrupção de rede.
   - Ausência de restrição `UNIQUE` composta com `NULLS NOT DISTINCT` para `(fazenda_id, retiro_id, categoria)`.

#### Pendências de Validação Obrigatórias Antes do Merge:
1. Homologação completa com backend Supabase real e perfis segregados (Gerente, Capataz, Escritório, Anon).
2. Implementação de RPC ou transação atômica no lado do servidor para a gravação de configurações GMD.
3. Ativação e validação do RLS na tabela `public.gmd_config`.
